// SPEC.md §4.4: "AFCD (seed): download the FSANZ Australian Food Composition
// Database release file (xlsx/csv). Write a one-off idempotent seed script
// mapping to Food rows (source: AFCD, per-100g nutrients, verified: true)."
//
// This module is the pure parsing core: given the raw bytes of the AFCD
// "Nutrient profiles" release workbook, it returns structured per-100g food
// rows ready to upsert. No I/O, no DB access — the runnable script
// (scripts/seedAfcd.ts) is a thin wrapper that fetches/reads the file bytes,
// calls this parser, and upserts into Postgres.
//
// Release used: FSANZ AFCD Release 3 (1,588 foods), "Nutrient profiles"
// workbook. See DECISIONS.md for the exact source URL and release details.
// Column layout verified directly against the downloaded workbook at build
// time (column positions below are 0-indexed against the sheet's header
// row) — do not rely on column *names* alone for lookups since AFCD's
// headers include embedded newlines/units that vary subtly between
// releases; positions are checked defensively in `parseAfcdWorkbook` and
// this module throws loudly if the expected header cells don't match, so a
// future release with a reshuffled layout fails fast instead of silently
// mis-mapping nutrients.

import * as XLSX from 'xlsx'

export const AFCD_NUTRIENT_PROFILES_SHEET = 'All solids & liquids per 100 g'
export const AFCD_LIQUIDS_SHEET = 'Liquids only per 100 mL'

/** 0-indexed column positions in the "All solids & liquids per 100 g" sheet. */
const COL = {
  publicFoodKey: 0,
  foodName: 3,
  energyKj: 4, // "Energy with dietary fibre, equated (kJ)"
  proteinG: 7,
  fatG: 9,
  fibreG: 11, // "Total dietary fibre (g)"
  sugarG: 19, // "Total sugars (g)"
  carbsG: 38, // "Available carbohydrate, without sugar alcohols (g)"
  sodiumMg: 72, // "Sodium (Na) (mg)"
}

/** Expected header substrings at each COL position, checked at parse time as a release-drift guard. */
const EXPECTED_HEADER_SUBSTRING: Record<keyof typeof COL, string> = {
  publicFoodKey: 'Public Food Key',
  foodName: 'Food Name',
  energyKj: 'Energy with dietary fibre',
  proteinG: 'Protein',
  fatG: 'Fat, total',
  fibreG: 'Total dietary fibre',
  sugarG: 'Total sugars',
  carbsG: 'Available carbohydrate, without sugar alcohols',
  sodiumMg: 'Sodium',
}

const KJ_PER_KCAL = 4.184

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export interface AfcdFoodRow {
  externalId: string // AFCD "Public Food Key", e.g. "F002258"
  name: string
  isLiquid: boolean
  per100: {
    kcal: number
    proteinG: number
    carbsG: number
    fatG: number
    fibreG: number
    sugarG: number
    sodiumMg: number
  }
}

/** Reads a sheet as an array-of-arrays, skipping to the real header row (row index 2, 0-based, in AFCD's layout — rows 0-1 are a title + blank spacer). */
function sheetToRows(workbook: XLSX.WorkBook, sheetName: string): unknown[][] {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) {
    throw new Error(
      `AFCD workbook is missing expected sheet "${sheetName}" — release layout may have changed.`
    )
  }
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    range: 2, // header row is the 3rd row (0-indexed range start)
  })
}

function assertHeaderShape(header: unknown[]): void {
  for (const [key, col] of Object.entries(COL) as [
    keyof typeof COL,
    number,
  ][]) {
    const cell = String(header[col] ?? '')
    const expected = EXPECTED_HEADER_SUBSTRING[key]
    if (!cell.includes(expected)) {
      throw new Error(
        `AFCD workbook column layout mismatch: expected column ${col} ("${key}") to contain "${expected}", found "${cell}". The FSANZ release layout may have changed — update COL in afcd.ts.`
      )
    }
  }
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    if (!Number.isNaN(n)) return n
  }
  // AFCD marks some values as not-analysed/not-applicable with blanks or
  // text flags on rare rows; treat as 0 rather than dropping the whole food
  // (a missing trace nutrient shouldn't disqualify an otherwise-usable food
  // row — kcal/protein/carbs/fat, the load-bearing fields for this app, are
  // populated for all 1,588 foods in Release 3, verified at build time).
  return 0
}

/**
 * Parses the AFCD "Nutrient profiles" workbook (as raw bytes) into
 * per-100g Food rows. Pure function — no I/O.
 */
export function parseAfcdWorkbook(buffer: Buffer | ArrayBuffer): AfcdFoodRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' })

  const solidRows = sheetToRows(workbook, AFCD_NUTRIENT_PROFILES_SHEET)
  assertHeaderShape(solidRows[0])

  const liquidRows = sheetToRows(workbook, AFCD_LIQUIDS_SHEET)
  const liquidKeys = new Set(
    liquidRows.slice(1).map((row) => String(row[COL.publicFoodKey]))
  )

  const results: AfcdFoodRow[] = []

  for (const row of solidRows.slice(1)) {
    const externalId = row[COL.publicFoodKey]
    if (!externalId) continue // blank trailing rows, if any

    const kJ = toNumber(row[COL.energyKj])

    results.push({
      externalId: String(externalId),
      name: String(row[COL.foodName] ?? '').trim(),
      isLiquid: liquidKeys.has(String(externalId)),
      per100: {
        kcal: round1(kJ / KJ_PER_KCAL),
        proteinG: round1(toNumber(row[COL.proteinG])),
        carbsG: round1(toNumber(row[COL.carbsG])),
        fatG: round1(toNumber(row[COL.fatG])),
        fibreG: round1(toNumber(row[COL.fibreG])),
        sugarG: round1(toNumber(row[COL.sugarG])),
        sodiumMg: round1(toNumber(row[COL.sodiumMg])),
      },
    })
  }

  return results
}
