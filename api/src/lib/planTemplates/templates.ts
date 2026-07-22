// Static plan templates, ported from the donor Django repo
// (`health/backend/apps/plans/templates.py`) per CONSOLIDATION_PLAN.md
// Phase 1 (M2.5). Each plan is a full week-by-week progression from scratch
// to peak; `generatePlan.ts`'s `findEntryWeek` selects the entry week based
// on current fitness. All volumes/descriptions are tunable — the structure
// (base → build → peak → taper, easy/long/tempo/interval session mix) is
// what matters.
//
// No behavioural changes from the donor during translation — see
// DECISIONS.md "M2.5 — Plan generator" for the phase-mapping and anchoring
// decisions layered on top in generatePlan.ts.

export type SessionType = 'walk_run' | 'easy' | 'long' | 'tempo' | 'interval'
export type PlanPhase = 'base' | 'build' | 'peak' | 'taper'
export type GoalType = 'c25k' | '5k' | '10k' | '21k'

export interface TemplateSession {
  /** 1=Mon … 7=Sun */
  day: number
  sessionType: SessionType
  targetDistanceKm: number | null
  targetDurationMin: number | null
  description: string
}

export interface TemplateWeek {
  weekNo: number
  /** 0 for C25K (duration-based, not distance-based) */
  targetVolumeKm: number
  phase: PlanPhase
  isRecovery: boolean
  sessions: readonly TemplateSession[]
}

function s(
  day: number,
  sessionType: SessionType,
  opts: { distKm?: number; durMin?: number; desc: string }
): TemplateSession {
  return {
    day,
    sessionType,
    targetDistanceKm: opts.distKm ?? null,
    targetDurationMin: opts.durMin ?? null,
    description: opts.desc,
  }
}

function w(
  weekNo: number,
  targetVolumeKm: number,
  phase: PlanPhase,
  isRecovery: boolean,
  sessions: readonly TemplateSession[]
): TemplateWeek {
  return { weekNo, targetVolumeKm, phase, isRecovery, sessions }
}

// ---------------------------------------------------------------------------
// C25K — 9 weeks, walk/run intervals → first continuous 5K
// targetVolumeKm is 0 throughout (duration-based, not distance-based)
// ---------------------------------------------------------------------------

