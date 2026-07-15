// SPEC.md §9: "Dates/timezones... All 'day boundary' logic goes through one
// localDay(userId, instant) helper. Timezone bugs are the #1 predicted defect
// class in this app — be paranoid here."
//
// This module has two layers:
//   - Pure functions (localDateString, localDayBoundsUtc) that take an
//     explicit IANA timeZone string. These are unit-testable with no DB.
//   - `localDay(userId, instant)` / `localDayBoundsUtcForUser(userId, instant)`
//     which look up `Profile.timezone` for the given user and delegate to the
//     pure functions. Use these two everywhere "today" / "this local day"
//     logic is needed (Today screen, recurrence materialization, etc.) —
//     never inline `new Date().toDateString()`-style logic.
//
// No date library dependency: `Intl.DateTimeFormat` with an explicit
// `timeZone` already gives correct, DST-aware IANA timezone conversion in
// Node, so we lean on that instead of pulling in date-fns-tz.

import { db } from 'src/lib/db'

export const DEFAULT_TIMEZONE = 'Australia/Melbourne'

/** Y-M-D broken out, as observed in `timeZone` for the given instant. */
export interface LocalDateParts {
  year: number
  month: number // 1-12
  day: number
}

/**
 * Returns the UTC offset, in minutes, of `timeZone` at the given instant.
 * Positive means ahead of UTC (e.g. Australia/Melbourne in DST is +660).
 */
function getOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
  }).formatToParts(instant)

  const offsetPart = parts.find((p) => p.type === 'timeZoneName')?.value

  // "GMT" (no suffix) means UTC+0, e.g. for timeZone: 'UTC'
  if (!offsetPart || offsetPart === 'GMT') {
    return 0
  }

  const match = offsetPart.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/)
  if (!match) {
    return 0
  }

  const sign = match[1] === '-' ? -1 : 1
  const hours = Number(match[2])
  const minutes = match[3] ? Number(match[3]) : 0
  return sign * (hours * 60 + minutes)
}

/** Breaks a UTC instant into the Y-M-D observed in `timeZone`. */
export function localDateParts(
  instant: Date,
  timeZone: string
): LocalDateParts {
  // en-CA formats as YYYY-MM-DD, but we pull individual parts to avoid any
  // locale-string parsing footguns.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)

  const year = Number(parts.find((p) => p.type === 'year')?.value)
  const month = Number(parts.find((p) => p.type === 'month')?.value)
  const day = Number(parts.find((p) => p.type === 'day')?.value)

  return { year, month, day }
}

/** Returns the local calendar day (as `YYYY-MM-DD`) observed in `timeZone` for `instant`. */
export function localDateString(instant: Date, timeZone: string): string {
  const { year, month, day } = localDateParts(instant, timeZone)
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Given a local calendar date (`YYYY-MM-DD`) and an IANA timeZone, returns
 * the `[startUtc, endUtc)` UTC instant range covering that local day
 * (midnight-to-midnight in `timeZone`). DST-safe: converges the UTC offset
 * across the boundary rather than assuming a fixed offset.
 */
export function localDayBoundsUtc(
  dateStr: string,
  timeZone: string
): { startUtc: Date; endUtc: Date } {
  const [year, month, day] = dateStr.split('-').map(Number)
  const naiveUtcMidnight = Date.UTC(year, month - 1, day, 0, 0, 0)

  // Iterate to converge the offset lookup near DST transitions: the offset
  // at the naive guess may not be the offset that actually applies at the
  // resolved instant, so refine once against the previous guess.
  let candidate = naiveUtcMidnight
  for (let i = 0; i < 2; i++) {
    const offsetMin = getOffsetMinutes(new Date(candidate), timeZone)
    candidate = naiveUtcMidnight - offsetMin * 60_000
  }

  const startUtc = new Date(candidate)
  const endUtc = new Date(candidate + 24 * 60 * 60 * 1000)
  return { startUtc, endUtc }
}

/** Adds `days` calendar days to a `YYYY-MM-DD` string (pure string/date-part math, no timeZone needed). */
export function addLocalDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  // Use a UTC-based Date purely as a calendar calculator — no timezone
  // conversion happening here, just Y-M-D arithmetic.
  const d = new Date(Date.UTC(year, month - 1, day))
  d.setUTCDate(d.getUTCDate() + days)
  return (
    `${d.getUTCFullYear()}`.padStart(4, '0') +
    '-' +
    `${d.getUTCMonth() + 1}`.padStart(2, '0') +
    '-' +
    `${d.getUTCDate()}`.padStart(2, '0')
  )
}

async function getUserTimezone(userId: string): Promise<string> {
  const profile = await db.profile.findUnique({
    where: { userId },
    select: { timezone: true },
  })
  return profile?.timezone ?? DEFAULT_TIMEZONE
}

/**
 * The one shared helper for "what local calendar day is `instant` on for
 * this user" — reads `Profile.timezone`, falling back to
 * `DEFAULT_TIMEZONE` if the user has no profile yet.
 */
export async function localDay(userId: string, instant: Date): Promise<string> {
  const timeZone = await getUserTimezone(userId)
  return localDateString(instant, timeZone)
}

/**
 * Convenience wrapper: the `[startUtc, endUtc)` range of the user's local
 * day containing `instant`. Use this to build Prisma `scheduledAt` range
 * queries for "today's items" without duplicating timezone logic.
 */
export async function localDayBoundsUtcForUser(
  userId: string,
  instant: Date
): Promise<{ startUtc: Date; endUtc: Date; dateStr: string }> {
  const timeZone = await getUserTimezone(userId)
  const dateStr = localDateString(instant, timeZone)
  const { startUtc, endUtc } = localDayBoundsUtc(dateStr, timeZone)
  return { startUtc, endUtc, dateStr }
}
