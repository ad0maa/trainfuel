// SPEC.md §3.3's auto-tick matching engine. Unlike the Strava
// client/ingest modules, this has no donor equivalent — the Django repo
// never built session matching — so it's new code, built directly from the
// six numbered rules in the spec. Kept pure (candidates in, a match
// decision out) per this codebase's established pure-core/thin-shell split;
// api/src/services/externalActivities/ is the DB-touching shell that loads
// candidates and persists the result.

export type MatchConfidence = 'EXACT' | 'FUZZY'

export interface MatchCandidate {
  id: string
  scheduledAt: Date
}

export interface MatchResult {
  scheduledItemId: string
  matchConfidence: MatchConfidence
}

/**
 * SPEC.md §3.3 rules 2–4: given the `PLANNED` same-day, compatible-type
 * candidates for an incoming external activity (the caller has already
 * filtered by user/type/day/status — see `matchExternalActivity`):
 *   - exactly one candidate → EXACT
 *   - multiple candidates → nearest `scheduledAt` to the activity's
 *     `startedAt` → FUZZY (surfaced in the UI as "auto-matched — confirm?")
 *   - zero candidates → no match (the activity stays in the unmatched tray)
 */
export function selectMatch(
  candidates: readonly MatchCandidate[],
  activityStartedAt: Date
): MatchResult | null {
  if (candidates.length === 0) {
    return null
  }
  if (candidates.length === 1) {
    return { scheduledItemId: candidates[0].id, matchConfidence: 'EXACT' }
  }

  let nearest = candidates[0]
  let nearestDiffMs = Math.abs(
    nearest.scheduledAt.getTime() - activityStartedAt.getTime()
  )
  for (const candidate of candidates.slice(1)) {
    const diffMs = Math.abs(
      candidate.scheduledAt.getTime() - activityStartedAt.getTime()
    )
    if (diffMs < nearestDiffMs) {
      nearest = candidate
      nearestDiffMs = diffMs
    }
  }

  return { scheduledItemId: nearest.id, matchConfidence: 'FUZZY' }
}

/**
 * SPEC.md §3.3 rule 1: maps an ExternalActivity's normalized `activityType`
 * (see stravaIngest.ts) to the compatible ScheduledItemType. Only RUN and
 * LIFT are auto-tickable in v1 (a Strava "WeightTraining" activity — Strava
 * covers both runs and lifts, even though Hevy poll/M4 is the primary lift
 * source) — everything else (ride, swim, walk, hike, other) has no
 * matching ScheduledItemType and is left in the unmatched tray.
 */
export function compatibleScheduledItemType(
  activityType: string
): 'RUN' | 'LIFT' | null {
  if (activityType === 'run') return 'RUN'
  if (activityType === 'strength') return 'LIFT'
  return null
}
