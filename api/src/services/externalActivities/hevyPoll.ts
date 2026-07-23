import { decryptToken } from 'src/lib/crypto'
import type { Prisma } from 'src/lib/db'
import { db } from 'src/lib/db'
import { listHevyWorkoutEvents } from 'src/lib/integrations/hevy'
import type { RawHevyWorkout } from 'src/lib/integrations/hevyIngest'

import {
  deleteExternalActivity,
  ingestHevyActivity,
} from './externalActivities'

// SPEC.md §4.2: "Poll: scheduled job every 15 min: GET /v1/workouts
// (paginated, since-last-sync using workout dates and a stored
// cursor/timestamp in IntegrationAccount.meta)." No donor equivalent (the
// `health` Django repo never integrated Hevy) — built directly from the
// spec + Hevy's live API. See CONSOLIDATION_PLAN.md Phase 3+ /
// DECISIONS.md "M4".
//
// Unlike Strava's fixed 30-day backfill window, Hevy's `/v1/workouts` has
// **no date filter at all** — only `/v1/workouts/events?since=` does. So
// this single function serves as both the recurring poll *and* the initial
// post-connect sync: with no stored cursor yet, `since` defaults to the
// epoch (Hevy's own default), which naturally pulls full workout history on
// the very first run — there's no separate "backfill" concept the way
// Strava's `after` param created one. See DECISIONS.md "M4" for why this
// diverges from M3's dedicated 30-day-window backfill script.
//
// No job runner exists yet (same gap M1/M3 left open) — this is invoked two
// ways: fire-and-forget from `connectHevy` right after the key is saved, and
// via `yarn cedar exec pollHevyWorkouts` (scripts/pollHevyWorkouts.ts), which
// needs external cron (hosting-platform scheduled function, system cron, or
// a future Cedar background job) to actually run every 15 minutes — nothing
// in this codebase currently invokes it on a timer. Idempotent either way:
// `ingestHevyActivity` upserts, and re-processing the same event range is a
// safe no-op via `matchAndComplete`'s own rule-6 check.

const EPOCH_ISO = new Date(0).toISOString()
const PAGE_SIZE = 10 // Hevy's documented max for /v1/workouts/events

interface HevyAccountMeta {
  hevyUserId?: string
  hevyUserName?: string
  sinceCursor?: string
  [key: string]: unknown
}

export interface HevyPollResult {
  updated: number
  deleted: number
}

/**
 * Pages through `/v1/workouts/events` since the account's stored cursor,
 * ingesting `updated` events and removing `deleted` ones, then advances the
 * cursor. The cursor is set to the timestamp the poll *started* at (not
 * "now" after processing, and not derived from event timestamps) — the same
 * safe-windowing principle as Strava's backfill `after` param: any workout
 * created/updated between the poll's start and its completion will simply
 * be picked up on the *next* poll rather than risk being missed by a cursor
 * that raced ahead of in-flight writes.
 */
export async function pollHevyWorkoutsForUser(
  userId: string
): Promise<HevyPollResult> {
  const account = await db.integrationAccount.findUnique({
    where: { userId_provider: { userId, provider: 'HEVY' } },
  })
  if (!account || !account.apiKey) {
    throw new Error(
      `pollHevyWorkoutsForUser: no Hevy IntegrationAccount (with apiKey) for user ${userId}`
    )
  }

  const apiKey = decryptToken(account.apiKey)
  const meta = (account.meta as HevyAccountMeta | null) ?? {}
  const since = meta.sinceCursor ?? EPOCH_ISO
  const pollStartedAt = new Date()

  let page = 1
  let pageCount = 1
  let updated = 0
  let deleted = 0

  do {
    const result = await listHevyWorkoutEvents(apiKey, {
      since,
      page,
      pageSize: PAGE_SIZE,
    })
    pageCount = result.page_count

    for (const event of result.events) {
      if (event.type === 'updated' && event.workout) {
        await ingestHevyActivity(userId, event.workout as RawHevyWorkout)
        updated++
      } else if (event.type === 'deleted' && event.id) {
        await deleteExternalActivity('HEVY', event.id)
        deleted++
      }
    }

    page++
  } while (page <= pageCount)

  await db.integrationAccount.update({
    where: { id: account.id },
    data: {
      lastSyncedAt: new Date(),
      status: 'OK',
      statusDetail: null,
      meta: {
        ...meta,
        sinceCursor: pollStartedAt.toISOString(),
      } as unknown as Prisma.InputJsonValue,
    },
  })

  return { updated, deleted }
}
