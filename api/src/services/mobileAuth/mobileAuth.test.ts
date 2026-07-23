import { AuthenticationError } from '@cedarjs/graphql-server'

import { verifyMobileToken } from 'src/lib/mobileAuthToken'

import { mobileLogin } from './mobileAuth.js'
import { PLAINTEXT_PASSWORD } from './mobileAuth.scenarios.js'
import type { StandardScenario } from './mobileAuth.scenarios.js'

const originalSecret = process.env.MOBILE_AUTH_SECRET

beforeEach(() => {
  process.env.MOBILE_AUTH_SECRET = 'test-secret-do-not-use-in-prod'
})

afterEach(() => {
  process.env.MOBILE_AUTH_SECRET = originalSecret
})

describe('mobileLogin', () => {
  scenario(
    'returns a verifiable token for correct credentials',
    async (scenario: StandardScenario) => {
      const result = await mobileLogin({
        email: scenario.user.mobileUser.email,
        password: PLAINTEXT_PASSWORD,
      })

      expect(result.userId).toEqual(scenario.user.mobileUser.id)
      expect(result.email).toEqual(scenario.user.mobileUser.email)
      expect(verifyMobileToken(result.token)).toEqual({
        id: scenario.user.mobileUser.id,
      })
    }
  )

  scenario('rejects an unknown email', async () => {
    await expect(
      mobileLogin({
        email: 'nobody@example.com',
        password: PLAINTEXT_PASSWORD,
      })
    ).rejects.toThrow(AuthenticationError)
  })

  scenario('rejects the wrong password', async (scenario: StandardScenario) => {
    await expect(
      mobileLogin({
        email: scenario.user.mobileUser.email,
        password: 'not-the-right-password',
      })
    ).rejects.toThrow(AuthenticationError)
  })
})