export const PLAN_C25K: readonly TemplateWeek[] = [
  w(1, 0, 'base', false, [
    s(1, 'walk_run', {
      durMin: 20,
      desc: 'Alternate 60 s run / 90 s walk × 8',
    }),
    s(3, 'walk_run', {
      durMin: 20,
      desc: 'Alternate 60 s run / 90 s walk × 8',
    }),
    s(6, 'walk_run', {
      durMin: 20,
      desc: 'Alternate 60 s run / 90 s walk × 8',
    }),
  ]),
  w(2, 0, 'base', false, [
    s(1, 'walk_run', { durMin: 20, desc: '90 s run / 2 min walk × 6' }),
    s(3, 'walk_run', { durMin: 20, desc: '90 s run / 2 min walk × 6' }),
    s(6, 'walk_run', { durMin: 20, desc: '90 s run / 2 min walk × 6' }),
  ]),
  w(3, 0, 'base', false, [
    s(1, 'walk_run', {
      durMin: 28,
      desc: '90 s run / 90 s walk, then 3 min run / 3 min walk × 2',
    }),
    s(3, 'walk_run', {
      durMin: 28,
      desc: '90 s run / 90 s walk, then 3 min run / 3 min walk × 2',
    }),
    s(6, 'walk_run', {
      durMin: 28,
      desc: '90 s run / 90 s walk, then 3 min run / 3 min walk × 2',
    }),
  ]),
  w(4, 0, 'build', false, [
    s(1, 'walk_run', {
      durMin: 31,
      desc: '3 min run / 90 s walk / 5 min run / 2.5 min walk / 3 min run / 90 s walk / 5 min run',
    }),
    s(3, 'walk_run', {
      durMin: 31,
      desc: '3 min run / 90 s walk / 5 min run / 2.5 min walk / 3 min run / 90 s walk / 5 min run',
    }),
    s(6, 'walk_run', {
      durMin: 31,
      desc: '3 min run / 90 s walk / 5 min run / 2.5 min walk / 3 min run / 90 s walk / 5 min run',
    }),
  ]),
  w(5, 0, 'build', false, [
    s(1, 'walk_run', { durMin: 28, desc: '5 min run / 3 min walk × 3' }),
    s(3, 'walk_run', {
      durMin: 28,
      desc: '8 min run / 5 min walk / 8 min run',
    }),
    s(6, 'easy', {
      durMin: 20,
      desc: '20 min continuous run — first milestone!',
    }),
  ]),
  w(6, 0, 'build', false, [
    s(1, 'walk_run', { durMin: 30, desc: '5 min run / 3 min walk × 3' }),
    s(3, 'easy', { durMin: 22, desc: '22 min continuous run' }),
    s(6, 'easy', { durMin: 25, desc: '25 min continuous run' }),
  ]),
  w(7, 0, 'peak', false, [
    s(1, 'easy', { durMin: 25, desc: '25 min easy continuous run' }),
    s(3, 'easy', { durMin: 25, desc: '25 min easy continuous run' }),
    s(6, 'easy', { durMin: 25, desc: '25 min easy continuous run' }),
  ]),
  w(8, 0, 'peak', false, [
    s(1, 'easy', { durMin: 28, desc: '28 min easy continuous run' }),
    s(3, 'easy', { durMin: 28, desc: '28 min easy continuous run' }),
    s(6, 'easy', { durMin: 28, desc: '28 min easy continuous run' }),
  ]),
  w(9, 0, 'peak', false, [
    s(1, 'easy', { durMin: 30, desc: '30 min continuous run' }),
    s(3, 'easy', { durMin: 30, desc: '30 min continuous run' }),
    s(6, 'long', {
      durMin: 30,
      desc: "30 min goal-pace run — you've got a 5K!",
    }),
  ]),
] as const

// ---------------------------------------------------------------------------
// 5K — 12 weeks, 12 km/wk → 24 km/wk peak
// ---------------------------------------------------------------------------

