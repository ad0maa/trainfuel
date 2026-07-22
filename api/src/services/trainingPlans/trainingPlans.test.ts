import { localDateString } from 'src/lib/date/localDay'
import type { TrainingBlock } from 'src/lib/db'
import { db } from 'src/lib/db'
import { generatePlan } from 'src/lib/planTemplates'

import { generateTrainingPlan } from './trainingPlans.js'
import type { StandardScenario } from './trainingPlans.scenarios.js'

// The generator's own internals (entry-week matching, Monday-anchoring,
// phase segmentation, feasibility math) are already exhaustively covered by
// api/src/lib/planTemplates/generatePlan.test.ts against the pure function.
// This suite covers the service shell only: ownership scoping, persistence,
// the overlap guard, and feasibility pass-through.
//
// startDate is always computed relative to Date.now() (never a fixed
// calendar date) — see DECISIONS.md's note on scheduledItem.scenarios.ts
// for why a fixed date eventually collides with "today" as the wall clock
// advances.
const START_DATE = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)

describe('generateTrainingPlan', () => {
  scenario(
    'creates blocks and sessions scoped to the current user',
    async (scenario: StandardScenario) => {
      mockCurrentUser({
        id: scenario.user.owner.id,
        email: scenario.user.owner.email,
      })

      const result = await generateTrainingPlan({
        input: {
          goalType: 'FIVE_K',
          currentWeeklyKm: 0,
          startDate: START_DATE,
        },
      })

      expect(result.entryWeekNo).toBe(1)
      expect(result.feasibility).toBeNull()
      expect(result.blocks).toHaveLength(4) // Base/Build/Peak/Taper, see generatePlan.test.ts

      for (const block of result.blocks as TrainingBlock[]) {
        const owned = await db.trainingBlock.findFirst({
          where: { id: block.id, userId: scenario.user.owner.id },
        })
        expect(owned).not.toBeNull()
      }

      const sessionCount = await db.scheduledItem.count({
        where: { userId: scenario.user.owner.id, type: 'RUN' },
      })
      expect(sessionCount).toBe(12 * 3)
    }
  )

  scenario(
    'falls back to the default timezone for a user with no Profile yet',
    async (scenario: StandardScenario) => {
      mockCurrentUser({
        id: scenario.user.other.id,
        email: scenario.user.other.email,
      })

      const result = await generateTrainingPlan({
        input: {
          goalType: 'COUCH_TO_5K',
          currentWeeklyKm: 0,
          startDate: START_DATE,
        },
      })

      expect(result.entryWeekNo).toBe(1)
      expect(result.blocks.length).toBeGreaterThan(0)
    }
  )

  scenario(
    'rejects an overlapping plan unless confirmOverlap is true',
    async (scenario: StandardScenario) => {
      mockCurrentUser({
        id: scenario.user.owner.id,
        email: scenario.user.owner.email,
      })

      // Precompute where this plan would land (pure function, no DB) so we
      // can seed a conflicting RUN item at exactly the first session's time.
      const preview = generatePlan({
        goalType: '5k',
        currentWeeklyKm: 0,
        startDate: localDateString(START_DATE, 'UTC'),
        timezone: 'UTC',
      })
      const conflictingAt = preview.blocks[0].sessions[0].scheduledAt

      await db.scheduledItem.create({
        data: {
          type: 'RUN',
          title: 'Pre-existing run',
          scheduledAt: conflictingAt,
          status: 'PLANNED',
          userId: scenario.user.owner.id,
        },
      })

      await expect(
        generateTrainingPlan({
          input: {
            goalType: 'FIVE_K',
            currentWeeklyKm: 0,
            startDate: START_DATE,
          },
        })
      ).rejects.toThrow(/overlap/i)

      // No partial blocks left behind by the rejected attempt.
      const blockCount = await db.trainingBlock.count({
        where: { userId: scenario.user.owner.id },
      })
      expect(blockCount).toBe(0)

      const result = await generateTrainingPlan({
        input: {
          goalType: 'FIVE_K',
          currentWeeklyKm: 0,
          startDate: START_DATE,
          confirmOverlap: true,
        },
      })
      expect(result.blocks.length).toBeGreaterThan(0)
    }
  )

  scenario(
    'surfaces an infeasible goal date as data, not an error',
    async (scenario: StandardScenario) => {
      mockCurrentUser({
        id: scenario.user.owner.id,
        email: scenario.user.owner.email,
      })

      const tooSoon = new Date(START_DATE.getTime() + 7 * 24 * 60 * 60 * 1000) // +1wk, 5k needs 12

      const result = await generateTrainingPlan({
        input: {
          goalType: 'FIVE_K',
          currentWeeklyKm: 0,
          startDate: START_DATE,
          goalDate: tooSoon,
        },
      })

      expect(result.feasibility?.isFeasible).toBe(false)
      expect(result.blocks.length).toBeGreaterThan(0) // still generates the plan
    }
  )

  scenario(
    "does not let one user's plan generation see another user's runs",
    async (scenario: StandardScenario) => {
      mockCurrentUser({
        id: scenario.user.other.id,
        email: scenario.user.other.email,
      })

      // A run at the exact instant the owner's plan would conflict on —
      // but it belongs to a different user, so it must not trigger the
      // overlap guard for `other`.
      const preview = generatePlan({
        goalType: '5k',
        currentWeeklyKm: 0,
        startDate: localDateString(START_DATE, 'UTC'),
        timezone: 'UTC',
      })
      await db.scheduledItem.create({
        data: {
          type: 'RUN',
          title: "Owner's run",
          scheduledAt: preview.blocks[0].sessions[0].scheduledAt,
          status: 'PLANNED',
          userId: scenario.user.owner.id,
        },
      })

      const result = await generateTrainingPlan({
        input: {
          goalType: 'FIVE_K',
          currentWeeklyKm: 0,
          startDate: START_DATE,
        },
      })
      expect(result.blocks.length).toBeGreaterThan(0)
    }
  )
})
