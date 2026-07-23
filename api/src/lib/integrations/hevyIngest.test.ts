import { normalizeHevyActivity } from './hevyIngest'
import type { RawHevyWorkout } from './hevyIngest'

function workout(overrides: Partial<RawHevyWorkout> = {}): RawHevyWorkout {
  return {
    id: 'b459cba5-cd6d-463c-abd6-54f8eafcadcb',
    title: 'Leg Day',
    start_time: '2026-07-20T09:00:00Z',
    end_time: '2026-07-20T09:45:00Z',
    exercises: [
      {
        index: 0,
        title: 'Leg Press',
        exercise_template_id: '05293BCA',
        supersets_id: null,
        sets: [
          {
            index: 0,
            type: 'normal',
            weight_kg: 100,
            reps: 10,
            distance_meters: null,
            duration_seconds: null,
            rpe: 8,
            custom_metric: null,
          },
          {
            index: 1,
            type: 'normal',
            weight_kg: 110,
            reps: 8,
            rpe: 9,
          },
        ],
      },
    ],
    ...overrides,
  }
}

describe('normalizeHevyActivity', () => {
  it('always tags source as HEVY and activityType as strength', () => {
    const result = normalizeHevyActivity(workout())
    expect(result.source).toBe('HEVY')
    expect(result.activityType).toBe('strength')
  })

  it('carries the externalId as a string', () => {
    expect(normalizeHevyActivity(workout({ id: 'abc-123' })).externalId).toBe(
      'abc-123'
    )
  })

  it('parses start_time into a Date', () => {
    const result = normalizeHevyActivity(
      workout({ start_time: '2026-07-20T09:00:00Z' })
    )
    expect(result.startedAt).toEqual(new Date('2026-07-20T09:00:00Z'))
  })

  it('computes durationSec from start_time/end_time', () => {
    const result = normalizeHevyActivity(
      workout({
        start_time: '2026-07-20T09:00:00Z',
        end_time: '2026-07-20T09:45:00Z',
      })
    )
    expect(result.durationSec).toBe(45 * 60)
  })

  it('is null duration when end_time is absent', () => {
    const result = normalizeHevyActivity(
      workout({ start_time: '2026-07-20T09:00:00Z', end_time: undefined })
    )
    expect(result.durationSec).toBeNull()
  })

  it('is null duration when end_time is before start_time (malformed data)', () => {
    const result = normalizeHevyActivity(
      workout({
        start_time: '2026-07-20T09:00:00Z',
        end_time: '2026-07-20T08:00:00Z',
      })
    )
    expect(result.durationSec).toBeNull()
  })

  it('always sets distanceM and energyKcal to null — Hevy reports neither', () => {
    const result = normalizeHevyActivity(workout())
    expect(result.distanceM).toBeNull()
    expect(result.energyKcal).toBeNull()
  })

  it('preserves the full raw payload', () => {
    const raw = workout({ description: 'Felt strong today' })
    expect(normalizeHevyActivity(raw).raw).toEqual(raw)
  })

  it('normalizes exercises: title → name, index → order, sets mapped and camelCased', () => {
    const result = normalizeHevyActivity(workout())
    expect(result.exercises).toEqual([
      {
        name: 'Leg Press',
        order: 0,
        sets: [
          {
            index: 0,
            type: 'normal',
            weightKg: 100,
            reps: 10,
            distanceMeters: null,
            durationSeconds: null,
            rpe: 8,
            customMetric: null,
          },
          {
            index: 1,
            type: 'normal',
            weightKg: 110,
            reps: 8,
            distanceMeters: null,
            durationSeconds: null,
            rpe: 9,
            customMetric: null,
          },
        ],
      },
    ])
  })

  it('handles a workout with no exercises', () => {
    const result = normalizeHevyActivity(workout({ exercises: undefined }))
    expect(result.exercises).toEqual([])
  })

  it('preserves exercise order across multiple exercises', () => {
    const result = normalizeHevyActivity(
      workout({
        exercises: [
          { index: 1, title: 'Squat', sets: [] },
          { index: 0, title: 'Bench Press', sets: [] },
        ],
      })
    )
    expect(result.exercises.map((e) => [e.order, e.name])).toEqual([
      [1, 'Squat'],
      [0, 'Bench Press'],
    ])
  })
})
