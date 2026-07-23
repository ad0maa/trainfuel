// Demo/dev seed data — two local-only test accounts so the app has
// something to look at (calorie ring, badges, training plan, integrations)
// without manually clicking through onboarding every time the DB is reset.
//
// Credentials for these accounts are documented in CLAUDE.md ("Local dev
// demo accounts"), not here — that's the file Claude sessions and humans
// both actually read first.
//
// Idempotent: skips a user entirely if that email already exists, so
// `yarn cedar prisma migrate reset` (which re-runs this) is safe to run
// repeatedly and won't touch your own real dev account.
//
// Food log entries depend on the AFCD food dataset (`yarn cedar exec
// seedAfcd`) already being seeded — if it isn't, that part is skipped with a
// warning rather than failing the whole script.
//
// Run with: yarn cedar prisma db seed   (or: yarn cedar exec seed)

import { hashPassword } from '@cedarjs/auth-dbauth-api'

import { db } from 'api/src/lib/db'
import {
  addLocalDays,
  localDateString,
  localDayBoundsUtc,
} from 'api/src/lib/date/localDay'
import {
  computeLoggedNutrients,
  type Per100Nutrients,
} from 'api/src/lib/nutrition/computeNutrients'

const TIMEZONE = 'Australia/Melbourne'
const DEMO_PASSWORD = 'TrainFuelDemo1!'

function atLocalTime(dateStr: string, hour: number, minute = 0): Date {
  const { startUtc } = localDayBoundsUtc(dateStr, TIMEZONE)
  return new Date(startUtc.getTime() + (hour * 60 + minute) * 60_000)
}

function weekdayIndexUtc(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = Sun .. 6 = Sat
}

/** Monday-start week (as date strings) containing `dateStr`. */
function weekDates(dateStr: string): string[] {
  const mondayOffset = (weekdayIndexUtc(dateStr) + 6) % 7 // 0 = Mon .. 6 = Sun
  const monday = addLocalDays(dateStr, -mondayOffset)
  return Array.from({ length: 7 }, (_, i) => addLocalDays(monday, i))
}

async function findFood(name: string) {
  return db.food.findFirst({ where: { name } })
}

async function logMeal(
  userId: string,
  loggedForStr: string,
  meal: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK',
  foodName: string,
  grams: number
) {
  const food = await findFood(foodName)
  if (!food) return false

  const nutrients = computeLoggedNutrients({
    per100: food.per100 as unknown as Per100Nutrients,
    quantity: grams,
    unit: 'GRAM',
  })

  await db.foodLogEntry.create({
    data: {
      userId,
      foodId: food.id,
      loggedFor: new Date(`${loggedForStr}T00:00:00.000Z`),
      meal,
      quantity: grams,
      unit: 'GRAM',
      nutrients,
    },
  })
  return true
}

