import { localDateString, localDayBoundsUtc, addLocalDays } from './localDay.js'

describe('localDateString', () => {
  it('returns the UTC calendar date when timeZone is UTC', () => {
    expect(localDateString(new Date('2026-07-15T03:00:00Z'), 'UTC')).toBe(
      '2026-07-15'
    )
  })

  it('rolls the date forward across the UTC boundary for a positive-offset timezone', () => {
    // Melbourne is UTC+10 (AEST) in July. 23:30 UTC on the 14th is already
    // 09:30 AEST on the 15th.
    expect(
      localDateString(new Date('2026-07-14T23:30:00Z'), 'Australia/Melbourne')
    ).toBe('2026-07-15')
  })

  it('rolls the date backward across the UTC boundary for a negative-offset timezone', () => {
    // Los Angeles is UTC-7 (PDT) in July. 02:00 UTC on the 15th is still
    // 19:00 PDT on the 14th.
    expect(
      localDateString(new Date('2026-07-15T02:00:00Z'), 'America/Los_Angeles')
    ).toBe('2026-07-14')
  })

  it('handles the DST transition correctly (Melbourne: AEDT +11 in Jan, AEST +10 in Jul)', () => {
    // 13:30 UTC on Jan 15 is 00:30 AEDT (+11) on Jan 16.
    expect(
      localDateString(new Date('2026-01-15T13:30:00Z'), 'Australia/Melbourne')
    ).toBe('2026-01-16')
    // 13:30 UTC on Jul 15 is 23:30 AEST (+10) on Jul 15 (no rollover, since +10 not +11).
    expect(
      localDateString(new Date('2026-07-15T13:30:00Z'), 'Australia/Melbourne')
    ).toBe('2026-07-15')
  })
})

describe('localDayBoundsUtc', () => {
  it('UTC timezone: bounds are exactly local midnight to next midnight', () => {
    const { startUtc, endUtc } = localDayBoundsUtc('2026-07-15', 'UTC')
    expect(startUtc.toISOString()).toBe('2026-07-15T00:00:00.000Z')
    expect(endUtc.toISOString()).toBe('2026-07-16T00:00:00.000Z')
  })

  it('Australia/Melbourne (AEST, UTC+10 in July): local midnight is 14:00 UTC the prior day', () => {
    const { startUtc, endUtc } = localDayBoundsUtc(
      '2026-07-15',
      'Australia/Melbourne'
    )
    expect(startUtc.toISOString()).toBe('2026-07-14T14:00:00.000Z')
    expect(endUtc.toISOString()).toBe('2026-07-15T14:00:00.000Z')
  })

  it('Australia/Melbourne (AEDT, UTC+11 in January): local midnight is 13:00 UTC the prior day', () => {
    const { startUtc, endUtc } = localDayBoundsUtc(
      '2026-01-15',
      'Australia/Melbourne'
    )
    expect(startUtc.toISOString()).toBe('2026-01-14T13:00:00.000Z')
    expect(endUtc.toISOString()).toBe('2026-01-15T13:00:00.000Z')
  })

  it('round-trips with localDateString: any instant inside the bounds maps back to the same date string', () => {
    const { startUtc, endUtc } = localDayBoundsUtc(
      '2026-07-15',
      'Australia/Melbourne'
    )
    expect(localDateString(startUtc, 'Australia/Melbourne')).toBe('2026-07-15')
    // last millisecond before endUtc
    expect(
      localDateString(new Date(endUtc.getTime() - 1), 'Australia/Melbourne')
    ).toBe('2026-07-15')
    // endUtc itself belongs to the next day
    expect(localDateString(endUtc, 'Australia/Melbourne')).toBe('2026-07-16')
  })
})

describe('addLocalDays', () => {
  it('adds days within a month', () => {
    expect(addLocalDays('2026-07-15', 1)).toBe('2026-07-16')
    expect(addLocalDays('2026-07-15', 14)).toBe('2026-07-29')
  })

  it('rolls over month and year boundaries', () => {
    expect(addLocalDays('2026-07-31', 1)).toBe('2026-08-01')
    expect(addLocalDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('supports negative offsets', () => {
    expect(addLocalDays('2026-07-01', -1)).toBe('2026-06-30')
  })
})
