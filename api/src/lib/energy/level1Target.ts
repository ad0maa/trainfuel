// SPEC.md §6.2: Level 1 — expenditure-adjusted daily target. Pure, no DB
// access. The "double-count guard" (exercise kcal comes only from
// ExternalActivity, HealthKit whole-day active energy is ignored in v1) is
// enforced by the caller: this function just takes whatever `exerciseKcalRaw`
// number it's given and applies the device haircut.

import type { ActivityBaseline } from 'src/lib/db'

import {
  ACTIVITY_BASELINE_MULTIPLIER,
  DAYS_PER_WEEK,
  EXERCISE_KCAL_DEVICE_HAIRCUT,
  KCAL_PER_KG,
} from './constants'

export interface CalculateLevel1TargetInput {
  bmr: number
  activityBaseline: ActivityBaseline
  /** Raw (un-haircut) sum of ExternalActivity.energyKcal for the day. May be negative-safe-guarded to 0 internally. */
  exerciseKcalRaw: number
  /** e.g. -0.4 for a deficit pacing toward a goal weight; 0/undefined for maintenance. */
  weeklyWeightDeltaKg?: number | null
}

export interface Level1Target {
  baseTDEE: number
  /** Haircut-adjusted exercise kcal actually added to baseTDEE. */
  exerciseKcal: number
  dayTDEE: number
  /** Final daily kcal target, floored at `bmr * 1.0` (SPEC.md §6.2 guardrail — never advise eating below BMR). */
  targetKcal: number
  /** True if the deficit/surplus pacing would have pushed targetKcal below BMR and the floor kicked in — surface a gentle note in the UI. */
  flooredAtBmr: boolean
}

export function calculateLevel1Target({
  bmr,
  activityBaseline,
  exerciseKcalRaw,
  weeklyWeightDeltaKg,
}: CalculateLevel1TargetInput): Level1Target {
  if (!Number.isFinite(bmr) || bmr <= 0) {
    throw new Error(
      `calculateLevel1Target: bmr must be a positive number, got ${bmr}`
    )
  }

  const baseTDEE = bmr * ACTIVITY_BASELINE_MULTIPLIER[activityBaseline]
  const exerciseKcal =
    EXERCISE_KCAL_DEVICE_HAIRCUT * Math.max(exerciseKcalRaw, 0)
  const dayTDEE = baseTDEE + exerciseKcal

  const pacingAdjustment =
    ((weeklyWeightDeltaKg ?? 0) * KCAL_PER_KG) / DAYS_PER_WEEK
  const unflooredTargetKcal = dayTDEE + pacingAdjustment

  const bmrFloor = bmr * 1.0
  const flooredAtBmr = unflooredTargetKcal < bmrFloor
  const targetKcal = flooredAtBmr ? bmrFloor : unflooredTargetKcal

  return { baseTDEE, exerciseKcal, dayTDEE, targetKcal, flooredAtBmr }
}
