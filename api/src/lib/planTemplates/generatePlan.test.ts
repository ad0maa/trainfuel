// findEntryWeek/checkFeasibility cases are ported 1:1 from the donor Django
// repo's test_engine.py (TestFindEntryWeek, TestCheckFeasibility) — see
// CONSOLIDATION_PLAN.md Phase 1. generatePlan() itself has no donor
// equivalent (the donor persisted its own Plan/PlanWeek/PlanSession models);
// its tests are new, covering the TrainingBlock/ScheduledItem mapping.

import { localDateString } from 'src/lib/date/localDay'

import { checkFeasibility, findEntryWeek, generatePlan } from './generatePlan'
import { PLAN_10K, PLAN_5K } from './templates'

const TZ = 'Australia/Melbourne'

describe('findEntryWeek', () => {
  it('beginner (0 km/wk) starts at week 1', () => {
    expect(findEntryWeek(PLAN_5K, 0).weekNo).toBe(1)
  })

  it('just below week 1 volume still starts at week 1', () => {
    expect(findEntryWeek(PLAN_5K, 11.9).weekNo).toBe(1)
  })

  it('intermediate runner enters at a matching week', () => {
    const week = findEntryWeek(PLAN_5K, 16.0)
    expect(week.targetVolumeKm).toBeLessThanOrEqual(16.0)
  })

  it('never places entry in the taper, even for a very advanced runner', () => {
    const week = findEntryWeek(PLAN_5K, 999)
    expect(week.phase).not.toBe('taper')
  })

  it('advanced runner enters near peak', () => {
    const week = findEntryWeek(PLAN_10K, 38.0)
    expect(['peak', 'build']).toContain(week.phase)
    expect(week.targetVolumeKm).toBeLessThanOrEqual(38.0)
  })

  it('enters exactly at the week matching current volume (last non-taper week, unambiguous)', () => {
    // PLAN_5K's last non-taper week (week 11) peaks at 24 km/wk — nothing
    // later in the sequence can out-rank it, so this is an unambiguous
    // exact match (unlike a mid-plan volume, where a later, lower-volume
    // recovery week can still win — see the `generatePlan` mid-plan test).
    expect(findEntryWeek(PLAN_5K, 24.0).targetVolumeKm).toBe(24.0)
  })

  it('10k beginner starts at week 1', () => {
    expect(findEntryWeek(PLAN_10K, 5.0).weekNo).toBe(1)
  })
})

describe('checkFeasibility', () => {
  const TODAY = '2025-01-01'

  it('is feasible with ample time', () => {
    expect(checkFeasibility('5k', 1, TODAY, '2025-05-21').isFeasible).toBe(true) // +20wk
  })

  it('is feasible at the exact minimum time (12wk plan, entry week 1)', () => {
    expect(checkFeasibility('5k', 1, TODAY, '2025-03-26').isFeasible).toBe(true) // +12wk
  })

  it('is not feasible with insufficient time', () => {
    expect(checkFeasibility('5k', 1, TODAY, '2025-01-29').isFeasible).toBe(
      false
    ) // +4wk
  })

  it('suggests a goal date in the future when infeasible', () => {
    const result = checkFeasibility('10k', 1, TODAY, '2025-01-15') // +2wk, 16wk plan
    expect(result.suggestedGoalDate > TODAY).toBe(true)
  })

  it('always returns a non-empty message', () => {
    expect(
      checkFeasibility('5k', 1, TODAY, '2025-01-15').message.length
    ).toBeGreaterThan(0)
  })

  it('entering mid-plan reduces weeks remaining', () => {
    const full = checkFeasibility('10k', 1, TODAY, '2025-05-21') // +20wk
    const mid = checkFeasibility('10k', 8, TODAY, '2025-05-21')
    expect(mid.weeksRemaining).toBeLessThan(full.weeksRemaining)
  })
})

