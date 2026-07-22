import type { User } from 'src/lib/db'

export const standard = defineScenario<{ data: any }, string, string>({
  user: {
    owner: {
      data: {
        email: 'integrationowner@example.com',
        hashedPassword: 'String',
        salt: 'String',
      },
    },
    other: {
      data: {
        email: 'integrationother@example.com',
        hashedPassword: 'String',
        salt: 'String',
      },
    },
  },
})

export type StandardScenario = {
  user: Record<'owner' | 'other', User>
}