export const PLAN_5K: readonly TemplateWeek[] = [
  w(1, 12.0, 'base', false, [
    s(1, 'easy', {
      distKm: 4.0,
      desc: 'Easy 4 km — fully conversational pace',
    }),
    s(3, 'easy', { distKm: 4.0, desc: 'Easy 4 km' }),
    s(6, 'long', { distKm: 4.0, desc: 'Easy long run 4 km' }),
  ]),
  w(2, 14.0, 'base', false, [
    s(1, 'easy', { distKm: 4.0, desc: 'Easy 4 km' }),
    s(3, 'easy', { distKm: 4.0, desc: 'Easy 4 km' }),
    s(6, 'long', { distKm: 6.0, desc: 'Long run 6 km' }),
  ]),
  w(3, 16.0, 'base', false, [
    s(1, 'easy', { distKm: 5.0, desc: 'Easy 5 km' }),
    s(3, 'easy', { distKm: 5.0, desc: 'Easy 5 km' }),
    s(6, 'long', { distKm: 6.0, desc: 'Long run 6 km' }),
  ]),
  w(4, 12.0, 'base', true, [
    s(1, 'easy', {
      distKm: 4.0,
      desc: 'Easy 4 km — recovery week, keep it relaxed',
    }),
    s(3, 'easy', { distKm: 4.0, desc: 'Easy 4 km' }),
    s(6, 'long', { distKm: 4.0, desc: 'Easy 4 km' }),
  ]),
  w(5, 17.0, 'build', false, [
    s(1, 'easy', { distKm: 5.0, desc: 'Easy 5 km' }),
    s(3, 'tempo', {
      distKm: 5.0,
      desc: '5 km with 2 km at comfortably hard (tempo) pace',
    }),
    s(6, 'long', { distKm: 7.0, desc: 'Long run 7 km — slow and steady' }),
  ]),
  w(6, 19.0, 'build', false, [
    s(1, 'easy', { distKm: 5.0, desc: 'Easy 5 km' }),
    s(3, 'tempo', { distKm: 6.0, desc: '6 km with 3 km tempo' }),
    s(6, 'long', { distKm: 8.0, desc: 'Long run 8 km' }),
  ]),
  w(7, 21.0, 'build', false, [
    s(1, 'easy', { distKm: 6.0, desc: 'Easy 6 km' }),
    s(3, 'interval', { distKm: 6.0, desc: '6 km: 4 × 1 km fast / 90 s walk' }),
    s(6, 'long', { distKm: 8.0, desc: 'Long run 8 km' }),
  ]),
  w(8, 16.0, 'build', true, [
    s(1, 'easy', { distKm: 5.0, desc: 'Easy 5 km — recovery week' }),
    s(3, 'easy', { distKm: 5.0, desc: 'Easy 5 km' }),
    s(6, 'long', { distKm: 6.0, desc: 'Easy 6 km' }),
  ]),
  w(9, 22.0, 'peak', false, [
    s(1, 'easy', { distKm: 6.0, desc: 'Easy 6 km' }),
    s(3, 'interval', {
      distKm: 7.0,
      desc: '7 km: 5 × 1 km fast / 90 s recovery',
    }),
    s(6, 'long', { distKm: 9.0, desc: 'Long run 9 km' }),
  ]),
  w(10, 24.0, 'peak', false, [
    s(1, 'easy', { distKm: 7.0, desc: 'Easy 7 km' }),
    s(3, 'interval', {
      distKm: 7.0,
      desc: '7 km: 5 × 1 km at 5K pace / 90 s recovery',
    }),
    s(6, 'long', { distKm: 10.0, desc: 'Long run 10 km' }),
  ]),
  w(11, 24.0, 'peak', false, [
    s(1, 'easy', { distKm: 7.0, desc: 'Easy 7 km' }),
    s(3, 'tempo', { distKm: 7.0, desc: '7 km with 4 km at 5K race pace' }),
    s(6, 'long', { distKm: 10.0, desc: 'Long run 10 km — final big effort' }),
  ]),
  w(12, 12.0, 'taper', false, [
    s(1, 'easy', { distKm: 4.0, desc: 'Easy shakeout 4 km' }),
    s(3, 'easy', { distKm: 3.0, desc: 'Easy 3 km with 2 × 30 s strides' }),
    s(6, 'long', { distKm: 5.0, desc: "5K race — you've trained for this!" }),
  ]),
] as const

// ---------------------------------------------------------------------------
// 10K — 16 weeks, 20 km/wk → 40 km/wk peak
// ---------------------------------------------------------------------------

