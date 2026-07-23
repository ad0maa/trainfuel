import crypto from 'node:crypto'

import { signMobileToken, verifyMobileToken } from './mobileAuthToken'

const SECRET = 'test-secret-do-not-use-in-prod'

describe('signMobileToken / verifyMobileToken', () => {
  const originalSecret = process.env.MOBILE_AUTH_SECRET

  beforeEach(() => {
    process.env.MOBILE_AUTH_SECRET = SECRET
  })

  afterEach(() => {
    process.env.MOBILE_AUTH_SECRET = originalSecret
  })

  it('round-trips a user id', () => {
    const token = signMobileToken('user-123')
    expect(verifyMobileToken(token)).toEqual({ id: 'user-123' })
  })

  it('rejects a token signed with a different secret', () => {
    const token = signMobileToken('user-123')
    process.env.MOBILE_AUTH_SECRET = 'a-different-secret'
    expect(verifyMobileToken(token)).toBeNull()
  })

  it('rejects a tampered payload', () => {
    const token = signMobileToken('user-123')
    const [, signature] = token.split('.')
    const forgedPayload = Buffer.from(
      JSON.stringify({
        sub: 'someone-else',
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    ).toString('base64url')
    expect(verifyMobileToken(`${forgedPayload}.${signature}`)).toBeNull()
  })

  it('rejects an expired token', () => {
    const expiredPayloadB64 = Buffer.from(
      JSON.stringify({
        sub: 'user-123',
        exp: Math.floor(Date.now() / 1000) - 10,
      })
    ).toString('base64url')
    // Re-sign the expired payload with the real secret so only the
    // expiry check (not the signature check) is what rejects it.
    const signature = crypto
      .createHmac('sha256', SECRET)
      .update(expiredPayloadB64)
      .digest('base64url')
    expect(verifyMobileToken(`${expiredPayloadB64}.${signature}`)).toBeNull()
  })

  it('rejects malformed tokens', () => {
    expect(verifyMobileToken('not-a-valid-token')).toBeNull()
    expect(verifyMobileToken('')).toBeNull()
  })

  it('throws when MOBILE_AUTH_SECRET is missing', () => {
    delete process.env.MOBILE_AUTH_SECRET
    expect(() => signMobileToken('user-123')).toThrow(
      /MOBILE_AUTH_SECRET is not set/
    )
  })
})
