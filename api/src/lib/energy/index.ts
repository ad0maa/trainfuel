export { calculateAge, calculateBmr } from './bmr'
export type { CalculateAgeInput, CalculateBmrInput } from './bmr'
export { calculateLevel1Target } from './level1Target'
export type { CalculateLevel1TargetInput, Level1Target } from './level1Target'
export { calculateLevel2Macros } from './level2Macros'
export type { CalculateLevel2MacrosInput, Level2Macros } from './level2Macros'
export { resolveDayType } from './dayType'
export type { DayType, DayTypeScheduledItemInput } from './dayType'
export {
  ACTIVITY_BASELINE_MULTIPLIER,
  EXERCISE_KCAL_DEVICE_HAIRCUT,
  KCAL_PER_KG,
  DAYS_PER_WEEK,
  CARBS_G_PER_KG_BY_DAY_TYPE,
  DEFAULT_PROTEIN_G_PER_KG,
  FAT_FLOOR_G_PER_KG,
  CARBS_STEP_DOWN_G_PER_KG,
} from './constants'
