import type { QueryResolvers } from 'types/graphql'

import { UserInputError } from '@cedarjs/graphql-server'

import {
  localDateToUtcMidnight,
  localDayBoundsUtcForUser,
} from 'src/lib/date/localDay'
import { db } from 'src/lib/db'
import {
  ACTIVITY_BASELINE_MULTIPLIER,
  calculateAge,
  calculateBmr,
  calculateLevel1Target,
  calculateLevel2Macros,
  resolveDayType,
} from 'src/lib/energy'
import type { DayTypeScheduledItemInput } from 'src/lib/energy'
import type { Per100Nutrients } from 'src/lib/nutrition/computeNutrients'
import { computeDailyIntakeRollup } from 'src/lib/nutrition/dailyIntakeRollup'

/**
 * Resolves the weight input for BMR per SPEC.md §6.1: "most recent smoothed
 * weight (v1: latest DailyMetric.weightKg, falling back to profile-entered
 * weight...)". `Profile.currentWeightKg` is the M2 schema addition that
 * backs that fallback — see DECISIONS.md.
 */
async function resolveCurrentWeightKg(
  userId: string,
  asOfDate: Date
): Promise<number | null> {
  const latest = await db.dailyMetric.findFirst({
    where: { userId, date: { lte: asOfDate }, weightKg: { not: null } },
    orderBy: { date: 'desc' },
    select: { weightKg: true },
  })
  if (latest?.weightKg != null) {
    return latest.weightKg
  }

  const profile = await db.profile.findUnique({
    where: { userId },
    select: { currentWeightKg: true },
  })
  return profile?.currentWeightKg ?? null
}

/**
 * SPEC.md §6.2, M2 scope: Level 1 (expenditure-adjusted) target + today's
 * logged intake, for the Dashboard calorie/macro ring. No live exercise data
 * exists yet (ExternalActivity is empty until M3/M4), so exerciseKcalRaw
 * correctly evaluates to 0 — this is "static targets... Level 1 without
 * live exercise yet" per SPEC.md §8's M2 bullet, not a bug.
 *
 * Persists the computed target into DailyMetric.targetKcal on every call
 * (SPEC.md §6.2: "Persist the end-of-day final target into
 * DailyMetric.targetKcal") — cheap enough to do on every read for a
 * single-user app; a real nightly finalization job is unnecessary
 * over-engineering at this stage.
 */
export const todayEnergySummary: QueryResolvers['todayEnergySummary'] =
  async () => {
    const userId = context.currentUser.id
    const now = new Date()

    const profile = await db.profile.findUnique({ where: { userId } })
    if (!profile) {
      throw new UserInputError(
        'Complete your profile (sex, birth date, height) before daily energy targets can be calculated.'
      )
    }

    const weightKg = await resolveCurrentWeightKg(userId, now)
    if (weightKg == null) {
      throw new UserInputError(
        'Add a current weight to your profile before daily energy targets can be calculated.'
      )
    }

    const { startUtc, endUtc, dateStr } = await localDayBoundsUtcForUser(
      userId,
      now
    )

    const exerciseAgg = await db.externalActivity.aggregate({
      where: { userId, startedAt: { gte: startUtc, lt: endUtc } },
      _sum: { energyKcal: true },
    })
    const exerciseKcalRaw = exerciseAgg._sum.energyKcal ?? 0

    const age = calculateAge({ birthDate: profile.birthDate, asOf: now })
    const bmr = calculateBmr({
      sex: profile.sex,
      weightKg,
      heightCm: profile.heightCm,
      age,
    })
    const level1 = calculateLevel1Target({
      bmr,
      activityBaseline: profile.activityBaseline,
      exerciseKcalRaw,
      weeklyWeightDeltaKg: profile.weeklyWeightDeltaKg,
    })

    // Level 2 (SPEC.md §6.3): day type from today's planned (non-template)
    // RUN/LIFT sessions. Computed live on every call rather than cached
    // from "the night before" per spec's stability suggestion — an
    // accepted v1 simplification, see DECISIONS.md.
    const scheduledItemsToday = await db.scheduledItem.findMany({
      where: {
        userId,
        isTemplate: false,
        type: { in: ['RUN', 'LIFT'] },
        scheduledAt: { gte: startUtc, lt: endUtc },
      },
      select: { type: true, durationMin: true, prescription: true },
    })
    const dayType = resolveDayType(
      scheduledItemsToday.map(
        (item): DayTypeScheduledItemInput => ({
          type: item.type,
          durationMin: item.durationMin,
          prescription: item.prescription as unknown as {
            isLongRun?: boolean
            isQualityRun?: boolean
          } | null,
        })
      )
    )
    const level2 = calculateLevel2Macros({
      targetKcal: level1.targetKcal,
      weightKg,
      dayType,
      proteinTargetGPerDayOverride: profile.proteinTargetGPerDay,
    })

    const date = localDateToUtcMidnight(dateStr)
    const entries = await db.foodLogEntry.findMany({
      where: { userId, loggedFor: date },
      select: { nutrients: true },
    })
    const intake = computeDailyIntakeRollup(
      entries.map((e) => ({
        nutrients: e.nutrients as unknown as Per100Nutrients,
      }))
    )

    const targetFields = {
      targetKcal: level1.targetKcal,
      targetProteinG: level2.proteinG,
      targetCarbsG: level2.carbsG,
      targetFatG: level2.fatG,
    }

    await db.dailyMetric.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, ...targetFields, ...intake },
      update: targetFields,
    })

    return {
      date: dateStr,
      flooredAtBmr: level1.flooredAtBmr,
      dayType: level2.dayType,
      ...targetFields,
      ...intake,
    }
  }

/**
 * Standalone BMR/TDEE estimate for the TDEE calculator tool (SPEC.md
 * §7.1's Tools section). Reuses the exact same pure functions as
 * todayEnergySummary rather than reimplementing Mifflin-St Jeor client-side
 * — see DECISIONS.md's pure-core/thin-shell precedent for api/src/lib/energy.
 * Takes its inputs directly (no Profile/DailyMetric read) so it works as a
 * scratch calculator before a profile exists.
 */
export const tdeeEstimate: QueryResolvers['tdeeEstimate'] = ({ input }) => {
  const age = calculateAge({
    birthDate: new Date(input.birthDate),
    asOf: new Date(),
  })
  const bmr = calculateBmr({
    sex: input.sex,
    weightKg: input.weightKg,
    heightCm: input.heightCm,
    age,
  })
  const tdee = bmr * ACTIVITY_BASELINE_MULTIPLIER[input.activityBaseline]

  return { bmr, tdee }
}
