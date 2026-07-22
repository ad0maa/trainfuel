import { localDateString, localDayBoundsUtc } from 'src/lib/date/localDay'
import type { ExternalActivity } from 'src/lib/db'
import { db } from 'src/lib/db'

import {
  ingestStravaActivity,
  linkExternalActivity,
  unmatchedExternalActivities,
} from './externalActivities.js'
import type { StandardScenario } from './externalActivities.scenarios.js'

// All times are computed relative to Date.now() (never a fixed calendar
// date) — see DECISIONS.md's note on scheduledItem.scenarios.ts for why a
// fixed date eventually collides with "today" as the wall clock advances.
const TODAY = localDateString(new Date(), 'UTC')
const { startUtc: dayStartUtc } = localDayBoundsUtc(TODAY, 'UTC')
const at = (hour: number, minute = 0) =>
  new Date(dayStartUtc.getTime() + hour * 60 * 60 * 1000 + minute * 60 * 1000)

function rawActivity(overrides: Record<string, unknown> = {}) {
  return {
    id: 1_000_000 + Math.floor(Math.random() * 1_000_000),
    type: 'Run',
    start_date: at(9).toISOString(),
    elapsed_time: 1800,
    distance: 5000,
    calories: 400,
    ...overrides,
  }
}

describe('ingestStravaActivity / matching', () => {
  scenario(
    'matches a single same-day PLANNED candidate as EXACT',
    async (scenario: StandardScenario) => {
      const item = await db.scheduledItem.create({
        data: {
          userId: scenario.user.owner.id,
          type: 'RUN',
          title: 'Easy 5k',
          scheduledAt: at(7),
          status: 'PLANNED',
        },
      })

      await ingestStravaActivity(
        scenario.user.owner.id,
        rawActivity({ id: 111 })
      )

      const updated = await db.scheduledItem.findUnique({
        where: { id: item.id },
        include: { completion: true },
      })
      expect(updated?.status).toBe('COMPLETED')
      expect(updated?.completion?.matchConfidence).toBe('EXACT')
      expect(updated?.completion?.source).toBe('STRAVA')
    }
  )

  scenario(
    'matches the nearest of multiple same-day candidates as FUZZY',
    async (scenario: StandardScenario) => {
      const far = await db.scheduledItem.create({
        data: {
          userId: scenario.user.owner.id,
          type: 'RUN',
          title: 'Far from activity',
          scheduledAt: at(6), // activity at 9:00, this is 3hr away
          status: 'PLANNED',
        },
      })
      const near = await db.scheduledItem.create({
        data: {
          userId: scenario.user.owner.id,
          type: 'RUN',
          title: 'Near activity',
          scheduledAt: at(9), // 0hr away — activity is at hour 9
          status: 'PLANNED',
        },
      })

      await ingestStravaActivity(
        scenario.user.owner.id,
        rawActivity({ id: 222 })
      )

      const nearAfter = await db.scheduledItem.findUnique({
        where: { id: near.id },
        include: { completion: true },
      })
      const farAfter = await db.scheduledItem.findUnique({
        where: { id: far.id },
        include: { completion: true },
      })

      expect(nearAfter?.status).toBe('COMPLETED')
      expect(nearAfter?.completion?.matchConfidence).toBe('FUZZY')
      expect(farAfter?.status).toBe('PLANNED')
      expect(farAfter?.completion).toBeNull()
    }
  )

  scenario(
    'leaves the activity unmatched when there are zero compatible candidates',
    async (scenario: StandardScenario) => {
      await ingestStravaActivity(
        scenario.user.owner.id,
        rawActivity({ id: 333 })
      )

      const unmatched = await unmatchedActivitiesFor(scenario.user.owner.id)
      expect(unmatched.some((a) => a.externalId === '333')).toBe(true)
    }
  )

  scenario(
    'leaves the activity unmatched when its type has no compatible ScheduledItemType (e.g. a ride)',
    async (scenario: StandardScenario) => {
      await db.scheduledItem.create({
        data: {
          userId: scenario.user.owner.id,
          type: 'RUN',
          title: 'Unrelated planned run',
          scheduledAt: at(9),
          status: 'PLANNED',
        },
      })

      await ingestStravaActivity(
        scenario.user.owner.id,
        rawActivity({ id: 444, type: 'Ride' })
      )

      const unmatched = await unmatchedActivitiesFor(scenario.user.owner.id)
      expect(unmatched.some((a) => a.externalId === '444')).toBe(true)
    }
  )

  scenario(
    'never overwrites an already-completed item — excludes it from candidates',
    async (scenario: StandardScenario) => {
      const alreadyDone = await db.scheduledItem.create({
        data: {
          userId: scenario.user.owner.id,
          type: 'RUN',
          title: 'Already manually completed',
          scheduledAt: at(9),
          status: 'COMPLETED',
          completion: {
            create: {
              userId: scenario.user.owner.id,
              completedAt: at(9),
              source: 'MANUAL',
              matchConfidence: 'MANUAL',
            },
          },
        },
      })
      const stillPlanned = await db.scheduledItem.create({
        data: {
          userId: scenario.user.owner.id,
          type: 'RUN',
          title: 'Still planned',
          scheduledAt: at(9, 30),
          status: 'PLANNED',
        },
      })

      await ingestStravaActivity(
        scenario.user.owner.id,
        rawActivity({ id: 555 })
      )

      const stillPlannedAfter = await db.scheduledItem.findUnique({
        where: { id: stillPlanned.id },
        include: { completion: true },
      })
      const alreadyDoneAfter = await db.scheduledItem.findUnique({
        where: { id: alreadyDone.id },
        include: { completion: true },
      })

      expect(stillPlannedAfter?.status).toBe('COMPLETED')
      expect(stillPlannedAfter?.completion?.source).toBe('STRAVA')
      // Untouched — still the original manual completion.
      expect(alreadyDoneAfter?.completion?.source).toBe('MANUAL')
    }
  )

  scenario(
    're-ingesting the same activity is idempotent (no duplicate row, no re-match)',
    async (scenario: StandardScenario) => {
      const item = await db.scheduledItem.create({
        data: {
          userId: scenario.user.owner.id,
          type: 'RUN',
          title: 'Easy 5k',
          scheduledAt: at(9),
          status: 'PLANNED',
        },
      })

      const payload = rawActivity({ id: 666 })
      await ingestStravaActivity(scenario.user.owner.id, payload)
      await ingestStravaActivity(scenario.user.owner.id, payload) // webhook retry / backfill overlap

      const activityCount = await db.externalActivity.count({
        where: { source: 'STRAVA', externalId: '666' },
      })
      const completionCount = await db.completion.count({
        where: { scheduledItemId: item.id },
      })
      expect(activityCount).toBe(1)
      expect(completionCount).toBe(1)
    }
  )

  scenario(
    "only surfaces the current user's unmatched activities",
    async (scenario: StandardScenario) => {
      await ingestStravaActivity(
        scenario.user.owner.id,
        rawActivity({ id: 777 })
      )
      await ingestStravaActivity(
        scenario.user.other.id,
        rawActivity({ id: 888 })
      )

      const ownerUnmatched = await unmatchedActivitiesFor(
        scenario.user.owner.id
      )
      expect(ownerUnmatched.some((a) => a.externalId === '777')).toBe(true)
      expect(ownerUnmatched.some((a) => a.externalId === '888')).toBe(false)
    }
  )
})

