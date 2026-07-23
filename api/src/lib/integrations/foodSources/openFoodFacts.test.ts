import { normalizeOffProduct } from './openFoodFacts'
import type { RawOffResponse } from './openFoodFacts'

function found(overrides: Partial<RawOffResponse['product']> = {}): RawOffResponse {
  return {
    status: 1,
    product: {
      product_name: 'Peanut Butter',
      brands: 'Acme',
      nutriments: {
        'energy-kcal_100g': 588,
        proteins_100g: 25,
        carbohydrates_100g: 20,
        fat_100g: 50,
        fiber_100g: 6,
        sugars_100g: 9,
        sodium_100g: 0.4, // grams — 400mg
      },
      ...overrides,
    },
  }
}

describe('normalizeOffProduct', () => {
  it('maps a valid product to the canonical per100 shape', () => {
    const result = normalizeOffProduct('9310072021234', found())
    expect(result).toEqual({
      externalId: '9310072021234',
      name: 'Peanut Butter',
      brand: 'Acme',
      isLiquid: false,
      per100: {
        kcal: 588,
        proteinG: 25,
        carbsG: 20,
        fatG: 50,
        fibreG: 6,
        sugarG: 9,
        sodiumMg: 400,
      },
    })
  })

  it('omits optional nutrients that OFF did not provide', () => {
    const result = normalizeOffProduct(
      '111',
      found({
        nutriments: {
          'energy-kcal_100g': 100,
          proteins_100g: 1,
          carbohydrates_100g: 2,
          fat_100g: 3,
        },
      })
    )
    expect(result?.per100).toEqual({ kcal: 100, proteinG: 1, carbsG: 2, fatG: 3 })
  })

  it('returns null when OFF has no product for the barcode', () => {
    expect(normalizeOffProduct('000', { status: 0 })).toBeNull()
  })

  it('returns null when a required macro is missing (unusable for the energy module)', () => {
    const result = normalizeOffProduct(
      '222',
      found({
        nutriments: {
          'energy-kcal_100g': 100,
          proteins_100g: 1,
          // carbohydrates_100g missing
          fat_100g: 3,
        },
      })
    )
    expect(result).toBeNull()
  })

  it('falls back to a placeholder name when OFF has no product_name', () => {
    const result = normalizeOffProduct('333', found({ product_name: undefined }))
    expect(result?.name).toBe('Unnamed product (333)')
  })

  it('defaults brand to null when absent', () => {
    const result = normalizeOffProduct('444', found({ brands: undefined }))
    expect(result?.brand).toBeNull()
  })
})
