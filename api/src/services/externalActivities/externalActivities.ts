import type { MutationResolvers, QueryResolvers } from 'types/graphql'

import { UserInputError } from '@cedarjs/graphql-server'

import { localDayBoundsUtcForUser } from 'src/lib/date/localDay'
import type { CompletionSource, Prisma } from 'src/lib/db'
import { db } from 'src/lib/db'
import type { RawHevyWorkout } from 'src/lib/integrations/hevyIngest'
import { normalizeHevyActivity } from 'src/lib/integrations/hevyIngest'
import type { RawStravaActivity } from 'src/lib/integrations/stravaIngest'
import { normalizeStravaActivity } from 'src/lib/integrations/stravaIngest'
import { compatibleScheduledItemType, selectMatch } from 'src/lib/matching'

// SPEC.md §3.3, the auto-tick matching engine. `matching.ts` holds the pure
// rules (1–4); this service is the thin, DB-touching shell that loads
// candidates, applies them, and persists a Completion — plus rules 5/6
// (never overwrite a completion; idempotent re-processing), which need DB
// state to enforce and so live here rather than in the pure module. See
// CONSOLIDATION_PLAN.md Phase 2 / DECISIONS.md "M3".

/**
 * Upserts the normalized Strava activity (idempotent on
 * `@@unique([source, externalId])`) and runs the matching engine against
 * it. Called by both the webhook handler (single activity) and the backfill
 * script (looped per activity) — kept here, not duplicated in either
 * caller.
 */
export async function ingestStravaActivity(
  userId: string,
  raw: RawStravaActivity
) {
  const normalized = normalizeStravaActivity(raw)

  const activity = await db.externalActivity.upsert({
    where: {
      source_externalId: {
        source: 'STRAVA',
        externalId: normalized.externalId,
      },
    },
    create: {
      userId,
      source: 'STRAVA',
      externalId: normalized.externalId,
      activityType: normalized.activityType,
      startedAt: normalized.startedAt,
      durationSec: normalized.durationSec,
      distanceM: normalized.distanceM,
      energyKcal: normalized.energyKcal,
      raw: normalized.raw as unknown as Prisma.InputJsonValue,
    },
    // Re-delivery (webhook retry, backfill re-run) refreshes the data but
    // never touches matching state — matchAndComplete's own idempotency
    // check (rule 6) is what actually decides whether to (re-)match.
    update: {
      activityType: normalized.activityType,
      startedAt: normalized.startedAt,
      durationSec: normalized.durationSec,
      distanceM: normalized.distanceM,
      energyKcal: normalized.energyKcal,
      raw: normalized.raw as unknown as Prisma.InputJsonValue,
    },
  })

  await matchAndComplete(activity)
  return activity
}

/**
 * SPEC.md §4.2 / M4: Hevy equivalent of `ingestStravaActivity`. Called by
 * `pollHevyWorkoutsForUser` (api/src/services/externalActivities/hevyPoll.ts)
 * once per workout event pulled from `GET /v1/workouts/events`. Same
 * idempotent-upsert-then-match shape as Strava, plus syncing the workout's
 * `ExternalExercise` children (which Strava has none of).
 *
 * `ExternalExercise` rows are replaced wholesale (delete-then-recreate) on
 * every (re-)ingest rather than diffed/upserted — Hevy lets a user edit a
 * past workout's sets after the fact, and there's no natural per-set key to
 * upsert against (`ExternalExercise` has no unique constraint beyond `id`).
 * Delete+recreate is the simplest idempotent way to keep children in sync
 * with the latest payload, and is cheap at the scale of a single workout's
 * exercise list (single digits to low tens of rows).
 */
export async function ingestHevyActivity(userId: string, raw: RawHevyWorkout) {
  const normalized = normalizeHevyActivity(raw)

  const activity = await db.externalActivity.upsert({
    where: {
      source_externalId: {
        source: 'HEVY',
        externalId: normalized.externalId,
      },
    },
    create: {
      userId,
      source: 'HEVY',
      externalId: normalized.externalId,
      activityType: normalized.activityType,
      startedAt: normalized.startedAt,
      durationSec: normalized.durationSec,
      distanceM: normalized.distanceM,
      energyKcal: normalized.energyKcal,
      raw: normalized.raw as unknown as Prisma.InputJsonValue,
    },
    update: {
      activityType: normalized.activityType,
      startedAt: normalized.startedAt,
      durationSec: normalized.durationSec,
      distanceM: normalized.distanceM,
      energyKcal: normalized.energyKcal,
      raw: normalized.raw as unknown as Prisma.InputJsonValue,
    },
  })

  await db.externalExercise.deleteMany({ where: { activityId: activity.id } })
  if (normalized.exercises.length > 0) {
    await db.externalExercise.createMany({
      data: normalized.exercises.map((exercise) => ({
        activityId: activity.id,
        name: exercise.name,
        order: exercise.order,
        sets: exercise.sets as unknown as Prisma.InputJsonValue,
      })),
    })
  }

  await matchAndComplete(activity)
  return activity
}

