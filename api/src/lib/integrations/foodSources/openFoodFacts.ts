// SPEC.md §4.4: "Open Food Facts (barcode + packaged search): live lookup
// GET https://world.openfoodfacts.org/api/v2/product/{barcode} on scan
// miss in local DB → validate required nutrients present (kcal + macros
// per 100g) → cache into Food (source: OFF, verified: false)." Deferred at
// M2 time (see afcd.ts's header comment) to "the M6 mobile barcode scanner
// flow" — that's this module.
//
// Same pure-core/thin-shell split as afcd.ts: `normalizeOffProduct` is the
// pure validator/mapper (unit tested); `fetchOffProduct` is the thin fetch
// wrapper (not unit tested, matching this codebase's precedent for
// strava.ts/hevy.ts's own fetch wrappers).

const OFF_PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product'

function requireOffUserAgent(): string {
  const value = process.env.OFF_USER_AGENT
  if (!value) {
    throw new Error('OFF_USER_AGENT is not set — see .env.example.')
  }
  return value
}

/** The subset of OFF's `product` object this app actually reads. OFF's real
 * payload has hundreds of fields; only declaring what's used. */
export interface RawOffProduct {
  product_name?: string
  brands?: string
  code?: string
  nutriments?: {
    'energy-kcal_100g'?: number
    'energy-kcal_serving'?: number
    proteins_100g?: number
    carbohydrates_100g?: number
    fat_100g?: number
    fiber_100g?: number
    sugars_100g?: number
    sodium_100g?: number // grams, per OFF's convention — converted to mg below
  }
}

export interface RawOffResponse {
  status: number // 1 = found, 0 = not found
  product?: RawOffProduct
}

export interface NormalizedOffFood {
  externalId: string // the barcode itself, per SPEC.md §4.4
  name: string
  brand: string | null
  isLiquid: boolean
  per100: {
    kcal: number
    proteinG: number
    carbsG: number
    fatG: number
    fibreG?: number
    sugarG?: number
    sodiumMg?: number
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * Validates that OFF actually returned a usable product (kcal + all three
 * macros present per 100g — SPEC.md's explicit requirement) and maps it to
 * the canonical `per100` shape every other food source produces. Returns
 * `null` if the barcode wasn't found or the product is missing required
 * nutrients — a barcode with, say, only serving-size nutrition (common for
 * some regions' packaging) is not usable here and the caller should treat
 * it the same as "not found" rather than storing a broken Food row.
 */
export function normalizeOffProduct(
  barcode: string,
  response: RawOffResponse
): NormalizedOffFood | null {
  if (response.status !== 1 || !response.product) return null

  const n = response.product.nutriments
  const kcal = n?.['energy-kcal_100g']
  const proteinG = n?.proteins_100g
  const carbsG = n?.carbohydrates_100g
  const fatG = n?.fat_100g
  if (kcal == null || proteinG == null || carbsG == null || fatG == null) {
    return null
  }

  const per100: NormalizedOffFood['per100'] = {
    kcal: round1(kcal),
    proteinG: round1(proteinG),
    carbsG: round1(carbsG),
    fatG: round1(fatG),
  }
  if (n.fiber_100g != null) per100.fibreG = round1(n.fiber_100g)
  if (n.sugars_100g != null) per100.sugarG = round1(n.sugars_100g)
  if (n.sodium_100g != null) per100.sodiumMg = round1(n.sodium_100g * 1000)

  return {
    externalId: barcode,
    name: response.product.product_name?.trim() || `Unnamed product (${barcode})`,
    brand: response.product.brands?.trim() || null,
    isLiquid: false, // OFF's payload has no reliable solid/liquid flag; §4.4 only requires this for AFCD's own per-100mL sheet.
    per100,
  }
}

/**
 * Live GET against Open Food Facts. Not unit tested (real network I/O) —
 * only `normalizeOffProduct` above is, matching this codebase's existing
 * fetch-wrapper precedent.
 */
export async function fetchOffProduct(barcode: string): Promise<RawOffResponse> {
  const response = await fetch(`${OFF_PRODUCT_URL}/${encodeURIComponent(barcode)}.json`, {
    headers: { 'User-Agent': requireOffUserAgent() },
  })
  if (!response.ok) {
    throw new Error(`Open Food Facts request failed: ${response.status} ${response.statusText}`)
  }
  return (await response.json()) as RawOffResponse
}
