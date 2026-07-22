import { compatibleScheduledItemType, selectMatch } from './matching'
import type { MatchCandidate } from './matching'

describe('selectMatch', () => {
  const activityStartedAt = new Date('2026-07-20T21:00:00Z')

  it('returns null when there are no candidates (rule 4: unmatched)', () => {
    expect(selectMatch([], activityStartedAt)).toBeNull()
  })

  it('returns EXACT for exactly one candidate (rule 2)', () => {
    const candidates: MatchCandidate[] = [
      { id: 'a', scheduledAt: new Date('2026-07-20T21:05:00Z') },
    ]
    expect(selectMatch(candidates, activityStartedAt)).toEqual({
      scheduledItemId: 'a',
      matchConfidence: 'EXACT',
    })
  })

  it('returns FUZZY for the nearest of multiple candidates (rule 3)', () => {
    const candidates: MatchCandidate[] = [
      { id: 'far', scheduledAt: new Date('2026-07-20T06:00:00Z') },
      { id: 'near', scheduledAt: new Date('2026-07-20T21:10:00Z') },
      { id: 'farther', scheduledAt: new Date('2026-07-20T23:00:00Z') },
    ]
    expect(selectMatch(candidates, activityStartedAt)).toEqual({
      scheduledItemId: 'near',
      matchConfidence: 'FUZZY',
    })
  })

  it('picks the earlier candidate on an exact tie in distance', () => {
    const candidates: MatchCandidate[] = [
      { id: 'before', scheduledAt: new Date('2026-07-20T20:00:00Z') }, // -1hr
      { id: 'after', scheduledAt: new Date('2026-07-20T22:00:00Z') }, // +1hr
    ]
    // Tie-break is arbitrary but deterministic (first-seen wins, no `<=`);
    // pinning it down guards against an accidental behaviour change.
    expect(selectMatch(candidates, activityStartedAt)?.scheduledItemId).toBe(
      'before'
    )
  })
})

describe('compatibleScheduledItemType', () => {
  it('maps run to RUN', () => {
    expect(compatibleScheduledItemType('run')).toBe('RUN')
  })

  it('maps strength to LIFT', () => {
    expect(compatibleScheduledItemType('strength')).toBe('LIFT')
  })

  it('has no match for ride/swim/walk/hike/other', () => {
    for (const type of ['ride', 'swim', 'walk', 'hike', 'other']) {
      expect(compatibleScheduledItemType(type)).toBeNull()
    }
  })
})