/**
 * Best-effort delete for a Hevy `deleted` workout event
 * (`GET /v1/workouts/events`'s `DeletedWorkout` shape) — a no-op if the
 * activity was never ingested (idempotent, same spirit as rule 6). Cascades
 * to its `ExternalExercise` children; any linked `Completion` is preserved
 * with `externalActivityId` set to null (schema's `onDelete: SetNull`) so a
 * previously auto-ticked session doesn't silently un-complete itself.
 */
export async function deleteExternalActivity(
  source: CompletionSource,
  externalId: string
) {
  await db.externalActivity.deleteMany({
    where: { source, externalId },
  })
}

/**
 * SPEC.md §3.3's six rules, rules 1/5/6 enforced here (2–4 delegate to the
 * pure `selectMatch`):
 *   1. Compatible-type, same-local-day, PLANNED candidates only.
 *   5. Manual completions are never overwritten — candidates already
 *      completed are excluded, and this function never touches a
 *      ScheduledItem that already has a Completion.
 *   6. Idempotent — if this activity already produced a Completion (keyed
 *      on `externalActivityId`), re-processing it is a no-op.
 */
export async function matchAndComplete(activity: {
  id: string
  userId: string
  source: CompletionSource
  activityType: string
  startedAt: Date
}) {
  const alreadyProcessed = await db.completion.findFirst({
    where: { externalActivityId: activity.id },
    select: { id: true },
  })
  if (alreadyProcessed) {
    return null // rule 6
  }

  const itemType = compatibleScheduledItemType(activity.activityType)
  if (!itemType) {
    return null // rule 1 — no compatible ScheduledItemType for this activity
  }

  const { startUtc, endUtc } = await localDayBoundsUtcForUser(
    activity.userId,
    activity.startedAt
  )

  const candidates = await db.scheduledItem.findMany({
    where: {
      userId: activity.userId,
      type: itemType,
      status: 'PLANNED',
      isTemplate: false,
      completion: null, // rule 5 — never a candidate for overwrite
      scheduledAt: { gte: startUtc, lt: endUtc },
    },
    select: { id: true, scheduledAt: true },
  })

  const match = selectMatch(candidates, activity.startedAt)
  if (!match) {
    return null // rule 4 — stays in the unmatched tray
  }

  await db.completion.create({
    data: {
      scheduledItemId: match.scheduledItemId,
      userId: activity.userId,
      completedAt: activity.startedAt,
      source: activity.source,
      matchConfidence: match.matchConfidence,
      externalActivityId: activity.id,
    },
  })

  return db.scheduledItem.update({
    where: { id: match.scheduledItemId },
    data: { status: 'COMPLETED' },
  })
}

/**
 * SPEC.md §3.3 rule 4's "unplanned activity" tray: external activities with
 * no linked Completion, most recent first.
 */
export const unmatchedExternalActivities: QueryResolvers['unmatchedExternalActivities'] =
  () => {
    return db.externalActivity.findMany({
      where: {
        userId: context.currentUser.id,
        completions: { none: {} },
      },
      orderBy: { startedAt: 'desc' },
    })
  }

/**
 * SPEC.md §7.1's Progress page lift-progression chart: HEVY-sourced
 * activities (with their exercises) from the last `days` days, oldest
 * first so the chart can plot chronologically without re-sorting.
 */
export const liftActivities: QueryResolvers['liftActivities'] = ({ days }) => {
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - (days ?? 90))

  return db.externalActivity.findMany({
    where: {
      userId: context.currentUser.id,
      source: 'HEVY',
      startedAt: { gte: since },
    },
    include: { exercises: true },
    orderBy: { startedAt: 'asc' },
  })
}

/**
 * Manual half of rule 4 ("the user can link or ignore"). Links an
 * unmatched activity to a specific ScheduledItem the auto-matcher didn't
 * pick (or couldn't — e.g. a LIFT logged outside its planned day).
 * `matchConfidence: MANUAL` distinguishes this from an automatic EXACT/FUZZY
 * match in the UI. Refuses if the item already has a completion (same
 * never-overwrite rule as automatic matching).
 */
export const linkExternalActivity: MutationResolvers['linkExternalActivity'] =
  async ({ externalActivityId, scheduledItemId }) => {
    const userId = context.currentUser.id

    const activity = await db.externalActivity.findFirst({
      where: { id: externalActivityId, userId },
    })
    if (!activity) {
      throw new UserInputError('External activity not found')
    }

    const item = await db.scheduledItem.findFirst({
      where: { id: scheduledItemId, userId },
      include: { completion: true },
    })
    if (!item) {
      throw new UserInputError('Scheduled item not found')
    }
    if (item.completion) {
      throw new UserInputError(
        'This scheduled item already has a completion and cannot be relinked.'
      )
    }

    await db.completion.create({
      data: {
        scheduledItemId,
        userId,
        completedAt: activity.startedAt,
        source: activity.source,
        matchConfidence: 'MANUAL',
        externalActivityId: activity.id,
      },
    })

    return db.scheduledItem.update({
      where: { id: scheduledItemId },
      data: { status: 'COMPLETED' },
    })
  }
