import type { QueryResolvers } from 'types/graphql'

import { UserInputError } from '@cedarjs/graphql-server'

import {
  localDateToUtcMidnight,
  localDayBoundsUtcForUser,
} from 'src/lib/date/localDay'
import { db } from 'src/lib/db'
import {
  calculateAge,
  calculateBmr,
  calculateLevel1Target,
} from 'src/lib/energy'
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

    await db.dailyMetric.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, targetKcal: level1.targetKcal, ...intake },
      update: { targetKcal: level1.targetKcal },
    })

    return {
      date: dateStr,
      targetKcal: level1.targetKcal,
      flooredAtBmr: level1.flooredAtBmr,
      ...intake,
    }
  }
