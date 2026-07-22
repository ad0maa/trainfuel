import type { Profile, User } from 'src/lib/db'

export const standard = defineScenario<{ data: any }, string, string>({
  user: {
    owner: {
      data: {
        email: 'planowner@example.com',
        hashedPassword: 'String',
        salt: 'String',
      },
    },
    other: {
      data: {
        email: 'planother@example.com',
        hashedPassword: 'String',
        salt: 'String',
      },
    },
  },
  profile: {
    // UTC keeps the plan's Monday-anchoring/07:00-local-time assertions
    // simple in tests (no timezone-offset date-rollover to account for).
    owner: (scenario: any) => ({
      data: {
        userId: scenario.user.owner.id,
        sex: 'MALE',
        birthDate: '1992-01-01T00:00:00.000Z',
        heightCm: 180,
        timezone: 'UTC',
      },
    }),
  },
})

export type StandardScenario = {
  user: Record<'owner' | 'other', User>
  profile: Record<'owner', Profile>
}
