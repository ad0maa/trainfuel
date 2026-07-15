import type { ScheduledItem } from 'src/lib/db'
import { db } from 'src/lib/db'

import {
  scheduledItems,
  todayScheduledItems,
  scheduledItem,
  createScheduledItem,
  updateScheduledItem,
  deleteScheduledItem,
  completeScheduledItem,
  skipScheduledItem,
  moveScheduledItem,
} from './scheduledItems.js'
import type { StandardScenario } from './scheduledItems.scenarios.js'

// The generated resolver types wrap results in `ResolverTypeWrapper<T>`
// (== `T | Promise<T>`), so awaited results still need a cast before
// property access — same pattern the generator's own boilerplate tests use.

describe('scheduledItems', () => {
  scenario(
    'only returns non-template items owned by the current user',
    async (scenario: StandardScenario) => {
      mockCurrentUser({
        id: scenario.user.owner.id,
        email: scenario.user.owner.email,
      })

      const result = (await scheduledItems({})) as ScheduledItem[]

      const ids = result.map((i) => i.id)
      expect(ids).toContain(scenario.scheduledItem.planned.id)
      expect(ids).toContain(scenario.scheduledItem.completed.id)
      // template excluded by default
      expect(ids).not.toContain(scenario.scheduledItem.templateItem.id)
      // other user's item excluded
      expect(ids).not.toContain(scenario.scheduledItem.othersItem.id)
    }
  )

  scenario(
    'includes templates when includeTemplates is true',
    async (scenario: StandardScenario) => {
      mockCurrentUser({
        id: scenario.user.owner.id,
        email: scenario.user.owner.email,
      })

      const result = (await scheduledItems({
        includeTemplates: true,
      })) as ScheduledItem[]

      expect(result.map((i) => i.id)).toContain(
        scenario.scheduledItem.templateItem.id
      )
    }
  )

  scenario(
    'filters by a [from, to) scheduledAt window',
    async (scenario: StandardScenario) => {
      mockCurrentUser({
        id: scenario.user.owner.id,
        email: scenario.user.owner.email,
      })

      // Window derived from the `planned` fixture's own scheduledAt (now
      // "+5 days", see scheduledItems.scenarios.ts) rather than a hardcoded
      // calendar date, so this test doesn't rot as the wall clock advances.
      const plannedAt = new Date(scenario.scheduledItem.planned.scheduledAt)
      const from = new Date(plannedAt.getTime() - 60 * 60 * 1000)
      const to = new Date(plannedAt.getTime() + 60 * 60 * 1000)

      const result = (await scheduledItems({ from, to })) as ScheduledItem[]

      const ids = result.map((i) => i.id)
      expect(ids).toContain(scenario.scheduledItem.planned.id)
      expect(ids).not.toContain(scenario.scheduledItem.completed.id) // -5 days, outside window
    }
  )

  scenario(
    "todayScheduledItems returns only today's items for the current user, via the localDay helper",
    async (scenario: StandardScenario) => {
      mockCurrentUser({
        id: scenario.user.owner.id,
        email: scenario.user.owner.email,
      })

      const result = (await todayScheduledItems()) as ScheduledItem[]

      const ids = result.map((i) => i.id)
      expect(ids).toContain(scenario.scheduledItem.todayItem.id)
      expect(ids).not.toContain(scenario.scheduledItem.planned.id) // +5 days, not "today"
      expect(ids).not.toContain(scenario.scheduledItem.othersItem.id)
      expect(ids).not.toContain(scenario.scheduledItem.templateItem.id)
    }
  )

  scenario(
    'returns null for a scheduledItem owned by a different user',
    async (scenario: StandardScenario) => {
      mockCurrentUser({
        id: scenario.user.owner.id,
        email: scenario.user.owner.email,
      })

      const result = await scheduledItem({
        id: scenario.scheduledItem.othersItem.id,
      })

      expect(result).toBeNull()
    }
  )

  scenario(
    'creates a one-off item scoped to the current user',
    async (scenario: StandardScenario) => {
      mockCurrentUser({
        id: scenario.user.owner.id,
        email: scenario.user.owner.email,
      })

      const result = (await createScheduledItem({
        input: {
          type: 'RUN',
          title: 'Tempo run',
          scheduledAt: new Date('2026-07-20T20:00:00.000Z'),
        },
      })) as ScheduledItem

      expect(result.userId).toEqual(scenario.user.owner.id)
      expect(result.isTemplate).toBe(false)
    }
  )

  scenario(
    'creating an item with a recurrenceRule marks it as a template',
    async (scenario: StandardScenario) => {
      mockCurrentUser({
        id: scenario.user.owner.id,
        email: scenario.user.owner.email,
      })

      const result = (await createScheduledItem({
        input: {
          type: 'MEDICATION',
          title: 'Vitamin D',
          scheduledAt: new Date('2026-07-20T22:00:00.000Z'),
          recurrenceRule: 'FREQ=DAILY',
        },
      })) as ScheduledItem

      expect(result.isTemplate).toBe(true)
    }
  )

  scenario(
    'refuses to create an item under a block owned by someone else',
    async (scenario: StandardScenario) => {
      mockCurrentUser({
        id: scenario.user.other.id,
        email: scenario.user.other.email,
      })

      await expect(
        createScheduledItem({
          input: {
            type: 'RUN',
            title: 'Sneaky session',
            scheduledAt: new Date('2026-07-20T20:00:00.000Z'),
            blockId: scenario.trainingBlock.ownerBlock.id,
          },
        })
      ).rejects.toThrow('Training block not found')
    }
  )

  scenario(
    'refuses to update a scheduledItem owned by a different user',
    async (scenario: StandardScenario) => {
      mockCurrentUser({
        id: scenario.user.other.id,
        email: scenario.user.other.email,
      })

      await expect(
        updateScheduledItem({
          id: scenario.scheduledItem.planned.id,
          input: { title: 'Hijacked' },
        })
      ).rejects.toThrow('Scheduled item not found')
    }
  )

  scenario(
    'deletes a scheduledItem owned by the current user',
    async (scenario: StandardScenario) => {
      mockCurrentUser({
        id: scenario.user.owner.id,
        email: scenario.user.owner.email,
      })

      await deleteScheduledItem({ id: scenario.scheduledItem.planned.id })

      const after = await scheduledItem({
        id: scenario.scheduledItem.planned.id,
      })
      expect(after).toBeNull()
    }
  )

  describe('completeScheduledItem', () => {
    scenario(
      'creates a MANUAL completion and marks the item COMPLETED',
      async (scenario: StandardScenario) => {
        mockCurrentUser({
          id: scenario.user.owner.id,
          email: scenario.user.owner.email,
        })

        const result = (await completeScheduledItem({
          id: scenario.scheduledItem.planned.id,
          notes: 'felt great',
        })) as ScheduledItem

        expect(result.status).toEqual('COMPLETED')

        const completion = await db.completion.findUnique({
          where: { scheduledItemId: scenario.scheduledItem.planned.id },
        })
        expect(completion?.source).toEqual('MANUAL')
        expect(completion?.matchConfidence).toEqual('MANUAL')
        expect(completion?.notes).toEqual('felt great')
      }
    )

    scenario(
      'is a no-op when a completion already exists and force is not set',
      async (scenario: StandardScenario) => {
        mockCurrentUser({
          id: scenario.user.owner.id,
          email: scenario.user.owner.email,
        })

        const before = await db.completion.findUnique({
          where: { scheduledItemId: scenario.scheduledItem.completed.id },
        })

        await completeScheduledItem({
          id: scenario.scheduledItem.completed.id,
          notes: 'trying to overwrite',
        })

        const after = await db.completion.findUnique({
          where: { scheduledItemId: scenario.scheduledItem.completed.id },
        })
        // unchanged — still the original STRAVA/EXACT completion
        expect(after?.source).toEqual(before?.source)
        expect(after?.matchConfidence).toEqual(before?.matchConfidence)
        expect(after?.notes).toEqual(before?.notes)
      }
    )

    scenario(
      'overwrites an existing completion as MANUAL when force is true',
      async (scenario: StandardScenario) => {
        mockCurrentUser({
          id: scenario.user.owner.id,
          email: scenario.user.owner.email,
        })

        await completeScheduledItem({
          id: scenario.scheduledItem.completed.id,
          notes: 'confirmed by me',
          force: true,
        })

        const after = await db.completion.findUnique({
          where: { scheduledItemId: scenario.scheduledItem.completed.id },
        })
        expect(after?.source).toEqual('MANUAL')
        expect(after?.matchConfidence).toEqual('MANUAL')
        expect(after?.notes).toEqual('confirmed by me')
      }
    )
  })

  describe('skipScheduledItem', () => {
    scenario(
      'marks a planned item SKIPPED',
      async (scenario: StandardScenario) => {
        mockCurrentUser({
          id: scenario.user.owner.id,
          email: scenario.user.owner.email,
        })

        const result = (await skipScheduledItem({
          id: scenario.scheduledItem.planned.id,
        })) as ScheduledItem

        expect(result.status).toEqual('SKIPPED')
      }
    )

    scenario(
      'is a no-op for an already-completed item (never overwrites a completion)',
      async (scenario: StandardScenario) => {
        mockCurrentUser({
          id: scenario.user.owner.id,
          email: scenario.user.owner.email,
        })

        const result = (await skipScheduledItem({
          id: scenario.scheduledItem.completed.id,
        })) as ScheduledItem

        expect(result.status).toEqual('COMPLETED')
      }
    )
  })

  describe('moveScheduledItem', () => {
    scenario(
      'updates scheduledAt and leaves status as PLANNED',
      async (scenario: StandardScenario) => {
        mockCurrentUser({
          id: scenario.user.owner.id,
          email: scenario.user.owner.email,
        })

        const newTime = new Date('2026-07-16T20:00:00.000Z')
        const result = (await moveScheduledItem({
          id: scenario.scheduledItem.planned.id,
          scheduledAt: newTime,
        })) as ScheduledItem

        expect(result.scheduledAt).toEqual(newTime)
        expect(result.status).toEqual('PLANNED')
      }
    )
  })
})
