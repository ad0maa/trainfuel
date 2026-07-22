import { computeLoggedNutrients, resolveGrams } from './computeNutrients.js'

const PER_100 = {
  kcal: 200,
  proteinG: 20,
  carbsG: 10,
  fatG: 5,
  fibreG: 2,
  sugarG: 1,
  sodiumMg: 50,
}

describe('resolveGrams', () => {
  it('returns the quantity directly for unit GRAM', () => {
    expect(resolveGrams(150, 'GRAM')).toEqual(150)
  })

  it('multiplies quantity by servingGrams for unit SERVING', () => {
    expect(resolveGrams(2, 'SERVING', 30)).toEqual(60)
  })

  it('throws for unit SERVING with no servingGrams', () => {
    expect(() => resolveGrams(2, 'SERVING', null)).toThrow(/servingGrams/)
    expect(() => resolveGrams(2, 'SERVING', undefined)).toThrow(/servingGrams/)
  })

  it('throws for unit SERVING with a zero or negative servingGrams', () => {
    expect(() => resolveGrams(2, 'SERVING', 0)).toThrow(/servingGrams/)
    expect(() => resolveGrams(2, 'SERVING', -10)).toThrow(/servingGrams/)
  })

  it('throws for a negative quantity', () => {
    expect(() => resolveGrams(-5, 'GRAM')).toThrow(/quantity/)
  })

  it('allows a zero quantity', () => {
    expect(resolveGrams(0, 'GRAM')).toEqual(0)
  })
})

describe('computeLoggedNutrients', () => {
  it('scales per-100g nutrients by grams / 100 for unit GRAM', () => {
    // 150g of a 200kcal/100g food = 300kcal
    const result = computeLoggedNutrients({
      per100: PER_100,
      quantity: 150,
      unit: 'GRAM',
    })
    expect(result.kcal).toEqual(300)
    expect(result.proteinG).toEqual(30)
    expect(result.carbsG).toEqual(15)
    expect(result.fatG).toEqual(7.5)
    expect(result.fibreG).toEqual(3)
    expect(result.sugarG).toEqual(1.5)
    expect(result.sodiumMg).toEqual(75)
  })

  it('scales via servingGrams for unit SERVING (2 servings of a 30g serving)', () => {
    // 2 servings * 30g = 60g of a 200kcal/100g food = 120kcal
    const result = computeLoggedNutrients({
      per100: PER_100,
      quantity: 2,
      unit: 'SERVING',
      servingGrams: 30,
    })
    expect(result.kcal).toEqual(120)
    expect(result.proteinG).toEqual(12)
    expect(result.carbsG).toEqual(6)
    expect(result.fatG).toEqual(3)
  })

  it('a single 100g serving reproduces per100 exactly (identity case)', () => {
    const result = computeLoggedNutrients({
      per100: PER_100,
      quantity: 1,
      unit: 'SERVING',
      servingGrams: 100,
    })
    expect(result.kcal).toEqual(PER_100.kcal)
    expect(result.proteinG).toEqual(PER_100.proteinG)
    expect(result.carbsG).toEqual(PER_100.carbsG)
    expect(result.fatG).toEqual(PER_100.fatG)
  })

  it('zero quantity yields all-zero nutrients', () => {
    const result = computeLoggedNutrients({
      per100: PER_100,
      quantity: 0,
      unit: 'GRAM',
    })
    expect(result.kcal).toEqual(0)
    expect(result.proteinG).toEqual(0)
    expect(result.carbsG).toEqual(0)
    expect(result.fatG).toEqual(0)
    expect(result.sodiumMg).toEqual(0)
  })

  it('rounds to 1 decimal place', () => {
    // 33g of a 100kcal/100g food = 33kcal exactly, but protein 3.333g -> 3.3
    const result = computeLoggedNutrients({
      per100: { kcal: 100, proteinG: 10, carbsG: 0, fatG: 0 },
      quantity: 33,
      unit: 'GRAM',
    })
    expect(result.kcal).toEqual(33)
    expect(result.proteinG).toEqual(3.3)
  })

  it('only carries through numeric fields present in per100 (no fabricated fields)', () => {
    const result = computeLoggedNutrients({
      per100: { kcal: 100, proteinG: 5, carbsG: 5, fatG: 5 },
      quantity: 100,
      unit: 'GRAM',
    })
    expect(result.sodiumMg).toBeUndefined()
    expect(result.fibreG).toBeUndefined()
  })

  it('throws when unit is SERVING but servingGrams is missing (propagates from resolveGrams)', () => {
    expect(() =>
      computeLoggedNutrients({ per100: PER_100, quantity: 1, unit: 'SERVING' })
    ).toThrow(/servingGrams/)
  })
})
