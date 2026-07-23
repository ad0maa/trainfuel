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
// connectHevy validates the key via a real network call (getHevyUserInfo)
// and kicks off a fire-and-forget poll — both mocked for the same reason.
jest.mock('src/lib/integrations/hevy', () => ({
  getHevyUserInfo: jest.fn(),
}))
jest.mock('src/services/externalActivities/hevyPoll', () => ({
  pollHevyWorkoutsForUser: jest.fn(async () => ({ updated: 0, deleted: 0 })),
}))

import { decryptToken } from 'src/lib/crypto'
import { db } from 'src/lib/db'
import { getHevyUserInfo } from 'src/lib/integrations/hevy'
import { exchangeStravaCode } from 'src/lib/integrations/strava'
import { pollHevyWorkoutsForUser } from 'src/services/externalActivities/hevyPoll'
import { backfillStravaActivitiesForUser } from 'src/services/externalActivities/stravaBackfill'

import {
  connectHevy,
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
const mockGetHevyUserInfo = getHevyUserInfo as jest.MockedFunction<
  typeof getHevyUserInfo
>
const mockPollHevy = pollHevyWorkoutsForUser as jest.MockedFunction<
  typeof pollHevyWorkoutsForUser
>

const originalRedirectUri = process.env.STRAVA_OAUTH_REDIRECT_URI

beforeEach(() => {
  process.env.STRAVA_OAUTH_REDIRECT_URI = 'https://example.com/callback'
  mockExchangeStravaCode.mockReset()
  mockBackfill.mockReset().mockResolvedValue(0)
  mockGetHevyUserInfo.mockReset()
  mockPollHevy.mockReset().mockResolvedValue({ updated: 0, deleted: 0 })
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

describe('connectHevy', () => {
  scenario(
    'validates the key, encrypts it at rest, and starts a poll',
    async (scenario: StandardScenario) => {
      mockCurrentUser({
        id: scenario.user.owner.id,
        email: scenario.user.owner.email,
      })
      mockGetHevyUserInfo.mockResolvedValue({
        id: 'hevy-user-1',
        name: 'Adam',
        url: 'https://hevy.com/user/adam',
      })

      const result = await connectHevy({ apiKey: 'plaintext-hevy-key' })

      expect(result.provider).toBe('HEVY')
      expect(result.connected).toBe(true)
      expect(result.status).toBe('OK')

      const account = await db.integrationAccount.findUniqueOrThrow({
        where: {
          userId_provider: { userId: scenario.user.owner.id, provider: 'HEVY' },
        },
      })
      // Never stored in plaintext.
      expect(account.apiKey).not.toBe('plaintext-hevy-key')
      expect(decryptToken(account.apiKey!)).toBe('plaintext-hevy-key')
      expect((account.meta as { hevyUserId: string }).hevyUserId).toBe(
        'hevy-user-1'
      )

      expect(mockGetHevyUserInfo).toHaveBeenCalledWith('plaintext-hevy-key')
      expect(mockPollHevy).toHaveBeenCalledWith(scenario.user.owner.id)
    }
  )

  scenario(
    'trims whitespace off the pasted key',
    async (scenario: StandardScenario) => {
      mockCurrentUser({
        id: scenario.user.owner.id,
        email: scenario.user.owner.email,
      })
      mockGetHevyUserInfo.mockResolvedValue({
        id: 'hevy-user-1',
        name: 'Adam',
        url: 'https://hevy.com/user/adam',
      })

      await connectHevy({ apiKey: '  plaintext-hevy-key  \n' })

      expect(mockGetHevyUserInfo).toHaveBeenCalledWith('plaintext-hevy-key')
    }
  )

  it('refuses an empty (or whitespace-only) key without calling the API', async () => {
    await expect(connectHevy({ apiKey: '   ' })).rejects.toThrow(
      /Hevy API key is required/
    )
    expect(mockGetHevyUserInfo).not.toHaveBeenCalled()
  })

  scenario(
    're-connecting upserts rather than duplicating the account',
    async (scenario: StandardScenario) => {
      mockCurrentUser({
        id: scenario.user.owner.id,
        email: scenario.user.owner.email,
      })
      mockGetHevyUserInfo.mockResolvedValue({
        id: 'hevy-user-1',
        name: 'Adam',
        url: 'https://hevy.com/user/adam',
      })
      await connectHevy({ apiKey: 'key-1' })
      await connectHevy({ apiKey: 'key-2' })

      const count = await db.integrationAccount.count({
        where: { userId: scenario.user.owner.id, provider: 'HEVY' },
      })
      expect(count).toBe(1)

      const account = await db.integrationAccount.findUniqueOrThrow({
        where: {
          userId_provider: { userId: scenario.user.owner.id, provider: 'HEVY' },
        },
      })
      expect(decryptToken(account.apiKey!)).toBe('key-2')
    }
  )

  scenario(
    'a rejected (invalid) key never gets persisted',
    async (scenario: StandardScenario) => {
      mockCurrentUser({
        id: scenario.user.owner.id,
        email: scenario.user.owner.email,
      })
      mockGetHevyUserInfo.mockRejectedValue(
        new Error('Hevy API request failed: 401 Unauthorized')
      )

      await expect(connectHevy({ apiKey: 'bad-key' })).rejects.toThrow(/401/)

      const account = await db.integrationAccount.findUnique({
        where: {
          userId_provider: { userId: scenario.user.owner.id, provider: 'HEVY' },
        },
      })
      expect(account).toBeNull()
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
