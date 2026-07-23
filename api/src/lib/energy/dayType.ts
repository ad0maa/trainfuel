// SPEC.md §6.3: "Carbs by day type, derived from *planned* ScheduledItems
// for the date." Pure, no DB access — the caller fetches that day's items.

export type DayType = 'LONG_RUN' | 'QUALITY_RUN' | 'TRAINING' | 'REST'

export interface DayTypeScheduledItemInput {
  type: string // ScheduledItemType — kept as string so this stays decoupled from the Prisma enum import
  durationMin?: number | null
  // ScheduledItem.prescription is a Json column; only the two flags this
  // module cares about are read, everything else is ignored.
  prescription?: { isLongRun?: boolean; isQualityRun?: boolean } | null
}

/** SPEC.md §6.3: a RUN with prescription.isLongRun or duration ≥ 75 min is a LONG_RUN day. */
const LONG_RUN_MIN_DURATION_MIN = 75

/**
 * Resolves a single day's carb-periodization day type from its planned
 * ScheduledItems. Priority when multiple sessions land on the same day:
 * LONG_RUN > QUALITY_RUN > TRAINING (any other RUN/LIFT) > REST (nothing).
 */
export function resolveDayType(items: DayTypeScheduledItemInput[]): DayType {
  let hasTraining = false
  let hasQualityRun = false
  let hasLongRun = false

  for (const item of items) {
    if (item.type !== 'RUN' && item.type !== 'LIFT') continue
    hasTraining = true

    if (item.type !== 'RUN') continue
    const isLongRun =
      item.prescription?.isLongRun === true ||
      (item.durationMin ?? 0) >= LONG_RUN_MIN_DURATION_MIN
    if (isLongRun) {
      hasLongRun = true
    } else if (item.prescription?.isQualityRun === true) {
      hasQualityRun = true
    }
  }

  if (hasLongRun) return 'LONG_RUN'
  if (hasQualityRun) return 'QUALITY_RUN'
  if (hasTraining) return 'TRAINING'
  return 'REST'
}
