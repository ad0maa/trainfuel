// Pure normalizer: raw Hevy workout JSON → the shape ExternalActivity (+
// child ExternalExercise rows) needs. No donor equivalent (the `health`
// Django repo never integrated Hevy) — built directly from Hevy's live
// OpenAPI spec (see hevy.ts's file header for how it was retrieved). See
// CONSOLIDATION_PLAN.md Phase 3+ / DECISIONS.md "M4".
//
// Two things Hevy's API genuinely doesn't give us, confirmed against the
// live `Workout` schema, not assumed:
//   - No calorie/energy field anywhere on a workout or its sets. `energyKcal`
//     is therefore always null for HEVY-sourced ExternalActivity rows — see
//     DECISIONS.md "M4" for the §6.2 exerciseKcal implication.
//   - No activity-type field: Hevy is exclusively a strength-training log, so
//     every workout is normalized to activityType 'strength' unconditionally
//     (matching.ts's `compatibleScheduledItemType('strength') → 'LIFT'`
//     already existed in anticipation of exactly this, per M3's note).

export interface RawHevySet {
  index?: number
  type?: string // 'normal' | 'warmup' | 'dropset' | 'failure'
  weight_kg?: number | null
  reps?: number | null
  distance_meters?: number | null
  duration_seconds?: number | null
  rpe?: number | null
  custom_metric?: number | null
}

export interface RawHevyExercise {
  index: number
  title: string
  notes?: string
  exercise_template_id?: string
  supersets_id?: number | null
  sets?: RawHevySet[]
}

export interface RawHevyWorkout {
  id: string
  title?: string
  routine_id?: string | null
  description?: string | null
  start_time: string
  end_time?: string
  updated_at?: string
  created_at?: string
  exercises?: RawHevyExercise[]
  [key: string]: unknown
}

export interface NormalizedHevySet {
  index: number | null
  type: string | null
  weightKg: number | null
  reps: number | null
  distanceMeters: number | null
  durationSeconds: number | null
  rpe: number | null
  customMetric: number | null
}

export interface NormalizedHevyExercise {
  name: string
  order: number
  sets: NormalizedHevySet[]
}

export interface NormalizedHevyActivity {
  source: 'HEVY'
  externalId: string
  activityType: 'strength'
  startedAt: Date
  durationSec: number | null
  distanceM: null
  energyKcal: null
  raw: RawHevyWorkout
  exercises: NormalizedHevyExercise[]
}

function normalizeSet(set: RawHevySet): NormalizedHevySet {
  return {
    index: set.index ?? null,
    type: set.type ?? null,
    weightKg: set.weight_kg ?? null,
    reps: set.reps ?? null,
    distanceMeters: set.distance_meters ?? null,
    durationSeconds: set.duration_seconds ?? null,
    rpe: set.rpe ?? null,
    customMetric: set.custom_metric ?? null,
  }
}

function normalizeExercise(exercise: RawHevyExercise): NormalizedHevyExercise {
  return {
    name: exercise.title,
    order: exercise.index,
    sets: (exercise.sets ?? []).map(normalizeSet),
  }
}

export function normalizeHevyActivity(
  data: RawHevyWorkout
): NormalizedHevyActivity {
  let durationSec: number | null = null
  if (data.end_time) {
    const diffMs =
      new Date(data.end_time).getTime() - new Date(data.start_time).getTime()
    if (Number.isFinite(diffMs) && diffMs >= 0) {
      durationSec = Math.round(diffMs / 1000)
    }
  }

  return {
    source: 'HEVY',
    externalId: String(data.id),
    activityType: 'strength',
    startedAt: new Date(data.start_time),
    durationSec,
    distanceM: null, // Hevy has no workout-level distance field
    energyKcal: null, // Hevy's API reports no calorie/energy data at all
    raw: data,
    exercises: (data.exercises ?? []).map(normalizeExercise),
  }
}
