// Sanity-checks on the static templates themselves. Ported from the donor
// Django repo's `TestPlanTemplateIntegrity` (test_engine.py) — see
// CONSOLIDATION_PLAN.md Phase 1.

import { PLAN_10K, PLAN_21K, PLAN_5K, PLAN_C25K } from './templates'

const DISTANCE_BASED_PLANS = [PLAN_5K, PLAN_10K, PLAN_21K] as const
const ALL_PLANS = [PLAN_C25K, PLAN_5K, PLAN_10K, PLAN_21K] as const

describe('plan template integrity', () => {
  it('c25k has 9 weeks', () => {
    expect(PLAN_C25K).toHaveLength(9)
  })

  it('5k has 12 weeks', () => {
    expect(PLAN_5K).toHaveLength(12)
  })

  it('10k has 16 weeks', () => {
    expect(PLAN_10K).toHaveLength(16)
  })

  it('21k has 20 weeks', () => {
    expect(PLAN_21K).toHaveLength(20)
  })

  it('every week has at least one session', () => {
    for (const plan of ALL_PLANS) {
      for (const week of plan) {
        expect(week.sessions.length).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('week numbers are sequential starting at 1', () => {
    for (const plan of ALL_PLANS) {
      plan.forEach((week, i) => {
        expect(week.weekNo).toBe(i + 1)
      })
    }
  })

  it('5k, 10k and 21k end with a taper phase', () => {
    for (const plan of DISTANCE_BASED_PLANS) {
      expect(plan.at(-1)?.phase).toBe('taper')
    }
  })

  it('c25k ends with a peak phase (no taper — it targets a continuous run, not a race)', () => {
    expect(PLAN_C25K.at(-1)?.phase).toBe('peak')
  })

  it('every c25k session is duration-based', () => {
    for (const week of PLAN_C25K) {
      for (const session of week.sessions) {
        expect(session.targetDurationMin).not.toBeNull()
      }
    }
  })

  it('every distance-based plan session targets a distance, not a duration', () => {
    for (const plan of DISTANCE_BASED_PLANS) {
      for (const week of plan) {
        for (const session of week.sessions) {
          expect(session.targetDistanceKm).not.toBeNull()
          expect(session.targetDurationMin).toBeNull()
        }
      }
    }
  })

  it('recovery weeks have a lower target volume than the week before them', () => {
    for (const plan of DISTANCE_BASED_PLANS) {
      plan.forEach((week, i) => {
        if (week.isRecovery && i > 0) {
          expect(week.targetVolumeKm).toBeLessThan(plan[i - 1].targetVolumeKm)
        }
      })
    }
  })
})
