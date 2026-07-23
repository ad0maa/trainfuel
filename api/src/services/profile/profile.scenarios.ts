import type { Profile, User } from 'src/lib/db'

export const standard = defineScenario<{ data: any }, string, string>({
  user: {
    owner: {
      data: {
        email: 'profileowner@example.com',
        hashedPassword: 'String',
        salt: 'String',
      },
    },
    other: {
      data: {
        email: 'profileother@example.com',
        hashedPassword: 'String',
        salt: 'String',
      },
    },
  },
  profile: {
    owner: (scenario: any) => ({
      data: {
        userId: scenario.user.owner.id,
        sex: 'MALE',
        birthDate: '1992-01-01T00:00:00.000Z',
        heightCm: 180,
        timezone: 'Australia/Melbourne',
      },
    }),
  },
})

export type StandardScenario = {
  user: Record<'owner' | 'other', User>
  profile: Record<'owner', Profile>
}