async function seedRunner() {
  const email = 'demo.runner@trainfuel.dev'
  if (await db.user.findUnique({ where: { email } })) {
    console.info(`  seed: ${email} already exists, skipping`)
    return
  }

  const [hashedPassword, salt] = hashPassword(DEMO_PASSWORD)
  const user = await db.user.create({
    data: { email, hashedPassword, salt },
  })

  await db.profile.create({
    data: {
      userId: user.id,
      sex: 'FEMALE',
      birthDate: new Date('1994-03-12'),
      heightCm: 168,
      currentWeightKg: 61,
      goalWeightKg: 59,
      weeklyWeightDeltaKg: -0.3,
      activityBaseline: 'LIGHT',
      timezone: TIMEZONE,
    },
  })

  const buildBlock = await db.trainingBlock.create({
    data: {
      userId: user.id,
      name: 'Melbourne Marathon — Build',
      phase: 'BUILD',
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-09-13'),
      notes: '16-week build into race day. Long run grows weekly, cutback every 4th week.',
    },
  })

  await db.trainingBlock.create({
    data: {
      userId: user.id,
      name: 'Off-season Base',
      phase: 'REBUILD',
      startDate: new Date('2026-02-01'),
      endDate: new Date('2026-05-31'),
      notes: 'Aerobic rebuild after the last marathon block.',
    },
  })

  const todayStr = localDateString(new Date(), TIMEZONE)
  const week = weekDates(todayStr)
  const todayIdx = week.indexOf(todayStr)

  async function createItem(opts: {
    dateStr: string
    hour: number
    minute?: number
    type: 'RUN' | 'LIFT' | 'MEDICATION' | 'SUPPLEMENT'
    title: string
    description?: string
    blockId?: string
    status: 'PLANNED' | 'COMPLETED' | 'SKIPPED'
    completionSource?: 'STRAVA' | 'HEVY' | 'MANUAL'
  }) {
    const scheduledAt = atLocalTime(opts.dateStr, opts.hour, opts.minute ?? 0)
    const item = await db.scheduledItem.create({
      data: {
        userId: user.id,
        blockId: opts.blockId,
        type: opts.type,
        title: opts.title,
        description: opts.description,
        scheduledAt,
        status: opts.status,
      },
    })

    if (opts.status === 'COMPLETED' && opts.completionSource) {
      await db.completion.create({
        data: {
          scheduledItemId: item.id,
          userId: user.id,
          completedAt: scheduledAt,
          source: opts.completionSource,
          matchConfidence: opts.completionSource === 'MANUAL' ? 'MANUAL' : 'EXACT',
        },
      })
    }

    return item
  }

  for (let i = 0; i < week.length; i++) {
    const dateStr = week[i]

    if (i === todayIdx) {
      await createItem({
        dateStr,
        hour: 7,
        type: 'RUN',
        title: 'Easy 8km recovery',
        description: 'Zone 2, keep it conversational.',
        blockId: buildBlock.id,
        status: 'COMPLETED',
        completionSource: 'STRAVA',
      })
      await createItem({
        dateStr,
        hour: 17,
        minute: 30,
        type: 'LIFT',
        title: 'Lower body strength',
        description: 'Squat 4x5, RDL 3x8, calf raises 3x12.',
        blockId: buildBlock.id,
        status: 'PLANNED',
      })
      await createItem({
        dateStr,
        hour: 8,
        type: 'MEDICATION',
        title: 'Iron tablet',
        status: 'COMPLETED',
        completionSource: 'MANUAL',
      })
      await createItem({
        dateStr,
        hour: 8,
        minute: 5,
        type: 'SUPPLEMENT',
        title: 'Creatine 5g',
        status: 'SKIPPED',
      })
    } else if (dateStr < todayStr) {
      const past = [
        {
          hour: 6,
          minute: 30,
          type: 'RUN' as const,
          title: 'Tempo 10km',
          status: 'COMPLETED' as const,
          completionSource: 'STRAVA' as const,
        },
        {
          hour: 17,
          type: 'LIFT' as const,
          title: 'Upper body strength',
          status: 'COMPLETED' as const,
          completionSource: 'HEVY' as const,
        },
        {
          hour: 6,
          minute: 30,
          type: 'RUN' as const,
          title: 'Easy 6km',
          status: 'SKIPPED' as const,
        },
      ][i % 3]
      await createItem({ dateStr, blockId: buildBlock.id, ...past })
    } else {
      const upcoming = [
        {
          hour: 17,
          type: 'LIFT' as const,
          title: 'Full body strength',
          status: 'PLANNED' as const,
        },
        {
          hour: 7,
          type: 'RUN' as const,
          title: 'Long run 22km',
          description: "This week's key session — race-pace last 5km.",
          status: 'PLANNED' as const,
        },
        {
          hour: 8,
          type: 'SUPPLEMENT' as const,
          title: 'Creatine 5g',
          status: 'PLANNED' as const,
        },
      ][i % 3]
      await createItem({ dateStr, blockId: buildBlock.id, ...upcoming })
    }
  }

  // Unmatched external activity (a ride — not a compatible type for the
  // RUN/LIFT auto-matcher, so it stays in the "unplanned activities" tray).
  await db.externalActivity.create({
    data: {
      userId: user.id,
      source: 'STRAVA',
      externalId: 'demo-seed-ride-1',
      activityType: 'Ride',
      startedAt: atLocalTime(todayStr, 6, 0),
      durationSec: 3600,
      distanceM: 25000,
      energyKcal: 620,
      raw: { note: 'demo seed data' },
    },
  })

  await db.integrationAccount.create({
    data: {
      userId: user.id,
      provider: 'STRAVA',
      status: 'OK',
      lastSyncedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
  })
  await db.integrationAccount.create({
    data: {
      userId: user.id,
      provider: 'HEVY',
      status: 'ERROR',
      statusDetail: 'Hevy API key expired — reconnect to resume syncing.',
      lastSyncedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
  })

  const meals: Array<[typeof todayStr, 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK', string, number]> = [
    [todayStr, 'BREAKFAST', 'Porridge, rolled oats, prepared with water', 300],
    [todayStr, 'BREAKFAST', 'Egg, chicken, whole, hard-boiled', 100],
    [todayStr, 'LUNCH', 'Chicken, breast, lean flesh, grilled, no added fat', 150],
    [todayStr, 'LUNCH', 'Rice, white, boiled or rice cooker, no added salt', 200],
    [todayStr, 'DINNER', 'Chicken, breast, lean flesh, grilled, no added fat', 150],
    [todayStr, 'DINNER', 'Broccoli, fresh, boiled, drained', 120],
    [todayStr, 'SNACK', 'Banana, cavendish, peeled, raw', 120],
  ]
  let loggedAny = false
  for (const [dateStr, meal, foodName, grams] of meals) {
    if (await logMeal(user.id, dateStr, meal, foodName, grams)) loggedAny = true
  }
  if (!loggedAny) {
    console.info(
      '  seed: AFCD foods not found — run `yarn cedar exec seedAfcd` first for food log demo data.'
    )
  }

  console.info(`  seed: created ${email} (password: ${DEMO_PASSWORD})`)
}

async function seedLifter() {
  const email = 'demo.lifter@trainfuel.dev'
  if (await db.user.findUnique({ where: { email } })) {
    console.info(`  seed: ${email} already exists, skipping`)
    return
  }

  const [hashedPassword, salt] = hashPassword(DEMO_PASSWORD)
  const user = await db.user.create({
    data: { email, hashedPassword, salt },
  })

  await db.profile.create({
    data: {
      userId: user.id,
      sex: 'MALE',
      birthDate: new Date('1990-07-01'),
      heightCm: 181,
      currentWeightKg: 82,
      activityBaseline: 'MODERATE',
      timezone: TIMEZONE,
    },
  })

  const block = await db.trainingBlock.create({
    data: {
      userId: user.id,
      name: 'Strength Block 3',
      phase: 'BUILD',
      startDate: new Date('2026-06-15'),
      endDate: new Date('2026-08-15'),
    },
  })

  const todayStr = localDateString(new Date(), TIMEZONE)

  await db.scheduledItem.create({
    data: {
      userId: user.id,
      blockId: block.id,
      type: 'LIFT',
      title: 'Push day',
      description: 'Bench 5x5, OHP 3x8, dips 3xAMRAP.',
      scheduledAt: atLocalTime(todayStr, 18, 0),
      status: 'PLANNED',
    },
  })

  const supplement = await db.scheduledItem.create({
    data: {
      userId: user.id,
      type: 'SUPPLEMENT',
      title: 'Fish oil',
      scheduledAt: atLocalTime(todayStr, 8, 0),
      status: 'COMPLETED',
    },
  })
  await db.completion.create({
    data: {
      scheduledItemId: supplement.id,
      userId: user.id,
      completedAt: atLocalTime(todayStr, 8, 0),
      source: 'MANUAL',
      matchConfidence: 'MANUAL',
    },
  })

  let loggedAny = false
  if (await logMeal(user.id, todayStr, 'LUNCH', 'Chicken, breast, lean flesh, grilled, no added fat', 200))
    loggedAny = true
  if (await logMeal(user.id, todayStr, 'LUNCH', 'Rice, white, boiled or rice cooker, no added salt', 250))
    loggedAny = true
  if (await logMeal(user.id, todayStr, 'SNACK', 'Banana, cavendish, peeled, raw', 120)) loggedAny = true
  if (!loggedAny) {
    console.info(
      '  seed: AFCD foods not found — run `yarn cedar exec seedAfcd` first for food log demo data.'
    )
  }

  // Deliberately no IntegrationAccount rows — this user shows the
  // "not connected" empty state for both Strava and Hevy.

  console.info(`  seed: created ${email} (password: ${DEMO_PASSWORD})`)
}

export default async () => {
  try {
    await seedRunner()
    await seedLifter()
  } catch (error) {
    console.error(error)
  }
}
