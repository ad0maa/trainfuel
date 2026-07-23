import { hashPassword } from '@cedarjs/auth-dbauth-api'

export const PLAINTEXT_PASSWORD = 'correct-horse-battery-staple'

const [hashedPassword, salt] = hashPassword(PLAINTEXT_PASSWORD)

export const standard = defineScenario<{ data: any }, string, string>({
  user: {
    mobileUser: {
      data: {
        email: 'mobileuser@example.com',
        hashedPassword,
        salt,
      },
    },
  },
})

export type StandardScenario = {
  user: Record<'mobileUser', { id: string; email: string }>
}
