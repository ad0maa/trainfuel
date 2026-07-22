// SPEC.md §3.4 / §9: "Canonical rule: everything normalizes to per-100g
// internally. Serving sizes are just gram multipliers... Log entries
// snapshot computed nutrients (denormalized) so historical days never
// change retroactively." This is explicitly called out in §9 as one of the
// handful of pure-logic cores that require unit tests.
//
// Pure module, no DB access: given a Food's per100 nutrients and a logged
// quantity/unit(/serving), returns the computed nutrient snapshot to store
// on `FoodLogEntry.nutrients`.

/**
 * A per-100g (or per-100mL, if `Food.isLiquid`) nutrient map, as stored in
 * `Food.per100`. `kcal`/`proteinG`/`carbsG`/`fatG` are the load-bearing
 * fields the energy module depends on; everything else (fibreG, sugarG,
 * sodiumMg, ...) is optional and passed through generically so we don't
 * have to enumerate every AFCD/OFF/USDA field here.
 */
export interface Per100Nutrients {
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
  [key: string]: number | undefined
}

export type LogUnit = 'SERVING' | 'GRAM'

export interface ComputeLoggedNutrientsInput {
  per100: Per100Nutrients
  quantity: number
  unit: LogUnit
  /** Required (and only meaningful) when `unit === 'SERVING'` — grams per one serving (`FoodServing.grams`). */
  servingGrams?: number | null
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * Resolves the total gram weight being logged, given the entry's
 * quantity/unit and (for SERVING) the serving's gram weight.
 *
 * Throws on invalid input rather than silently producing wrong nutrient
 * numbers — a unit-conversion bug here is exactly the bug class §3.4 calls
 * out as unacceptable ("this kills the unit-conversion bug class").
 */
export function resolveGrams(
  quantity: number,
  unit: LogUnit,
  servingGrams?: number | null
): number {
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new Error(
      `resolveGrams: quantity must be a non-negative number, got ${quantity}`
    )
  }

  if (unit === 'GRAM') {
    return quantity
  }

  // unit === 'SERVING'
  if (
    servingGrams == null ||
    !Number.isFinite(servingGrams) ||
    servingGrams <= 0
  ) {
    throw new Error(
      'resolveGrams: unit is SERVING but no valid servingGrams was provided (FoodServing.grams).'
    )
  }
  return quantity * servingGrams
}

/**
 * Computes the nutrient snapshot for a food log entry: `quantity × unit ×
 * per100`, correctly handling `unit: SERVING` (via `servingGrams`,
 * typically `FoodServing.grams`) vs `unit: GRAM` (quantity is grams
 * directly). Every numeric field present in `per100` is scaled and
 * returned — this is intentionally generic (not just the four macros) so
 * optional fields (fibreG, sugarG, sodiumMg, ...) flow through without this
 * module needing to know the full AFCD/OFF/USDA nutrient vocabulary.
 */
export function computeLoggedNutrients({
  per100,
  quantity,
  unit,
  servingGrams,
}: ComputeLoggedNutrientsInput): Per100Nutrients {
  const grams = resolveGrams(quantity, unit, servingGrams)
  const factor = grams / 100

  const result: Per100Nutrients = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  for (const [key, value] of Object.entries(per100)) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      result[key] = round1(value * factor)
    }
  }
  return result
}
