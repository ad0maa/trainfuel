// Pure normalizer: raw Strava activity JSON → the shape an ExternalActivity
// row needs. Ported from the donor Django repo's `sync/ingest.py` (its type
// map and kJ→kcal fallback) — see CONSOLIDATION_PLAN.md Phase 2.
//
// Deliberately NOT ported: the donor's fuzzy cross-source dedup (±60s start
// time / 10% duration tolerance, used to de-duplicate the same run reported
// by both Strava and HealthKit). SPEC.md defers cross-source reconciliation
// to v2; v1's dedup is the `@@unique([source, externalId])` constraint the
// caller upserts on, which this module has no need to know about (no DB
// access here at all — the service layer does the upsert).

/**
 * Prefers `sport_type` (Strava's newer, more granular field) over the older
 * `type` when both are present — a minor improvement over the donor, which
 * only read `type`. The values that matter for this map (Run, Ride, Swim,
 * ...) are identical between the two fields, so this is purely
 * forward-compatible, not a behavioural change for existing data.
 */
export const STRAVA_TYPE_MAP: Record<string, string> = {
  Run: 'run',
  VirtualRun: 'run',
  TrailRun: 'run',
  Ride: 'ride',
  VirtualRide: 'ride',
  MountainBikeRide: 'ride',
  Swim: 'swim',
  Walk: 'walk',
  Hike: 'hike',
  WeightTraining: 'strength',
  CrossFit: 'strength',
  Workout: 'other',
  Yoga: 'other',
  Elliptical: 'other',
  Rowing: 'other',
}

/** Strava reports energy in kJ when `calories` isn't present; kJ → kcal. */
const KJ_TO_KCAL = 0.239006

export interface RawStravaActivity {
  id: number | string
  type?: string
  sport_type?: string
  start_date: string
  elapsed_time?: number
  distance?: number
  calories?: number
  kilojoules?: number
  average_heartrate?: number
  max_heartrate?: number
  total_elevation_gain?: number
  name?: string
  [key: string]: unknown
}

export interface NormalizedStravaActivity {
  source: 'STRAVA'
  externalId: string
  activityType: string
  startedAt: Date
  durationSec: number | null
  distanceM: number | null
  /** Rounded to the nearest whole kcal — provider-reported, raw (device haircut applied at calc time, not here). */
  energyKcal: number | null
  raw: RawStravaActivity
}

export function normalizeStravaActivity(
  data: RawStravaActivity
): NormalizedStravaActivity {
  let energyKcal: number | null = null
  if (typeof data.calories === 'number') {
    energyKcal = Math.round(data.calories)
  } else if (typeof data.kilojoules === 'number') {
    energyKcal = Math.round(data.kilojoules * KJ_TO_KCAL)
  }

  const rawType = data.sport_type ?? data.type ?? ''

  return {
    source: 'STRAVA',
    externalId: String(data.id),
    activityType: STRAVA_TYPE_MAP[rawType] ?? 'other',
    startedAt: new Date(data.start_date),
    durationSec: data.elapsed_time ?? null,
    distanceM: data.distance ?? null,
    energyKcal,
    raw: data,
  }
}
