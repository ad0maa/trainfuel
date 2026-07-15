import type { TrainingBlock } from 'src/lib/db'

import {
  trainingBlocks,
  trainingBlock,
  createTrainingBlock,
  updateTrainingBlock,
  deleteTrainingBlock,
} from './trainingBlocks.js'
import type { StandardScenario } from './trainingBlocks.scenarios.js'

describe('trainingBlocks', () => {
  scenario(
    'only returns training blocks owned by the current user',
    async (scenario: StandardScenario) => {
      mockCurrentUser({
        id: scenario.trainingBlock.one.userId,
        email: 'unused@example.com',
      })

      const result = (await trainingBlocks()) as TrainingBlock[]

      expect(result.length).toEqual(1)
      expect(result[0].id).toEqual(scenario.trainingBlock.one.id)
    }
  )

  scenario(
    'returns a single trainingBlock owned by the current user',
    async (scenario: StandardScenario) => {
      mockCurrentUser({
        id: scenario.trainingBlock.one.userId,
        email: 'unused@example.com',
      })

      const result = (await trainingBlock({
        id: scenario.trainingBlock.one.id,
      })) as TrainingBlock | null

      expect(result?.id).toEqual(scenario.trainingBlock.one.id)
    }
  )

  scenario(
    'returns null for a trainingBlock owned by a different user',
    async (scenario: StandardScenario) => {
      mockCurrentUser({
        id: scenario.trainingBlock.two.userId,
        email: 'unused@example.com',
      })

      const result = await trainingBlock({ id: scenario.trainingBlock.one.id })

      expect(result).toBeNull()
    }
  )

  scenario(
    'creates a trainingBlock scoped to the current user (ignores any client-supplied userId)',
    async (scenario: StandardScenario) => {
      mockCurrentUser({
        id: scenario.trainingBlock.one.userId,
        email: 'unused@example.com',
      })

      const result = (await createTrainingBlock({
        input: {
          name: 'Marathon Build',
          phase: 'BUILD',
          startDate: '2026-09-01T00:00:00.000Z',
          endDate: '2026-11-01T00:00:00.000Z',
        },
      })) as TrainingBlock

      expect(result.userId).toEqual(scenario.trainingBlock.one.userId)
      expect(result.name).toEqual('Marathon Build')
    }
  )

  scenario(
    'updates a trainingBlock owned by the current user',
    async (scenario: StandardScenario) => {
      mockCurrentUser({
        id: scenario.trainingBlock.one.userId,
        email: 'unused@example.com',
      })

      const result = (await updateTrainingBlock({
        id: scenario.trainingBlock.one.id,
        input: { name: 'Renamed block' },
      })) as TrainingBlock

      expect(result.name).toEqual('Renamed block')
    }
  )

  scenario(
    'refuses to update a trainingBlock owned by a different user',
    async (scenario: StandardScenario) => {
      mockCurrentUser({
        id: scenario.trainingBlock.two.userId,
        email: 'unused@example.com',
      })

      await expect(
        updateTrainingBlock({
          id: scenario.trainingBlock.one.id,
          input: { name: 'Hijacked' },
        })
      ).rejects.toThrow('Training block not found')
    }
  )

  scenario(
    'deletes a trainingBlock owned by the current user',
    async (scenario: StandardScenario) => {
      mockCurrentUser({
        id: scenario.trainingBlock.one.userId,
        email: 'unused@example.com',
      })

      const result = (await deleteTrainingBlock({
        id: scenario.trainingBlock.one.id,
      })) as TrainingBlock
      expect(result.id).toEqual(scenario.trainingBlock.one.id)

      const after = await trainingBlock({ id: scenario.trainingBlock.one.id })
      expect(after).toBeNull()
    }
  )

  scenario(
    'refuses to delete a trainingBlock owned by a different user',
    async (scenario: StandardScenario) => {
      mockCurrentUser({
        id: scenario.trainingBlock.two.userId,
        email: 'unused@example.com',
      })

      await expect(
        deleteTrainingBlock({ id: scenario.trainingBlock.one.id })
      ).rejects.toThrow('Training block not found')
    }
  )
})
