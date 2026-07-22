import { DAYS_PER_WEEK, KCAL_PER_KG } from './constants'
import { calculateLevel1Target } from './level1Target'

describe('calculateLevel1Target', () => {
  it('computes baseTDEE as bmr * SEDENTARY multiplier (1.2) with no exercise or pacing', () => {
    const result = calculateLevel1Target({
      bmr: 1700,
      activityBaseline: 'SEDENTARY',
      exerciseKcalRaw: 0,
      weeklyWeightDeltaKg: 0,
    })
    expect(result.baseTDEE).toBeCloseTo(2040, 5) // 1700 * 1.2
    expect(result.exerciseKcal).toBe(0)
    expect(result.dayTDEE).toBeCloseTo(2040, 5)
    expect(result.targetKcal).toBeCloseTo(2040, 5)
    expect(result.flooredAtBmr).toBe(false)
  })

  it('applies the 0.75 device haircut to exercise kcal', () => {
    const result = calculateLevel1Target({
      bmr: 1700,
      activityBaseline: 'SEDENTARY',
      exerciseKcalRaw: 400,
      weeklyWeightDeltaKg: 0,
    })
    expect(result.exerciseKcal).toBeCloseTo(300, 5) // 400 * 0.75
    expect(result.dayTDEE).toBeCloseTo(2040 + 300, 5)
  })

  it('clamps negative exerciseKcalRaw to 0 rather than subtracting from TDEE', () => {
    const result = calculateLevel1Target({
      bmr: 1700,
      activityBaseline: 'SEDENTARY',
      exerciseKcalRaw: -200,
      weeklyWeightDeltaKg: 0,
    })
    expect(result.exerciseKcal).toBe(0)
  })

  it('applies a deficit pacing (negative weeklyWeightDeltaKg) as a daily kcal subtraction', () => {
    // Deficit small enough relative to bmr that this doesn't hit the floor,
    // so the arithmetic itself is what's under test here (flooring has its
    // own dedicated tests below).
    // -0.1kg/week * 7700 kcal/kg / 7 days = -110 kcal/day
    const result = calculateLevel1Target({
      bmr: 1000,
      activityBaseline: 'SEDENTARY', // baseTDEE 1200
      exerciseKcalRaw: 0,
      weeklyWeightDeltaKg: -0.1,
    })
    expect(result.targetKcal).toBeCloseTo(1200 - 110, 5)
    expect(result.flooredAtBmr).toBe(false)
  })

  it('applies a surplus pacing (positive weeklyWeightDeltaKg) as a daily kcal addition', () => {
    const result = calculateLevel1Target({
      bmr: 1700,
      activityBaseline: 'SEDENTARY',
      exerciseKcalRaw: 0,
      weeklyWeightDeltaKg: 0.25,
    })
    expect(result.targetKcal).toBeCloseTo(2040 + 275, 5) // 0.25*7700/7 = 275
  })

  it('floors targetKcal at bmr*1.0 when the deficit would breach it, and flags flooredAtBmr', () => {
    // bmr=1700, baseTDEE=2040 (sedentary), a huge deficit would push far below BMR.
    const result = calculateLevel1Target({
      bmr: 1700,
      activityBaseline: 'SEDENTARY',
      exerciseKcalRaw: 0,
      weeklyWeightDeltaKg: -2, // -2200 kcal/day pacing — way too aggressive
    })
    expect(result.targetKcal).toBe(1700)
    expect(result.flooredAtBmr).toBe(true)
  })

  it('does not floor a small deficit that stays comfortably above bmr', () => {
    // baseTDEE 1200 (bmr=1000, SEDENTARY), a modest -100/day pacing lands
    // at 1100, still above the 1000 floor.
    const result = calculateLevel1Target({
      bmr: 1000,
      activityBaseline: 'SEDENTARY',
      exerciseKcalRaw: 0,
      weeklyWeightDeltaKg: -(100 * DAYS_PER_WEEK) / KCAL_PER_KG,
    })
    expect(result.targetKcal).toBeCloseTo(1100, 5)
    expect(result.flooredAtBmr).toBe(false)
  })

  it('uses the correct multiplier for each ActivityBaseline tier', () => {
    const tiers: Array<[string, number]> = [
      ['SEDENTARY', 1.2],
      ['LIGHT', 1.375],
      ['MODERATE', 1.55],
      ['ACTIVE', 1.725],
      ['VERY_ACTIVE', 1.9],
    ]
    for (const [tier, multiplier] of tiers) {
      const result = calculateLevel1Target({
        bmr: 1000,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        activityBaseline: tier as any,
        exerciseKcalRaw: 0,
        weeklyWeightDeltaKg: 0,
      })
      expect(result.baseTDEE).toBeCloseTo(1000 * multiplier, 5)
    }
  })

  it('treats a missing weeklyWeightDeltaKg (null/undefined) as maintenance (0)', () => {
    const withNull = calculateLevel1Target({
      bmr: 1700,
      activityBaseline: 'SEDENTARY',
      exerciseKcalRaw: 0,
      weeklyWeightDeltaKg: null,
    })
    const withUndefined = calculateLevel1Target({
      bmr: 1700,
      activityBaseline: 'SEDENTARY',
      exerciseKcalRaw: 0,
    })
    expect(withNull.targetKcal).toBeCloseTo(2040, 5)
    expect(withUndefined.targetKcal).toBeCloseTo(2040, 5)
  })

  it('throws for a non-positive bmr', () => {
    expect(() =>
      calculateLevel1Target({
        bmr: 0,
        activityBaseline: 'SEDENTARY',
        exerciseKcalRaw: 0,
      })
    ).toThrow(/bmr/)
  })
})
