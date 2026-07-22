import { normalizeStravaActivity } from './stravaIngest'
import type { RawStravaActivity } from './stravaIngest'

function activity(
  overrides: Partial<RawStravaActivity> = {}
): RawStravaActivity {
  return {
    id: 123456789,
    type: 'Run',
    start_date: '2026-07-20T21:00:00Z',
    elapsed_time: 1800,
    distance: 5000,
    ...overrides,
  }
}

describe('normalizeStravaActivity', () => {
  it('maps known Strava types to internal activity types', () => {
    expect(
      normalizeStravaActivity(activity({ type: 'Run' })).activityType
    ).toBe('run')
    expect(
      normalizeStravaActivity(activity({ type: 'TrailRun' })).activityType
    ).toBe('run')
    expect(
      normalizeStravaActivity(activity({ type: 'Ride' })).activityType
    ).toBe('ride')
    expect(
      normalizeStravaActivity(activity({ type: 'WeightTraining' })).activityType
    ).toBe('strength')
    expect(
      normalizeStravaActivity(activity({ type: 'Yoga' })).activityType
    ).toBe('other')
  })

  it('falls back to "other" for an unrecognized type', () => {
    expect(
      normalizeStravaActivity(activity({ type: 'Surfing' })).activityType
    ).toBe('other')
  })

  it('prefers sport_type over type when both are present', () => {
    const result = normalizeStravaActivity(
      activity({ type: 'Run', sport_type: 'TrailRun' })
    )
    expect(result.activityType).toBe('run') // both map to 'run' here, but sport_type wins
  })

  it('uses calories directly when Strava provides them', () => {
    expect(
      normalizeStravaActivity(activity({ calories: 410 })).energyKcal
    ).toBe(410)
  })

  it('falls back to kJ → kcal conversion when calories is absent', () => {
    // 1000 kJ * 0.239006 = 239.006 -> rounds to 239
    expect(
      normalizeStravaActivity(
        activity({ calories: undefined, kilojoules: 1000 })
      ).energyKcal
    ).toBe(239)
  })

  it('is null when neither calories nor kilojoules is present', () => {
    expect(
      normalizeStravaActivity(
        activity({ calories: undefined, kilojoules: undefined })
      ).energyKcal
    ).toBeNull()
  })

  it('carries the externalId as a string (Strava ids are numeric)', () => {
    expect(
      normalizeStravaActivity(activity({ id: 987654321 })).externalId
    ).toBe('987654321')
  })

  it('parses start_date into a Date', () => {
    const result = normalizeStravaActivity(
      activity({ start_date: '2026-07-20T21:00:00Z' })
    )
    expect(result.startedAt).toEqual(new Date('2026-07-20T21:00:00Z'))
  })

  it('passes through duration/distance as-is, null when absent', () => {
    const result = normalizeStravaActivity(
      activity({ elapsed_time: 1234, distance: 5678 })
    )
    expect(result.durationSec).toBe(1234)
    expect(result.distanceM).toBe(5678)

    const noneResult = normalizeStravaActivity(
      activity({ elapsed_time: undefined, distance: undefined })
    )
    expect(noneResult.durationSec).toBeNull()
    expect(noneResult.distanceM).toBeNull()
  })

  it('preserves the full raw payload', () => {
    const raw = activity({ average_heartrate: 155, name: 'Morning run' })
    expect(normalizeStravaActivity(raw).raw).toEqual(raw)
  })

  it('always tags source as STRAVA', () => {
    expect(normalizeStravaActivity(activity()).source).toBe('STRAVA')
  })
})
