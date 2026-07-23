// SPEC.md §2's mobile auth fallback: dbAuth's session is an httpOnly cookie,
// which RN's fetch/Apollo stack doesn't carry the way a browser does — so
// mobile authenticates with a signed bearer token instead. HMAC-SHA256
// (Node's built-in crypto, same "no extra dependency" choice crypto.ts made
// for AES-GCM) rather than a JWT library, since the payload only ever needs
// one claim (`sub`) and an expiry.
//
// Deferred, not forgotten: this is a single long-lived token, no refresh
// token / rotation / revocation list. The donor's Axios app had a real
// access+refresh pair; that's real infra (a revocable-token table) not
// needed for a first working mobile client. Revisit if a stolen/leaked
// token ever becomes a real concern.

import crypto from 'node:crypto'

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days

interface MobileTokenPayload {
  sub: string
  exp: number
}

function getSecret(): string {
  const secret = process.env.MOBILE_AUTH_SECRET
  if (!secret) {
    throw new Error(
      'MOBILE_AUTH_SECRET is not set — required to sign/verify mobile bearer tokens. ' +
        'See .env.example for how to generate one.'
    )
  }
  return secret
}

function sign(payloadB64: string): string {
  return crypto
    .createHmac('sha256', getSecret())
    .update(payloadB64)
    .digest('base64url')
}

export function signMobileToken(userId: string): string {
  const payload: MobileTokenPayload = {
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  }
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${payloadB64}.${sign(payloadB64)}`
}

/**
 * Verifies signature + expiry. Returns the shape `getCurrentUser` expects
 * (`{ id: string }`) or `null` on any failure — never throws, since an
 * invalid/expired token from a client should just mean "not authenticated".
 */
export function verifyMobileToken(token: string): { id: string } | null {
  const parts = token.split('.')
  if (parts.length !== 2) {
    return null
  }
  const [payloadB64, signature] = parts

  const expectedSignature = sign(payloadB64)
  const a = Buffer.from(signature)
  const b = Buffer.from(expectedSignature)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null
  }

  let payload: MobileTokenPayload
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'))
  } catch {
    return null
  }

  if (
    !payload.sub ||
    !payload.exp ||
    payload.exp < Math.floor(Date.now() / 1000)
  ) {
    return null
  }

  return { id: payload.sub }
}
