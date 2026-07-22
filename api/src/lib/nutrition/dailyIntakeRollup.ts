// SPEC.md §3.5: "A nightly job (and on-write triggers where cheap) maintains
// this table [DailyMetric]." This is the pure aggregation core — given a
// day's FoodLogEntry nutrient snapshots, sums them into the four
// DailyMetric.intake* fields. No DB access; the DB-touching upsert lives in
// api/src/services/foodLogEntries/foodLogEntries.ts (on-write) and
// scripts/rollupDailyMetrics.ts (nightly/backfill), both thin wrappers
// around this function.

import type { Per100Nutrients } from './computeNutrients'

export interface DailyIntakeRollup {
  intakeKcal: number
  intakeProteinG: number
  intakeCarbsG: number
  intakeFatG: number
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * Sums the (already per-entry-computed) `nutrients` snapshots of every
 * `FoodLogEntry` logged for one local day into the four DailyMetric intake
 * fields. Entries with a missing/malformed nutrient field are treated as 0
 * for that field rather than throwing — a single bad snapshot shouldn't
 * blow up the whole day's rollup.
 */
export function computeDailyIntakeRollup(
  entries: Array<{ nutrients: Per100Nutrients }>
): DailyIntakeRollup {
  let kcal = 0
  let proteinG = 0
  let carbsG = 0
  let fatG = 0

  for (const entry of entries) {
    const n = entry.nutrients
    kcal += Number.isFinite(n?.kcal) ? n.kcal : 0
    proteinG += Number.isFinite(n?.proteinG) ? n.proteinG : 0
    carbsG += Number.isFinite(n?.carbsG) ? n.carbsG : 0
    fatG += Number.isFinite(n?.fatG) ? n.fatG : 0
  }

  return {
    intakeKcal: round1(kcal),
    intakeProteinG: round1(proteinG),
    intakeCarbsG: round1(carbsG),
    intakeFatG: round1(fatG),
  }
}