describe('generatePlan', () => {
  it('c25k always starts at week 1 regardless of current weekly km', () => {
    const low = generatePlan({
      goalType: 'c25k',
      currentWeeklyKm: 0,
      startDate: '2026-07-20',
      timezone: TZ,
    })
    const high = generatePlan({
      goalType: 'c25k',
      currentWeeklyKm: 999,
      startDate: '2026-07-20',
      timezone: TZ,
    })
    expect(low.entryWeekNo).toBe(1)
    expect(high.entryWeekNo).toBe(1)
  })

  it('anchors sessions to the Monday on/after startDate when startDate is not a Monday', () => {
    // 2026-07-22 is a Wednesday; the following Monday is 2026-07-27.
    const result = generatePlan({
      goalType: '5k',
      currentWeeklyKm: 0,
      startDate: '2026-07-22',
      timezone: TZ,
    })
    const firstSession = result.blocks[0].sessions[0]
    expect(localDateString(firstSession.scheduledAt, TZ)).toBe('2026-07-27')
  })

  it('does not shift startDate when it already falls on a Monday', () => {
    const result = generatePlan({
      goalType: '5k',
      currentWeeklyKm: 0,
      startDate: '2026-07-20', // already a Monday
      timezone: TZ,
    })
    const firstSession = result.blocks[0].sessions[0]
    expect(localDateString(firstSession.scheduledAt, TZ)).toBe('2026-07-20')
  })

  it('defaults generated sessions to 07:00 local time', () => {
    const result = generatePlan({
      goalType: '5k',
      currentWeeklyKm: 0,
      startDate: '2026-07-20',
      timezone: TZ,
    })
    const localHour = new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      hour: 'numeric',
      hour12: false,
    }).format(result.blocks[0].sessions[0].scheduledAt)
    expect(localHour).toBe('07')
  })

  it('segments a full 5k plan into base/build/peak/taper blocks, mapped onto existing BlockPhase values', () => {
    const result = generatePlan({
      goalType: '5k',
      currentWeeklyKm: 0,
      startDate: '2026-07-20',
      timezone: TZ,
    })

    expect(result.blocks.map((b) => b.name)).toEqual([
      '5K — Base',
      '5K — Build',
      '5K — Peak',
      '5K — Taper',
    ])
    expect(result.blocks.map((b) => b.phase)).toEqual([
      'REBUILD',
      'BUILD',
      'BUILD',
      'TAPER',
    ])
  })

  it('produces one RUN session per template session, all sessions accounted for', () => {
    const result = generatePlan({
      goalType: '5k',
      currentWeeklyKm: 0,
      startDate: '2026-07-20',
      timezone: TZ,
    })
    const totalSessions = result.blocks.reduce(
      (n, b) => n + b.sessions.length,
      0
    )
    expect(totalSessions).toBe(12 * 3) // 12 weeks × 3 sessions/week in PLAN_5K
    for (const block of result.blocks) {
      for (const session of block.sessions) {
        expect(session.type).toBe('RUN')
      }
    }
  })

  it('flags long-run and quality-run (tempo/interval) sessions for the M7 carb periodization', () => {
    const result = generatePlan({
      goalType: '5k',
      currentWeeklyKm: 0,
      startDate: '2026-07-20',
      timezone: TZ,
    })
    const allSessions = result.blocks.flatMap((b) => b.sessions)

    const long = allSessions.find(
      (sess) => sess.prescription.sessionType === 'long'
    )
    expect(long?.prescription.isLongRun).toBe(true)
    expect(long?.prescription.isQualityRun).toBe(false)

    const tempo = allSessions.find(
      (sess) => sess.prescription.sessionType === 'tempo'
    )
    expect(tempo?.prescription.isQualityRun).toBe(true)
    expect(tempo?.prescription.isLongRun).toBe(false)

    const interval = allSessions.find(
      (sess) => sess.prescription.sessionType === 'interval'
    )
    expect(interval?.prescription.isQualityRun).toBe(true)

    const easy = allSessions.find(
      (sess) => sess.prescription.sessionType === 'easy'
    )
    expect(easy?.prescription.isLongRun).toBe(false)
    expect(easy?.prescription.isQualityRun).toBe(false)
  })

  it('entering mid-plan only generates blocks/sessions from the entry week onward', () => {
    const result = generatePlan({
      goalType: '5k',
      currentWeeklyKm: 24.0, // exact match on week 11, the last non-taper week
      startDate: '2026-07-20',
      timezone: TZ,
    })
    expect(result.entryWeekNo).toBe(11)
    const totalSessions = result.blocks.reduce(
      (n, b) => n + b.sessions.length,
      0
    )
    expect(totalSessions).toBe(2 * 3) // weeks 11..12 inclusive = 2 weeks
    // Week 11 is phase 'peak', so the first block is "Peak", not "Base" —
    // only its own remaining phase segments are generated.
    expect(result.blocks.map((b) => b.name)).toEqual([
      '5K — Peak',
      '5K — Taper',
    ])
  })

  it('a mid-range current volume can land on a later, lower-volume recovery week (ported find_entry_week semantics: last positional match wins, not nearest)', () => {
    // 21 km/wk sits between week 7 (21) and week 9 (22), but week 8 — a
    // recovery week at 16 km/wk — comes after week 7 in sequence and still
    // qualifies (16 <= 21), so it "wins" as the last eligible week. This is
    // the donor engine's real, ported behaviour, not an approximation.
    const result = generatePlan({
      goalType: '5k',
      currentWeeklyKm: 21.0,
      startDate: '2026-07-20',
      timezone: TZ,
    })
    expect(result.entryWeekNo).toBe(8)
  })

  it('blocks are contiguous — each block ends the day before the next one starts', () => {
    const result = generatePlan({
      goalType: '5k',
      currentWeeklyKm: 0,
      startDate: '2026-07-20',
      timezone: TZ,
    })
    for (let i = 0; i < result.blocks.length - 1; i++) {
      const gapMs =
        result.blocks[i + 1].startDate.getTime() -
        result.blocks[i].endDate.getTime()
      expect(gapMs).toBe(24 * 60 * 60 * 1000)
    }
  })

  it('surfaces feasibility as data, never throws, when a goal date is supplied', () => {
    const result = generatePlan({
      goalType: '5k',
      currentWeeklyKm: 0,
      startDate: '2026-07-20',
      goalDate: '2026-08-01', // far too soon for a 12-week plan
      timezone: TZ,
    })
    expect(result.feasibility?.isFeasible).toBe(false)
  })

  it('feasibility is null when no goal date is supplied', () => {
    const result = generatePlan({
      goalType: '5k',
      currentWeeklyKm: 0,
      startDate: '2026-07-20',
      timezone: TZ,
    })
    expect(result.feasibility).toBeNull()
  })
})
