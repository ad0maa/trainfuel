import { db } from 'src/lib/db'

import { myProfile, saveProfile } from './profile.js'
import type { StandardScenario } from './profile.scenarios.js'

describe('myProfile', () => {
  scenario(
    "returns the current user's profile",
    async (scenario: StandardScenario) => {
      mockCurrentUser({
        id: scenario.user.owner.id,
        email: scenario.user.owner.email,
      })
      const result = await myProfile()
      expect(result?.id).toEqual(scenario.profile.owner.id)
    }
  )

  scenario(
    'returns null for a user who has not onboarded yet',
    async (scenario: StandardScenario) => {
      mockCurrentUser({
        id: scenario.user.other.id,
        email: scenario.user.other.email,
      })
      const result = await myProfile()
      expect(result).toBeNull()
    }
  )
})

describe('saveProfile', () => {
  scenario(
    'creates a profile for a user who has none yet',
    async (scenario: StandardScenario) => {
      mockCurrentUser({
        id: scenario.user.other.id,
        email: scenario.user.other.email,
      })

      const result = await saveProfile({
        input: {
          sex: 'FEMALE',
          birthDate: new Date('1995-06-15'),
          heightCm: 165,
          timezone: 'America/Los_Angeles',
        },
      })

      expect(result.sex).toBe('FEMALE')
      expect(result.heightCm).toBe(165)
      expect(result.timezone).toBe('America/Los_Angeles')

      const stored = await db.profile.findUnique({
        where: { userId: scenario.user.other.id },
      })
      expect(stored).not.toBeNull()
    }
  )

  scenario(
    'updates (not duplicates) an existing profile',
    async (scenario: StandardScenario) => {
      mockCurrentUser({
        id: scenario.user.owner.id,
        email: scenario.user.owner.email,
      })

      const result = await saveProfile({
        input: {
          sex: scenario.profile.owner.sex,
          birthDate: scenario.profile.owner.birthDate,
          heightCm: 182,
          currentWeightKg: 78,
        },
      })

      expect(result.id).toBe(scenario.profile.owner.id) // same row, not a new one
      expect(result.heightCm).toBe(182)
      expect(result.currentWeightKg).toBe(78)

      const count = await db.profile.count({
        where: { userId: scenario.user.owner.id },
      })
      expect(count).toBe(1)
    }
  )

  scenario(
    'defaults activityBaseline and timezone on create when omitted',
    async (scenario: StandardScenario) => {
      mockCurrentUser({
        id: scenario.user.other.id,
        email: scenario.user.other.email,
      })

      const result = await saveProfile({
        input: {
          sex: 'MALE',
          birthDate: new Date('1990-01-01'),
          heightCm: 175,
        },
      })

      expect(result.activityBaseline).toBe('SEDENTARY')
      expect(result.timezone).toBe('Australia/Melbourne')
    }
  )

  scenario(
    'rejects a weeklyWeightDeltaKg outside the safe range',
    async (scenario: StandardScenario) => {
      mockCurrentUser({
        id: scenario.user.owner.id,
        email: scenario.user.owner.email,
      })

      await expect(
        saveProfile({
          input: {
            sex: 'MALE',
            birthDate: new Date('1992-01-01'),
            heightCm: 180,
            weeklyWeightDeltaKg: -2.0, // too aggressive a deficit
          },
        })
      ).rejects.toThrow(/weeklyWeightDeltaKg must be between/)

      await expect(
        saveProfile({
          input: {
            sex: 'MALE',
            birthDate: new Date('1992-01-01'),
            heightCm: 180,
            weeklyWeightDeltaKg: 1.0, // too aggressive a surplus
          },
        })
      ).rejects.toThrow(/weeklyWeightDeltaKg must be between/)
    }
  )

  scenario(
    'accepts a weeklyWeightDeltaKg at the boundary of the safe range',
    async (scenario: StandardScenario) => {
      mockCurrentUser({
        id: scenario.user.owner.id,
        email: scenario.user.owner.email,
      })

      const result = await saveProfile({
        input: {
          sex: 'MALE',
          birthDate: new Date('1992-01-01'),
          heightCm: 180,
          weeklyWeightDeltaKg: -1.0,
        },
      })
      expect(result.weeklyWeightDeltaKg).toBe(-1.0)
    }
  )
})