export const PLAN_10K: readonly TemplateWeek[] = [
  w(1, 20.0, 'base', false, [
    s(1, 'easy', { distKm: 6.0, desc: 'Easy 6 km' }),
    s(3, 'easy', { distKm: 6.0, desc: 'Easy 6 km' }),
    s(6, 'long', { distKm: 8.0, desc: 'Long run 8 km' }),
  ]),
  w(2, 22.0, 'base', false, [
    s(1, 'easy', { distKm: 6.0, desc: 'Easy 6 km' }),
    s(3, 'easy', { distKm: 7.0, desc: 'Easy 7 km' }),
    s(6, 'long', { distKm: 9.0, desc: 'Long run 9 km' }),
  ]),
  w(3, 25.0, 'base', false, [
    s(1, 'easy', { distKm: 7.0, desc: 'Easy 7 km' }),
    s(3, 'easy', { distKm: 8.0, desc: 'Easy 8 km' }),
    s(6, 'long', { distKm: 10.0, desc: 'Long run 10 km' }),
  ]),
  w(4, 18.0, 'base', true, [
    s(1, 'easy', { distKm: 5.0, desc: 'Easy 5 km — recovery week' }),
    s(3, 'easy', { distKm: 6.0, desc: 'Easy 6 km' }),
    s(6, 'long', { distKm: 7.0, desc: 'Easy 7 km' }),
  ]),
  w(5, 27.0, 'build', false, [
    s(1, 'easy', { distKm: 7.0, desc: 'Easy 7 km' }),
    s(3, 'tempo', { distKm: 8.0, desc: '8 km with 4 km tempo' }),
    s(6, 'long', { distKm: 12.0, desc: 'Long run 12 km' }),
  ]),
  w(6, 30.0, 'build', false, [
    s(1, 'easy', { distKm: 8.0, desc: 'Easy 8 km' }),
    s(3, 'tempo', { distKm: 9.0, desc: '9 km with 5 km tempo' }),
    s(6, 'long', { distKm: 13.0, desc: 'Long run 13 km' }),
  ]),
  w(7, 32.0, 'build', false, [
    s(1, 'easy', { distKm: 8.0, desc: 'Easy 8 km' }),
    s(3, 'interval', {
      distKm: 9.0,
      desc: '9 km: 6 × 1 km at 10K pace / 90 s rest',
    }),
    s(6, 'long', { distKm: 14.0, desc: 'Long run 14 km' }),
  ]),
  w(8, 24.0, 'build', true, [
    s(1, 'easy', { distKm: 6.0, desc: 'Easy 6 km — recovery week' }),
    s(3, 'easy', { distKm: 7.0, desc: 'Easy 7 km' }),
    s(6, 'long', { distKm: 10.0, desc: 'Easy long run 10 km' }),
  ]),
  w(9, 34.0, 'peak', false, [
    s(1, 'easy', { distKm: 9.0, desc: 'Easy 9 km' }),
    s(3, 'interval', {
      distKm: 10.0,
      desc: '10 km: 6 × 1 km at 10K race pace / 90 s rest',
    }),
    s(6, 'long', { distKm: 15.0, desc: 'Long run 15 km' }),
  ]),
  w(10, 36.0, 'peak', false, [
    s(1, 'easy', { distKm: 9.0, desc: 'Easy 9 km' }),
    s(3, 'tempo', { distKm: 11.0, desc: '11 km with 6 km at tempo' }),
    s(6, 'long', { distKm: 16.0, desc: 'Long run 16 km' }),
  ]),
  w(11, 38.0, 'peak', false, [
    s(1, 'easy', { distKm: 10.0, desc: 'Easy 10 km' }),
    s(3, 'interval', {
      distKm: 11.0,
      desc: '11 km: 8 × 1 km at 10K pace / 90 s rest',
    }),
    s(6, 'long', { distKm: 16.0, desc: 'Long run 16 km' }),
  ]),
  w(12, 28.0, 'peak', true, [
    s(1, 'easy', { distKm: 7.0, desc: 'Easy 7 km — recovery week' }),
    s(3, 'easy', { distKm: 8.0, desc: 'Easy 8 km' }),
    s(6, 'long', { distKm: 12.0, desc: 'Easy long run 12 km' }),
  ]),
  w(13, 40.0, 'peak', false, [
    s(1, 'easy', { distKm: 10.0, desc: 'Easy 10 km' }),
    s(3, 'tempo', { distKm: 12.0, desc: '12 km with 7 km at race pace' }),
    s(6, 'long', { distKm: 17.0, desc: 'Long run 17 km — biggest week' }),
  ]),
  w(14, 38.0, 'peak', false, [
    s(1, 'easy', { distKm: 10.0, desc: 'Easy 10 km' }),
    s(3, 'interval', {
      distKm: 11.0,
      desc: '11 km: 8 × 1 km at race pace / 90 s rest',
    }),
    s(6, 'long', { distKm: 16.0, desc: 'Long run 16 km' }),
  ]),
  w(15, 22.0, 'taper', false, [
    s(1, 'easy', { distKm: 7.0, desc: 'Easy 7 km — taper begins' }),
    s(3, 'interval', {
      distKm: 6.0,
      desc: '6 km: 4 × 1 km at race pace / 90 s rest',
    }),
    s(6, 'long', { distKm: 9.0, desc: 'Easy 9 km' }),
  ]),
  w(16, 14.0, 'taper', false, [
    s(1, 'easy', { distKm: 5.0, desc: 'Easy 5 km shakeout' }),
    s(3, 'easy', { distKm: 3.0, desc: 'Easy 3 km with strides' }),
    s(6, 'long', { distKm: 6.0, desc: '10K race — trust your training!' }),
  ]),
] as const

