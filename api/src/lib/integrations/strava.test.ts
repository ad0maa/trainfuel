// Only the pure decision logic is unit tested here — see the file header
// comment in strava.ts for why the fetch wrappers themselves aren't.

import {
  computeBackoffDelayMs,
  getStravaAuthUrl,
  isTokenExpiringSoon,
} from './strava'

describe('getStravaAuthUrl', () => {
  const originalClientId = process.env.STRAVA_CLIENT_ID

  afterEach(() => {
    process.env.STRAVA_CLIENT_ID = originalClientId
  })

  it('builds the Strava OAuth URL with the configured client id and redirect uri', () => {
    process.env.STRAVA_CLIENT_ID = 'abc123'
    const url = getStravaAuthUrl('https://example.com/callback')
    const parsed = new URL(url)

    expect(parsed.origin + parsed.pathname).toBe(
      'https://www.strava.com/oauth/authorize'
    )
    expect(parsed.searchParams.get('client_id')).toBe('abc123')
    expect(parsed.searchParams.get('redirect_uri')).toBe(
      'https://example.com/callback'
    )
    expect(parsed.searchParams.get('scope')).toBe('activity:read_all')
  })

  it('throws when STRAVA_CLIENT_ID is not configured', () => {
    delete process.env.STRAVA_CLIENT_ID
    expect(() => getStravaAuthUrl('https://example.com/callback')).toThrow(
      /STRAVA_CLIENT_ID/
    )
  })
})

describe('isTokenExpiringSoon', () => {
  const now = new Date('2026-07-23T12:00:00Z')

  it('is false for a token expiring well in the future', () => {
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000) // +1hr
    expect(isTokenExpiringSoon(expiresAt, now)).toBe(false)
  })

  it('is true for a token that already expired', () => {
    const expiresAt = new Date(now.getTime() - 1000)
    expect(isTokenExpiringSoon(expiresAt, now)).toBe(true)
  })

  it('is true within the refresh margin (60s) of expiry', () => {
    const expiresAt = new Date(now.getTime() + 30_000)
    expect(isTokenExpiringSoon(expiresAt, now)).toBe(true)
  })

  it('is false just outside the refresh margin', () => {
    const expiresAt = new Date(now.getTime() + 61_000)
    expect(isTokenExpiringSoon(expiresAt, now)).toBe(false)
  })
})

describe('computeBackoffDelayMs', () => {
  it('prefers the Retry-After header when present and valid', () => {
    expect(computeBackoffDelayMs(0, '5')).toBe(5000)
  })

  it('falls back to exponential backoff when Retry-After is absent', () => {
    expect(computeBackoffDelayMs(0, null)).toBe(1000)
    expect(computeBackoffDelayMs(1, null)).toBe(2000)
    expect(computeBackoffDelayMs(2, null)).toBe(4000)
  })

  it('ignores a malformed Retry-After header and falls back to exponential backoff', () => {
    expect(computeBackoffDelayMs(0, 'not-a-number')).toBe(1000)
  })

  it('returns null once retries are exhausted, signalling "give up"', () => {
    expect(computeBackoffDelayMs(3, null)).toBeNull()
    expect(computeBackoffDelayMs(3, '5')).toBeNull()
  })
})
