// SPEC.md §3.6's security note, deferred from M0/M2 to M3 (the first
// milestone that actually writes a token — Strava OAuth). Encrypts
// IntegrationAccount.accessToken/refreshToken/apiKey at rest with
// AES-256-GCM. TOKEN_ENCRYPTION_KEY (.env.example) is a 32-byte key,
// base64-encoded.

import crypto from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
// 96-bit IV is the size AES-GCM is designed and NIST-recommended for —
// using anything else forces a slower internal derivation step for no
// benefit here.
const IV_LENGTH_BYTES = 12

function getKey(): Buffer {
  const keyB64 = process.env.TOKEN_ENCRYPTION_KEY
  if (!keyB64) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY is not set — required to encrypt/decrypt IntegrationAccount tokens. ' +
        'See .env.example for how to generate one.'
    )
  }
  const key = Buffer.from(keyB64, 'base64')
  if (key.length !== 32) {
    throw new Error(
      `TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes for AES-256-GCM, got ${key.length}.`
    )
  }
  return key
}

/**
 * Encrypts `plaintext` into a single string safe to store in a text column:
 * `base64(iv):base64(authTag):base64(ciphertext)`. Never returns the same
 * ciphertext twice for the same input (fresh random IV every call) — do not
 * rely on encrypted values for equality checks.
 */
export function encryptToken(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(IV_LENGTH_BYTES)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()
  return [iv, authTag, ciphertext]
    .map((buf) => buf.toString('base64'))
    .join(':')
}

/**
 * Reverses `encryptToken`. Throws (rather than returning garbage) if the
 * value is malformed, the wrong key is used, or the ciphertext/auth tag has
 * been tampered with — GCM's authentication check makes tamper-detection
 * automatic.
 */
export function decryptToken(stored: string): string {
  const key = getKey()
  const parts = stored.split(':')
  if (parts.length !== 3) {
    throw new Error(
      'decryptToken: malformed encrypted value (expected "iv:authTag:ciphertext").'
    )
  }
  const [ivB64, authTagB64, ciphertextB64] = parts
  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(authTagB64, 'base64')
  const ciphertext = Buffer.from(ciphertextB64, 'base64')

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])
  return plaintext.toString('utf8')
}