// ---------------------------------------------------------------------------
// 21.1K — 20 weeks, 30 km/wk → 55 km/wk peak
// ---------------------------------------------------------------------------

export const PLAN_21K: readonly TemplateWeek[] = [
  w(1, 30.0, 'base', false, [
    s(1, 'easy', { distKm: 8.0, desc: 'Easy 8 km' }),
    s(3, 'easy', { distKm: 8.0, desc: 'Easy 8 km' }),
    s(6, 'long', { distKm: 14.0, desc: 'Long run 14 km' }),
  ]),
  w(2, 33.0, 'base', false, [
    s(1, 'easy', { distKm: 9.0, desc: 'Easy 9 km' }),
    s(3, 'easy', { distKm: 9.0, desc: 'Easy 9 km' }),
    s(6, 'long', { distKm: 15.0, desc: 'Long run 15 km' }),
  ]),
  w(3, 36.0, 'base', false, [
    s(1, 'easy', { distKm: 10.0, desc: 'Easy 10 km' }),
    s(3, 'easy', { distKm: 10.0, desc: 'Easy 10 km' }),
    s(6, 'long', { distKm: 16.0, desc: 'Long run 16 km' }),
  ]),
  w(4, 25.0, 'base', true, [
    s(1, 'easy', { distKm: 7.0, desc: 'Easy 7 km — recovery week' }),
    s(3, 'easy', { distKm: 7.0, desc: 'Easy 7 km' }),
    s(6, 'long', { distKm: 11.0, desc: 'Easy long run 11 km' }),
  ]),
  w(5, 38.0, 'build', false, [
    s(1, 'easy', { distKm: 10.0, desc: 'Easy 10 km' }),
    s(3, 'tempo', { distKm: 11.0, desc: '11 km with 6 km at marathon pace' }),
    s(6, 'long', { distKm: 17.0, desc: 'Long run 17 km' }),
  ]),
  w(6, 41.0, 'build', false, [
    s(1, 'easy', { distKm: 11.0, desc: 'Easy 11 km' }),
    s(3, 'tempo', { distKm: 12.0, desc: '12 km with 7 km tempo' }),
    s(6, 'long', { distKm: 18.0, desc: 'Long run 18 km' }),
  ]),
  w(7, 44.0, 'build', false, [
    s(1, 'easy', { distKm: 12.0, desc: 'Easy 12 km' }),
    s(3, 'interval', {
      distKm: 12.0,
      desc: '12 km: 6 × 1.5 km at HM pace / 2 min rest',
    }),
    s(6, 'long', { distKm: 19.0, desc: 'Long run 19 km — longest yet' }),
  ]),
  w(8, 32.0, 'build', true, [
    s(1, 'easy', { distKm: 9.0, desc: 'Easy 9 km — recovery week' }),
    s(3, 'easy', { distKm: 9.0, desc: 'Easy 9 km' }),
    s(6, 'long', { distKm: 14.0, desc: 'Easy long run 14 km' }),
  ]),
  w(9, 46.0, 'peak', false, [
    s(1, 'easy', { distKm: 12.0, desc: 'Easy 12 km' }),
    s(3, 'tempo', { distKm: 13.0, desc: '13 km with 8 km at HM race pace' }),
    s(6, 'long', { distKm: 19.0, desc: 'Long run 19 km' }),
  ]),
  w(10, 48.0, 'peak', false, [
    s(1, 'easy', { distKm: 13.0, desc: 'Easy 13 km' }),
    s(3, 'interval', {
      distKm: 13.0,
      desc: '13 km: 7 × 1.5 km at HM pace / 2 min rest',
    }),
    s(6, 'long', { distKm: 19.0, desc: 'Long run 19 km' }),
  ]),
  w(11, 50.0, 'peak', false, [
    s(1, 'easy', { distKm: 13.0, desc: 'Easy 13 km' }),
    s(3, 'tempo', { distKm: 14.0, desc: '14 km with 9 km at race pace' }),
    s(6, 'long', { distKm: 19.0, desc: 'Long run 19 km — last big long run' }),
  ]),
  w(12, 36.0, 'peak', true, [
    s(1, 'easy', { distKm: 10.0, desc: 'Easy 10 km — final recovery week' }),
    s(3, 'easy', { distKm: 10.0, desc: 'Easy 10 km' }),
    s(6, 'long', { distKm: 16.0, desc: 'Easy long run 16 km' }),
  ]),
  w(13, 52.0, 'peak', false, [
    s(1, 'easy', { distKm: 13.0, desc: 'Easy 13 km' }),
    s(3, 'interval', {
      distKm: 14.0,
      desc: '14 km: 8 × 1 km at 5K pace / 90 s rest',
    }),
    s(6, 'long', { distKm: 19.0, desc: 'Long run 19 km' }),
  ]),
  w(14, 54.0, 'peak', false, [
    s(1, 'easy', { distKm: 14.0, desc: 'Easy 14 km' }),
    s(3, 'tempo', { distKm: 14.0, desc: '14 km with 10 km at race pace' }),
    s(6, 'long', { distKm: 19.0, desc: 'Long run 19 km — peak week done' }),
  ]),
  w(15, 55.0, 'peak', false, [
    s(1, 'easy', { distKm: 14.0, desc: 'Easy 14 km' }),
    s(3, 'interval', {
      distKm: 14.0,
      desc: '14 km: 8 × 1 km at race pace / 90 s rest',
    }),
    s(6, 'long', { distKm: 19.0, desc: 'Long run 19 km' }),
  ]),
  w(16, 40.0, 'peak', true, [
    s(1, 'easy', { distKm: 11.0, desc: 'Easy 11 km — taper starts here' }),
    s(3, 'easy', { distKm: 11.0, desc: 'Easy 11 km' }),
    s(6, 'long', { distKm: 16.0, desc: 'Easy long run 16 km' }),
  ]),
  w(17, 44.0, 'taper', false, [
    s(1, 'easy', { distKm: 11.0, desc: 'Easy 11 km' }),
    s(3, 'tempo', { distKm: 12.0, desc: '12 km with 6 km at race pace' }),
    s(6, 'long', {
      distKm: 18.0,
      desc: 'Last long run 18 km — legs should feel fresh',
    }),
  ]),
  w(18, 32.0, 'taper', false, [
    s(1, 'easy', { distKm: 9.0, desc: 'Easy 9 km' }),
    s(3, 'interval', {
      distKm: 8.0,
      desc: '8 km: 4 × 1 km at race pace / 2 min rest',
    }),
    s(6, 'long', { distKm: 14.0, desc: 'Easy 14 km — keep it relaxed' }),
  ]),
  w(19, 22.0, 'taper', false, [
    s(1, 'easy', { distKm: 7.0, desc: 'Easy 7 km' }),
    s(3, 'easy', { distKm: 5.0, desc: 'Easy 5 km with 4 × 30 s strides' }),
    s(6, 'long', { distKm: 8.0, desc: 'Easy 8 km — protect those legs' }),
  ]),
  w(20, 12.0, 'taper', false, [
    s(1, 'easy', { distKm: 5.0, desc: 'Easy shakeout 5 km' }),
    s(3, 'easy', { distKm: 3.0, desc: 'Easy 3 km with strides' }),
    s(6, 'long', {
      distKm: 4.0,
      desc: "Half marathon race day — you're ready!",
    }),
  ]),
] as const

export const PLAN_TEMPLATES: Record<GoalType, readonly TemplateWeek[]> = {
  c25k: PLAN_C25K,
  '5k': PLAN_5K,
  '10k': PLAN_10K,
  '21k': PLAN_21K,
}
