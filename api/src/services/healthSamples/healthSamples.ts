import type { MutationResolvers } from 'types/graphql'

import { localDayBoundsUtcForUser } from 'src/lib/date/localDay'
import { db } from 'src/lib/db'

import { upsertDailyMetricWeight } from '../dailyMetrics/dailyMetrics'

/**
 * SPEC.md §4.5: mobile posts a batch of HealthKit samples "since its last
 * anchor"; server dedupes on the HealthKit UUID (`sourceId`) and folds
 * BODY_MASS into DailyMetric.weightKg. Idempotency is the
 * `@@unique([userId, kind, sourceId])` constraint (`skipDuplicates`) — the
 * DB backstop, not app-level pre-checking, matching this codebase's
 * existing belt-and-braces precedent (M1/M3).
 *
 * ACTIVE_ENERGY samples are stored as-is and never folded into any energy-
 * calc field — SPEC.md §6.2's double-count guard is explicit that
 * HealthKit active energy is ignored in v1 (Strava/Hevy already cover
 * exercise kcal for the day).
 */
export const syncHealthSamples: MutationResolvers['syncHealthSamples'] =
  async ({ samples }) => {
    const userId = context.currentUser.id

    const created = await db.healthSample.createManyAndReturn({
      data: samples.map((sample) => ({ ...sample, userId })),
      skipDuplicates: true,
    })

    const bodyMassSamples = samples.filter((s) => s.kind === 'BODY_MASS')
    const localDays = new Set<string>()
    const dayStrByLocalDay = new Map<string, { startUtc: Date; endUtc: Date }>()

    for (const sample of bodyMassSamples) {
      const { startUtc, endUtc, dateStr } = await localDayBoundsUtcForUser(
        userId,
        new Date(sample.sampledAt)
      )
      localDays.add(dateStr)
      dayStrByLocalDay.set(dateStr, { startUtc, endUtc })
    }

    for (const dateStr of localDays) {
      const { startUtc, endUtc } = dayStrByLocalDay.get(dateStr)!
      // Re-query the authoritative latest sample for the day from the DB
      // (not just this batch) — a re-posted/retried batch, or one that
      // mixes already-synced and new samples, must still resolve to the
      // true latest reading for that day, not just the latest among
      // whatever happened to be newly inserted this call.
      const latest = await db.healthSample.findFirst({
        where: {
          userId,
          kind: 'BODY_MASS',
          sampledAt: { gte: startUtc, lt: endUtc },
        },
        orderBy: { sampledAt: 'desc' },
      })
      if (latest) {
        await upsertDailyMetricWeight(userId, dateStr, latest.value)
      }
    }

    return created
  }
