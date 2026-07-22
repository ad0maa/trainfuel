import { decryptToken, encryptToken } from './crypto'

const VALID_KEY = Buffer.alloc(32, 7).toString('base64')
const OTHER_KEY = Buffer.alloc(32, 9).toString('base64')

describe('encryptToken / decryptToken', () => {
  const originalKey = process.env.TOKEN_ENCRYPTION_KEY

  afterEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY = originalKey
  })

  it('round-trips a plaintext string', () => {
    process.env.TOKEN_ENCRYPTION_KEY = VALID_KEY
    const encrypted = encryptToken('strava-access-token-abc123')
    expect(decryptToken(encrypted)).toBe('strava-access-token-abc123')
  })

  it('never produces the same ciphertext twice for the same plaintext (random IV)', () => {
    process.env.TOKEN_ENCRYPTION_KEY = VALID_KEY
    const a = encryptToken('same-input')
    const b = encryptToken('same-input')
    expect(a).not.toBe(b)
    expect(decryptToken(a)).toBe('same-input')
    expect(decryptToken(b)).toBe('same-input')
  })

  it('throws when decrypting with the wrong key', () => {
    process.env.TOKEN_ENCRYPTION_KEY = VALID_KEY
    const encrypted = encryptToken('secret')
    process.env.TOKEN_ENCRYPTION_KEY = OTHER_KEY
    expect(() => decryptToken(encrypted)).toThrow()
  })

  it('throws on tampered ciphertext (GCM auth tag catches it)', () => {
    process.env.TOKEN_ENCRYPTION_KEY = VALID_KEY
    const encrypted = encryptToken('secret')
    const [iv, authTag, ciphertext] = encrypted.split(':')
    const tampered = [
      iv,
      authTag,
      Buffer.from('tampered!!!!').toString('base64') + ciphertext.slice(0, 4),
    ].join(':')
    expect(() => decryptToken(tampered)).toThrow()
  })

  it('throws on a malformed stored value', () => {
    process.env.TOKEN_ENCRYPTION_KEY = VALID_KEY
    expect(() => decryptToken('not-the-right-format')).toThrow(/malformed/)
  })

  it('throws when TOKEN_ENCRYPTION_KEY is missing', () => {
    delete process.env.TOKEN_ENCRYPTION_KEY
    expect(() => encryptToken('secret')).toThrow(
      /TOKEN_ENCRYPTION_KEY is not set/
    )
  })

  it('throws when TOKEN_ENCRYPTION_KEY is the wrong length', () => {
    process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(16, 1).toString('base64')
    expect(() => encryptToken('secret')).toThrow(/32 bytes/)
  })
})
