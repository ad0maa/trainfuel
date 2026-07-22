import { computeDailyIntakeRollup } from './dailyIntakeRollup'

describe('computeDailyIntakeRollup', () => {
  it('sums kcal/protein/carbs/fat across entries', () => {
    const result = computeDailyIntakeRollup([
      { nutrients: { kcal: 300, proteinG: 30, carbsG: 15, fatG: 7.5 } },
      { nutrients: { kcal: 120, proteinG: 12, carbsG: 6, fatG: 3 } },
    ])
    expect(result.intakeKcal).toBe(420)
    expect(result.intakeProteinG).toBe(42)
    expect(result.intakeCarbsG).toBe(21)
    expect(result.intakeFatG).toBe(10.5)
  })

  it('returns all zeros for no entries', () => {
    expect(computeDailyIntakeRollup([])).toEqual({
      intakeKcal: 0,
      intakeProteinG: 0,
      intakeCarbsG: 0,
      intakeFatG: 0,
    })
  })

  it('treats a missing/non-finite field on one entry as 0 rather than throwing', () => {
    const result = computeDailyIntakeRollup([
      { nutrients: { kcal: 100, proteinG: 10, carbsG: 10, fatG: 5 } },
      // simulates a malformed snapshot missing a field
      { nutrients: { kcal: 50 } as never },
    ])
    expect(result.intakeKcal).toBe(150)
    expect(result.intakeProteinG).toBe(10)
  })

  it('rounds to 1 decimal place', () => {
    const result = computeDailyIntakeRollup([
      { nutrients: { kcal: 33.33, proteinG: 3.333, carbsG: 0, fatG: 0 } },
      { nutrients: { kcal: 33.33, proteinG: 3.333, carbsG: 0, fatG: 0 } },
    ])
    expect(result.intakeKcal).toBe(66.7)
    expect(result.intakeProteinG).toBe(6.7)
  })
})
