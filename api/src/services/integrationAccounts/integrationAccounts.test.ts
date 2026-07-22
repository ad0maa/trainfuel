// connectStrava does real network I/O via strava.ts and kicks off a
// fire-and-forget backfill — both are mocked here so this suite tests the
// service's own logic (token encryption, upsert, status shape) without
// touching Strava's API.
jest.mock('src/lib/integrations/strava', () => ({
  getStravaAuthUrl: jest.fn(
    (redirectUri: string) =>
      `https://www.strava.com/oauth/authorize?redirect_uri=${redirectUri}`
  ),
  exchangeStravaCode: jest.fn(),
}))
jest.mock('src/services/externalActivities/stravaBackfill', () => ({
  backfillStravaActivitiesForUser: jest.fn(async () => 0),
}))

import { decryptToken } from 'src/lib/crypto'
import { db } from 'src/lib/db'
import { exchangeStravaCode } from 'src/lib/integrations/strava'
import { backfillStravaActivitiesForUser } from 'src/services/externalActivities/stravaBackfill'

import {
  connectStrava,
  integrationStatus,
  stravaConnectUrl,
} from './integrationAccounts.js'
import type { StandardScenario } from './integrationAccounts.scenarios.js'

const mockExchangeStravaCode = exchangeStravaCode as jest.MockedFunction<
  typeof exchangeStravaCode
>
const mockBackfill = backfillStravaActivitiesForUser as jest.MockedFunction<
  typeof backfillStravaActivitiesForUser
>

const originalRedirectUri = process.env.STRAVA_OAUTH_REDIRECT_URI

beforeEach(() => {
  process.env.STRAVA_OAUTH_REDIRECT_URI = 'https://example.com/callback'
  mockExchangeStravaCode.mockReset()
  mockBackfill.mockReset().mockResolvedValue(0)
})

afterAll(() => {
  process.env.STRAVA_OAUTH_REDIRECT_URI = originalRedirectUri
})

describe('stravaConnectUrl', () => {
  scenario(
    'returns the Strava OAuth URL',
    async (scenario: StandardScenario) => {
      mockCurrentUser({
        id: scenario.user.owner.id,
        email: scenario.user.owner.email,
      })
      const url = await stravaConnectUrl()
      expect(url).toContain('https://example.com/callback')
    }
  )
})

describe('connectStrava', () => {
  scenario(
    'exchanges the code, encrypts tokens at rest, and starts a backfill',
    async (scenario: StandardScenario) => {
      mockCurrentUser({
        id: scenario.user.owner.id,
        email: scenario.user.owner.email,
      })
      mockExchangeStravaCode.mockResolvedValue({
        accessToken: 'plaintext-access-token',
        refreshToken: 'plaintext-refresh-token',
        expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
        athleteId: 42,
        scope: 'activity:read_all',
      })

      const result = await connectStrava({ code: 'auth-code-123' })

      expect(result.provider).toBe('STRAVA')
      expect(result.connected).toBe(true)
      expect(result.status).toBe('OK')

      const account = await db.integrationAccount.findUniqueOrThrow({
        where: {
          userId_provider: {
            userId: scenario.user.owner.id,
            provider: 'STRAVA',
          },
        },
      })
      // Never stored in plaintext.
      expect(account.accessToken).not.toBe('plaintext-access-token')
      expect(decryptToken(account.accessToken!)).toBe('plaintext-access-token')
      expect(decryptToken(account.refreshToken!)).toBe(
        'plaintext-refresh-token'
      )
      expect((account.meta as { athleteId: number }).athleteId).toBe(42)

      expect(mockBackfill).toHaveBeenCalledWith(scenario.user.owner.id)
    }
  )

  scenario(
    're-connecting upserts rather than duplicating the account',
    async (scenario: StandardScenario) => {
      mockCurrentUser({
        id: scenario.user.owner.id,
        email: scenario.user.owner.email,
      })
      mockExchangeStravaCode.mockResolvedValue({
        accessToken: 'token-1',
        refreshToken: 'refresh-1',
        expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
        athleteId: 1,
        scope: 'activity:read_all',
      })
      await connectStrava({ code: 'code-1' })

      mockExchangeStravaCode.mockResolvedValue({
        accessToken: 'token-2',
        refreshToken: 'refresh-2',
        expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
        athleteId: 1,
        scope: 'activity:read_all',
      })
      await connectStrava({ code: 'code-2' })

      const count = await db.integrationAccount.count({
        where: { userId: scenario.user.owner.id, provider: 'STRAVA' },
      })
      expect(count).toBe(1)

      const account = await db.integrationAccount.findUniqueOrThrow({
        where: {
          userId_provider: {
            userId: scenario.user.owner.id,
            provider: 'STRAVA',
          },
        },
      })
      expect(decryptToken(account.accessToken!)).toBe('token-2')
    }
  )
})

describe('integrationStatus', () => {
  scenario(
    'reports connected: false when nothing is connected yet',
    async (scenario: StandardScenario) => {
      mockCurrentUser({
        id: scenario.user.owner.id,
        email: scenario.user.owner.email,
      })
      const result = await integrationStatus({ provider: 'STRAVA' })
      expect(result).toEqual({
        provider: 'STRAVA',
        connected: false,
        status: null,
        statusDetail: null,
        lastSyncedAt: null,
      })
    }
  )

  scenario(
    'reports the connected account, scoped to the current user',
    async (scenario: StandardScenario) => {
      await db.integrationAccount.create({
        data: {
          userId: scenario.user.owner.id,
          provider: 'STRAVA',
          accessToken: 'enc-token',
          status: 'OK',
          lastSyncedAt: new Date(),
        },
      })

      mockCurrentUser({
        id: scenario.user.other.id,
        email: scenario.user.other.email,
      })
      const othersView = await integrationStatus({ provider: 'STRAVA' })
      expect(othersView.connected).toBe(false)

      mockCurrentUser({
        id: scenario.user.owner.id,
        email: scenario.user.owner.email,
      })
      const ownersView = await integrationStatus({ provider: 'STRAVA' })
      expect(ownersView.connected).toBe(true)
      expect(ownersView.status).toBe('OK')
    }
  )
})
