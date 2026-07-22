// SPEC.md §4.1: Strava OAuth + activity fetch. Ported from the donor Django
// repo's `sync/strava.py` (`StravaClient`) — same shape (getAuthUrl,
// exchangeCode, listActivities, getActivity), token refresh handled
// transparently before every API call, in the client rather than callers.
// See CONSOLIDATION_PLAN.md Phase 2 / DECISIONS.md "M3".
//
// This module does real network I/O (fetch), so — matching this codebase's
// existing pure-core/thin-shell split (e.g. scripts/seedAfcd.ts's fetch
// wrapper vs. its unit-tested pure parser) — only the decision logic
// (computeBackoffDelayMs, isTokenExpiringSoon, getStravaAuthUrl) is unit
// tested directly; the fetch wrappers themselves are thin and untested,
// consistent with that precedent.

const AUTH_URL = 'https://www.strava.com/oauth/authorize'
const TOKEN_URL = 'https://www.strava.com/oauth/token'
const API_BASE = 'https://www.strava.com/api/v3'

const MAX_RETRIES = 3
const BASE_BACKOFF_MS = 1000
// Refresh proactively (SPEC.md §4.1) rather than waiting for a 401 —
// margin covers clock skew and the time between checking and using the token.
const REFRESH_MARGIN_MS = 60_000

// Two small named helpers rather than one `requireEnv(name: string)` —
// dynamic `process.env[name]` bracket access breaks static env-var inlining
// in production bundlers (Vercel's build included); dot-notation access to
// a literal name is required. See DECISIONS.md "M3".
function requireStravaClientId(): string {
  const value = process.env.STRAVA_CLIENT_ID
  if (!value) {
    throw new Error('STRAVA_CLIENT_ID is not set — see .env.example.')
  }
  return value
}

function requireStravaClientSecret(): string {
  const value = process.env.STRAVA_CLIENT_SECRET
  if (!value) {
    throw new Error('STRAVA_CLIENT_SECRET is not set — see .env.example.')
  }
  return value
}

export interface StravaTokenSet {
  accessToken: string
  refreshToken: string
  expiresAt: Date
}

export interface StravaAuthResult extends StravaTokenSet {
  athleteId: number
  scope: string
}

/** Pure — no network. Where the web app sends the user to authorize this app. */
export function getStravaAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: requireStravaClientId(),
    redirect_uri: redirectUri,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'activity:read_all',
  })
  return `${AUTH_URL}?${params.toString()}`
}

/** Pure. True once `expiresAt` is within `REFRESH_MARGIN_MS` of `now` (or already past). */
export function isTokenExpiringSoon(
  expiresAt: Date,
  now: Date = new Date()
): boolean {
  return expiresAt.getTime() - now.getTime() <= REFRESH_MARGIN_MS
}

/**
 * Pure. Strava rate-limits are per-15-min and daily (SPEC.md §4.1) — on a
 * 429, prefer the server's own `Retry-After` header when present, else back
 * off exponentially (1s, 2s, 4s). Returns `null` once `attempt` has
 * exhausted `MAX_RETRIES`, signalling "give up."
 */
export function computeBackoffDelayMs(
  attempt: number,
  retryAfterHeader: string | null
): number | null {
  if (attempt >= MAX_RETRIES) {
    return null
  }
  if (retryAfterHeader) {
    const seconds = Number(retryAfterHeader)
    if (Number.isFinite(seconds) && seconds >= 0) {
      return seconds * 1000
    }
  }
  return BASE_BACKOFF_MS * 2 ** attempt
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function stravaFetch(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, init)
    if (response.status !== 429) {
      return response
    }
    const delayMs = computeBackoffDelayMs(
      attempt,
      response.headers.get('Retry-After')
    )
    if (delayMs === null) {
      return response // give up — let the caller surface the 429
    }
    await sleep(delayMs)
  }
}

function tokenSetFromResponse(data: {
  access_token: string
  refresh_token: string
  expires_at: number
}): StravaTokenSet {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(data.expires_at * 1000),
  }
}

/**
 * Exchanges an OAuth `code` (from the redirect) for a token set + athlete
 * id. No `redirectUri` param — unlike `getStravaAuthUrl`, Strava's token
 * endpoint doesn't require it to be re-sent for the code exchange (the
 * donor's implementation confirms this too).
 */
export async function exchangeStravaCode(
  code: string
): Promise<StravaAuthResult> {
  const response = await stravaFetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: requireStravaClientId(),
      client_secret: requireStravaClientSecret(),
      code,
      grant_type: 'authorization_code',
    }),
  })
  if (!response.ok) {
    throw new Error(
      `Strava token exchange failed: ${response.status} ${await response.text()}`
    )
  }
  const data = await response.json()
  return {
    ...tokenSetFromResponse(data),
    athleteId: data.athlete?.id,
    scope: data.scope ?? '',
  }
}

/** Uses the refresh token to obtain a fresh token set (Strava rotates refresh tokens too). */
export async function refreshStravaTokens(
  refreshToken: string
): Promise<StravaTokenSet> {
  const response = await stravaFetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: requireStravaClientId(),
      client_secret: requireStravaClientSecret(),
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!response.ok) {
    throw new Error(
      `Strava token refresh failed: ${response.status} ${await response.text()}`
    )
  }
  return tokenSetFromResponse(await response.json())
}

/** Returns `tokens` unchanged if still valid, else refreshes and returns the new set. */
export async function ensureFreshStravaTokens(
  tokens: StravaTokenSet
): Promise<StravaTokenSet> {
  if (!isTokenExpiringSoon(tokens.expiresAt)) {
    return tokens
  }
  return refreshStravaTokens(tokens.refreshToken)
}

async function stravaApiGet(
  accessToken: string,
  path: string
): Promise<unknown> {
  const response = await stravaFetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    throw new Error(
      `Strava API request failed: ${response.status} ${await response.text()}`
    )
  }
  return response.json()
}

export interface ListStravaActivitiesOptions {
  /** Unix timestamp (seconds) — only activities after this time. Used for backfill windowing. */
  after?: number
  page?: number
  perPage?: number
}

/** Raw Strava activity summaries (SPEC.md §4.1: last 30 days on first connect, not full history). */
export async function listStravaActivities(
  accessToken: string,
  { after, page = 1, perPage = 50 }: ListStravaActivitiesOptions = {}
): Promise<unknown[]> {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  })
  if (after) {
    params.set('after', String(after))
  }
  const result = await stravaApiGet(
    accessToken,
    `/athlete/activities?${params}`
  )
  return result as unknown[]
}

/** Full detail for a single activity (used by the webhook handler). */
export async function getStravaActivity(
  accessToken: string,
  activityId: number | string
): Promise<unknown> {
  return stravaApiGet(accessToken, `/activities/${activityId}`)
}
