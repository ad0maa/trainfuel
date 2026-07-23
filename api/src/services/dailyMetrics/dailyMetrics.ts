// DB-touching wrapper around the pure `computeDailyIntakeRollup` core
// (api/src/lib/nutrition/dailyIntakeRollup.ts). Not GraphQL-exposed itself —
// called on-write from foodLogEntries.ts after any FoodLogEntry
// create/update/delete, and from scripts/rollupDailyMetrics.ts for
// nightly/backfill re-runs (SPEC.md §3.5: "A nightly job (and on-write
// triggers where cheap) maintains this table").

import type { QueryResolvers } from 'types/graphql'

import { localDateToUtcMidnight } from 'src/lib/date/localDay'
import { db } from 'src/lib/db'
import type { Per100Nutrients } from 'src/lib/nutrition/computeNutrients'
import { computeDailyIntakeRollup } from 'src/lib/nutrition/dailyIntakeRollup'

/**
 * Recomputes and upserts a single user/day's intake* fields on DailyMetric
 * from that day's FoodLogEntry rows. Only touches the intake* columns —
 * weightKg/exerciseKcalRaw/target* (owned by other parts of the app) are
 * preserved on update, defaulted to null only on first insert for that day.
 */
export async function upsertDailyIntakeRollup(
  userId: string,
  dateStr: string
): Promise<void> {
  const date = localDateToUtcMidnight(dateStr)

  const entries = await db.foodLogEntry.findMany({
    where: { userId, loggedFor: date },
    select: { nutrients: true },
  })

  const rollup = computeDailyIntakeRollup(
    entries.map((e) => ({
      nutrients: e.nutrients as unknown as Per100Nutrients,
    }))
  )

  await db.dailyMetric.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, ...rollup },
    update: { ...rollup },
  })
}

/**
 * Sets a single user/day's DailyMetric.weightKg — called from
 * syncHealthSamples (SPEC.md §4.5: "Body mass flows into
 * DailyMetric.weightKg (latest sample per local day)") after a batch of
 * HealthKit BODY_MASS samples lands. Only touches weightKg — intake /
 * exerciseKcalRaw / target fields (owned by other parts of the app) are
 * preserved on update, same as `upsertDailyIntakeRollup` above.
 */
export async function upsertDailyMetricWeight(
  userId: string,
  dateStr: string,
  weightKg: number
): Promise<void> {
  const date = localDateToUtcMidnight(dateStr)

  await db.dailyMetric.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, weightKg },
    update: { weightKg },
  })
}

/**
 * GraphQL-exposed: the current user's last 'days' days of DailyMetric rows,
 * for the Progress page's weight-trend chart (SPEC.md §7.1).
 */
export const dailyMetrics: QueryResolvers['dailyMetrics'] = async ({
  days,
}) => {
  const userId = context.currentUser.id
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - (days ?? 90))

  const rows = await db.dailyMetric.findMany({
    where: { userId, date: { gte: since } },
    orderBy: { date: 'asc' },
    select: { date: true, weightKg: true, intakeKcal: true, targetKcal: true },
  })

  return rows.map((row) => ({
    ...row,
    date: row.date.toISOString().slice(0, 10),
  }))
}
