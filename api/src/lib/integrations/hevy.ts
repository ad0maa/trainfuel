// SPEC.md §4.2: Hevy personal-API-key client. Verified against Hevy's live
// public API docs at build time (https://api.hevyapp.com/docs/, embedded
// OpenAPI 3.0 spec extracted from the Swagger UI bundle — no plain
// `openapi.json` route exists, see DECISIONS.md "M4" for how it was
// retrieved) rather than coded from memory, per SPEC.md §9's "verify current
// endpoint paths/shapes... at build time" directive.
//
// Unlike Strava, Hevy has **no OAuth** — auth is a single personal API key
// (Hevy Pro only, minted at https://hevy.com/settings?developer) sent as a
// raw `api-key` header on every request, and there is no token
// expiry/refresh cycle to manage. So this client is deliberately simpler
// than strava.ts: no getAuthUrl/exchangeCode/refresh, just authenticated GET
// wrappers.
//
// Same pure-core/thin-shell split as strava.ts: only the decision logic
// (computeHevyBackoffDelayMs) is unit tested; the fetch wrappers do real
// network I/O and aren't.
//
// v1 is read-only (SPEC.md §4.2). Hevy's API does expose POST /v1/workouts
// and POST/PUT /v1/routines (confirmed in the live spec) for a future v2
// push — no method for either is added here; when that's built, it's a new
// exported function alongside these, not a change to this file's shape.

const API_BASE = 'https://api.hevyapp.com'

const MAX_RETRIES = 3
const BASE_BACKOFF_MS = 1000

/**
 * Pure. Hevy's OpenAPI spec documents no rate-limit values or 429 semantics
 * at all (unlike Strava's documented per-15-min/daily limits) — this mirrors
 * strava.ts's `computeBackoffDelayMs` shape as a conservative safety net in
 * case Hevy does throttle in practice, not because any specific limit was
 * confirmed. Revisit the constants if Hevy ever publishes real numbers.
 */
export function computeHevyBackoffDelayMs(
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

async function hevyFetch(url: string, apiKey: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, {
      headers: { 'api-key': apiKey },
    })
    if (response.status !== 429) {
      return response
    }
    const delayMs = computeHevyBackoffDelayMs(
      attempt,
      response.headers.get('Retry-After')
    )
    if (delayMs === null) {
      return response // give up — let the caller surface the 429
    }
    await sleep(delayMs)
  }
}

async function hevyApiGet(apiKey: string, path: string): Promise<unknown> {
  const response = await hevyFetch(`${API_BASE}${path}`, apiKey)
  if (!response.ok) {
    throw new Error(
      `Hevy API request failed: ${response.status} ${await response.text()}`
    )
  }
  return response.json()
}

export interface HevyUserInfo {
  id: string
  name: string
  url: string
}

/**
 * `GET /v1/user/info` — the cheapest authenticated call Hevy's API exposes.
 * Used at connect time to validate a pasted key before persisting it
 * (a typo'd key would otherwise silently fail on the first poll 15 minutes
 * later rather than surfacing immediately in the Settings UI).
 */
export async function getHevyUserInfo(apiKey: string): Promise<HevyUserInfo> {
  const result = (await hevyApiGet(apiKey, '/v1/user/info')) as {
    data: HevyUserInfo
  }
  return result.data
}

export interface ListHevyWorkoutsOptions {
  page?: number
  /** Max 10 per Hevy's API (default 5) — not configurable beyond that. */
  pageSize?: number
}

export interface PaginatedHevyWorkouts {
  page: number
  page_count: number
  workouts: unknown[]
}

/**
 * `GET /v1/workouts` — plain paginated workout list, **no date filter of any
 * kind** (only `page`/`pageSize`). Kept for parity/manual inspection, but
 * the poll job (hevyPoll.ts) uses `listHevyWorkoutEvents` below instead,
 * since that's the endpoint that actually supports "since last sync."
 */
export async function listHevyWorkouts(
  apiKey: string,
  { page = 1, pageSize = 10 }: ListHevyWorkoutsOptions = {}
): Promise<PaginatedHevyWorkouts> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  })
  return (await hevyApiGet(
    apiKey,
    `/v1/workouts?${params}`
  )) as PaginatedHevyWorkouts
}

export interface ListHevyWorkoutEventsOptions {
  page?: number
  /** Max 10 per Hevy's API (default 5). */
  pageSize?: number
  /** ISO 8601 timestamp; Hevy defaults to the epoch if omitted. */
  since?: string
}

export interface RawHevyWorkoutEvent {
  type: 'updated' | 'deleted'
  workout?: unknown // present when type === 'updated'
  id?: string // present when type === 'deleted'
  deleted_at?: string
}

export interface PaginatedHevyWorkoutEvents {
  page: number
  page_count: number
  events: RawHevyWorkoutEvent[]
}

/**
 * `GET /v1/workouts/events?since=...` — "a paged list of workout events
 * (updates or deletes) since a given date... to allow clients to keep their
 * local cache of workouts up to date without having to fetch the entire
 * list of workouts" (Hevy's own docs description). This is the endpoint
 * SPEC.md §4.2 anticipated as "since-last-sync using... a stored
 * cursor/timestamp" — `/v1/workouts` itself has no such parameter. Events
 * are ordered newest → oldest per Hevy's docs.
 */
export async function listHevyWorkoutEvents(
  apiKey: string,
  { page = 1, pageSize = 10, since }: ListHevyWorkoutEventsOptions = {}
): Promise<PaginatedHevyWorkoutEvents> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  })
  if (since) {
    params.set('since', since)
  }
  return (await hevyApiGet(
    apiKey,
    `/v1/workouts/events?${params}`
  )) as PaginatedHevyWorkoutEvents
}
