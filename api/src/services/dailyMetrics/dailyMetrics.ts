// DB-touching wrapper around the pure `computeDailyIntakeRollup` core
// (api/src/lib/nutrition/dailyIntakeRollup.ts). Not GraphQL-exposed itself —
// called on-write from foodLogEntries.ts after any FoodLogEntry
// create/update/delete, and from scripts/rollupDailyMetrics.ts for
// nightly/backfill re-runs (SPEC.md §3.5: "A nightly job (and on-write
// triggers where cheap) maintains this table").

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
