// SPEC.md §6: shared constants for the energy module. Named/exported rather
// than inlined as magic numbers anywhere they're used.

import type { ActivityBaseline } from 'src/lib/db'

import type { DayType } from './dayType'

/**
 * Mifflin-St Jeor non-exercise activity-factor multipliers, applied to BMR
 * to get baseTDEE (§6.2). SEDENTARY: 1.2 is the value SPEC.md §6.2 states
 * explicitly; the other four tiers use the standard published Mifflin-St
 * Jeor scale (1.375 / 1.55 / 1.725 / 1.9), mapped onto the ActivityBaseline
 * enum we added in M0 in ascending order. See DECISIONS.md.
 */
export const ACTIVITY_BASELINE_MULTIPLIER: Record<ActivityBaseline, number> = {
  SEDENTARY: 1.2,
  LIGHT: 1.375,
  MODERATE: 1.55,
  ACTIVE: 1.725,
  VERY_ACTIVE: 1.9,
}

/**
 * SPEC.md §6.2: "deviceHaircut default 0.75, configurable constant — device
 * estimates run hot." Applied to summed ExternalActivity.energyKcal for the
 * day before adding it to baseTDEE.
 */
export const EXERCISE_KCAL_DEVICE_HAIRCUT = 0.75

/** SPEC.md §6.2: kcal per kg of bodyweight, used to convert a weekly weight-change goal into a daily kcal pacing adjustment. */
export const KCAL_PER_KG = 7700

/** Days per week — used to spread the weekly weight-delta pacing across each day. */
export const DAYS_PER_WEEK = 7

/**
 * SPEC.md §6.3 Level 2: carbs g/kg bodyweight by day type. LONG_RUN and
 * QUALITY_RUN are keyed off that day's planned RUN sessions (see
 * ./dayType.ts); TRAINING covers any other RUN or LIFT day; REST is a day
 * with no planned RUN/LIFT session.
 */
export const CARBS_G_PER_KG_BY_DAY_TYPE: Record<DayType, number> = {
  LONG_RUN: 5,
  QUALITY_RUN: 4,
  TRAINING: 3,
  REST: 2.5,
}

/** SPEC.md §6.3: protein default when Profile.proteinTargetGPerDay isn't set. */
export const DEFAULT_PROTEIN_G_PER_KG = 2.0

/** SPEC.md §6.3: "fat... floor at 0.6 g/kg bodyweight." */
export const FAT_FLOOR_G_PER_KG = 0.6

/** SPEC.md §6.3: "if breached, reduce carbs tier by 0.5 g/kg steps." */
export const CARBS_STEP_DOWN_G_PER_KG = 0.5
