import { calculateLevel2Macros } from './level2Macros'

describe('calculateLevel2Macros', () => {
  it('defaults protein to 2.0 g/kg when no override is given', () => {
    const result = calculateLevel2Macros({
      targetKcal: 3000,
      weightKg: 70,
      dayType: 'REST',
    })
    expect(result.proteinG).toBeCloseTo(140, 5) // 2.0 * 70
  })

  it('uses the proteinTargetGPerDayOverride when provided', () => {
    const result = calculateLevel2Macros({
      targetKcal: 3000,
      weightKg: 70,
      dayType: 'REST',
      proteinTargetGPerDayOverride: 160,
    })
    expect(result.proteinG).toBe(160)
  })

  it('uses the correct carb g/kg tier for each day type (no fat-floor breach)', () => {
    const tiers: Array<[string, number]> = [
      ['LONG_RUN', 5],
      ['QUALITY_RUN', 4],
      ['TRAINING', 3],
      ['REST', 2.5],
    ]
    for (const [dayType, gPerKg] of tiers) {
      const result = calculateLevel2Macros({
        targetKcal: 4000, // generous enough kcal budget that no step-down triggers
        weightKg: 70,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dayType: dayType as any,
      })
      expect(result.carbsGPerKgUsed).toBe(gPerKg)
      expect(result.carbsG).toBeCloseTo(gPerKg * 70, 5)
      expect(result.fatFlooredAtMin).toBe(false)
    }
  })

  it('computes fat as the kcal remainder after protein and carbs', () => {
    // weightKg=70: protein 140g (560 kcal), carbs LONG_RUN 5g/kg=350g (1400 kcal)
    // remainder = 3200 - 560 - 1400 = 1240 kcal / 9 = 137.78g fat
    const result = calculateLevel2Macros({
      targetKcal: 3200,
      weightKg: 70,
      dayType: 'LONG_RUN',
    })
    expect(result.fatG).toBeCloseTo(137.78, 1)
    expect(result.fatFlooredAtMin).toBe(false)
  })

  it('steps carbs down by 0.5 g/kg when fat would breach the 0.6 g/kg floor', () => {
    // Tight kcal budget on a LONG_RUN day (5 g/kg carbs) forces a step-down.
    // weightKg=70, protein 140g (560 kcal), fat floor 0.6*70=42g (378 kcal).
    // At 5 g/kg carbs (350g/1400 kcal): fat = (1800-560-1400)/9 < 0 -> breach.
    const result = calculateLevel2Macros({
      targetKcal: 1800,
      weightKg: 70,
      dayType: 'LONG_RUN',
    })
    expect(result.carbsGPerKgUsed).toBeLessThan(5)
    expect(result.carbsGPerKgUsed % 0.5).toBeCloseTo(0, 5)
  })

  it('floors fat at 0.6 g/kg and flags fatFlooredAtMin when even 0 g/kg carbs cannot avoid the breach', () => {
    const result = calculateLevel2Macros({
      targetKcal: 100, // absurdly low relative to protein alone
      weightKg: 70,
      dayType: 'REST',
    })
    expect(result.carbsGPerKgUsed).toBe(0)
    expect(result.carbsG).toBe(0)
    expect(result.fatG).toBeCloseTo(0.6 * 70, 5)
    expect(result.fatFlooredAtMin).toBe(true)
  })

  it('throws for a non-positive targetKcal', () => {
    expect(() =>
      calculateLevel2Macros({ targetKcal: 0, weightKg: 70, dayType: 'REST' })
    ).toThrow(/targetKcal/)
  })

  it('throws for a non-positive weightKg', () => {
    expect(() =>
      calculateLevel2Macros({
        targetKcal: 2000,
        weightKg: 0,
        dayType: 'REST',
      })
    ).toThrow(/weightKg/)
  })
})