describe('linkExternalActivity', () => {
  scenario(
    'manually links an unmatched activity to a chosen item as MANUAL',
    async (scenario: StandardScenario) => {
      mockCurrentUser({
        id: scenario.user.owner.id,
        email: scenario.user.owner.email,
      })

      await ingestStravaActivity(
        scenario.user.owner.id,
        rawActivity({ id: 999, type: 'Ride' }) // guaranteed unmatched
      )
      const activity = await db.externalActivity.findUniqueOrThrow({
        where: { source_externalId: { source: 'STRAVA', externalId: '999' } },
      })
      const item = await db.scheduledItem.create({
        data: {
          userId: scenario.user.owner.id,
          type: 'LIFT',
          title: 'Leg day',
          scheduledAt: at(18),
          status: 'PLANNED',
        },
      })

      const result = await linkExternalActivity({
        externalActivityId: activity.id,
        scheduledItemId: item.id,
      })

      expect(result.status).toBe('COMPLETED')
      const completion = await db.completion.findUnique({
        where: { scheduledItemId: item.id },
      })
      expect(completion?.matchConfidence).toBe('MANUAL')
      expect(completion?.externalActivityId).toBe(activity.id)
    }
  )

  scenario(
    'refuses to link into an item that already has a completion',
    async (scenario: StandardScenario) => {
      mockCurrentUser({
        id: scenario.user.owner.id,
        email: scenario.user.owner.email,
      })

      await ingestStravaActivity(
        scenario.user.owner.id,
        rawActivity({ id: 1001, type: 'Ride' })
      )
      const activity = await db.externalActivity.findUniqueOrThrow({
        where: { source_externalId: { source: 'STRAVA', externalId: '1001' } },
      })
      const item = await db.scheduledItem.create({
        data: {
          userId: scenario.user.owner.id,
          type: 'LIFT',
          title: 'Leg day',
          scheduledAt: at(18),
          status: 'COMPLETED',
          completion: {
            create: {
              userId: scenario.user.owner.id,
              completedAt: at(18),
              source: 'MANUAL',
              matchConfidence: 'MANUAL',
            },
          },
        },
      })

      await expect(
        linkExternalActivity({
          externalActivityId: activity.id,
          scheduledItemId: item.id,
        })
      ).rejects.toThrow(/already has a completion/)
    }
  )

  scenario(
    "refuses to link another user's activity or item",
    async (scenario: StandardScenario) => {
      mockCurrentUser({
        id: scenario.user.owner.id,
        email: scenario.user.owner.email,
      })

      await ingestStravaActivity(
        scenario.user.other.id,
        rawActivity({ id: 1002, type: 'Ride' })
      )
      const othersActivity = await db.externalActivity.findUniqueOrThrow({
        where: { source_externalId: { source: 'STRAVA', externalId: '1002' } },
      })
      const ownItem = await db.scheduledItem.create({
        data: {
          userId: scenario.user.owner.id,
          type: 'LIFT',
          title: 'Leg day',
          scheduledAt: at(18),
          status: 'PLANNED',
        },
      })

      await expect(
        linkExternalActivity({
          externalActivityId: othersActivity.id,
          scheduledItemId: ownItem.id,
        })
      ).rejects.toThrow('External activity not found')
    }
  )
})

async function unmatchedActivitiesFor(userId: string) {
  mockCurrentUser({ id: userId, email: 'unused@example.com' })
  return (await unmatchedExternalActivities()) as ExternalActivity[]
}
