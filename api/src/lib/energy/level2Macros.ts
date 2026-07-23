// SPEC.md §6.3: Level 2 — planned-session macro periodization. Pure, no DB
// access, matching level1Target.ts's shape.

import {
  CARBS_G_PER_KG_BY_DAY_TYPE,
  CARBS_STEP_DOWN_G_PER_KG,
  DEFAULT_PROTEIN_G_PER_KG,
  FAT_FLOOR_G_PER_KG,
} from './constants'
import type { DayType } from './dayType'

const KCAL_PER_G_PROTEIN = 4
const KCAL_PER_G_CARBS = 4
const KCAL_PER_G_FAT = 9

export interface CalculateLevel2MacrosInput {
  targetKcal: number
  weightKg: number
  dayType: DayType
  /** Profile.proteinTargetGPerDay override; falls back to 2.0 g/kg if null/undefined. */
  proteinTargetGPerDayOverride?: number | null
}

export interface Level2Macros {
  dayType: DayType
  proteinG: number
  carbsG: number
  fatG: number
  /** Actual g/kg used for carbs after any step-down — for UI/debugging transparency. */
  carbsGPerKgUsed: number
  /** True if even stepping carbs down to 0 g/kg still couldn't keep fat at the 0.6 g/kg floor without exceeding targetKcal — the floor was applied anyway rather than going negative. */
  fatFlooredAtMin: boolean
}

export function calculateLevel2Macros({
  targetKcal,
  weightKg,
  dayType,
  proteinTargetGPerDayOverride,
}: CalculateLevel2MacrosInput): Level2Macros {
  if (!Number.isFinite(targetKcal) || targetKcal <= 0) {
    throw new Error(
      `calculateLevel2Macros: targetKcal must be a positive number, got ${targetKcal}`
    )
  }
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    throw new Error(
      `calculateLevel2Macros: weightKg must be a positive number, got ${weightKg}`
    )
  }

  const proteinG =
    proteinTargetGPerDayOverride ?? DEFAULT_PROTEIN_G_PER_KG * weightKg
  const fatFloorG = FAT_FLOOR_G_PER_KG * weightKg

  let carbsGPerKg = CARBS_G_PER_KG_BY_DAY_TYPE[dayType]
  let carbsG = carbsGPerKg * weightKg
  let fatG =
    (targetKcal - proteinG * KCAL_PER_G_PROTEIN - carbsG * KCAL_PER_G_CARBS) /
    KCAL_PER_G_FAT

  while (fatG < fatFloorG && carbsGPerKg > 0) {
    carbsGPerKg = Math.max(0, carbsGPerKg - CARBS_STEP_DOWN_G_PER_KG)
    carbsG = carbsGPerKg * weightKg
    fatG =
      (targetKcal - proteinG * KCAL_PER_G_PROTEIN - carbsG * KCAL_PER_G_CARBS) /
      KCAL_PER_G_FAT
  }

  const fatFlooredAtMin = fatG < fatFloorG
  if (fatFlooredAtMin) {
    fatG = fatFloorG
  }

  return {
    dayType,
    proteinG,
    carbsG,
    fatG,
    carbsGPerKgUsed: carbsGPerKg,
    fatFlooredAtMin,
  }
}
