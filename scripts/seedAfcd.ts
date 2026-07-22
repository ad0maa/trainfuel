// AFCD (Australian Food Composition Database) seed script — SPEC.md §4.4 / §8 (M2).
//
// Seeds `Food` rows (`source: AFCD`, per-100g nutrients, `verified: true`)
// from the real FSANZ AFCD Release 3 "Nutrient profiles" workbook. Parsing
// is handled by the pure `parseAfcdWorkbook` function
// (api/src/lib/integrations/foodSources/afcd.ts); this script is the thin
// I/O wrapper: fetch (or read local) bytes -> parse -> idempotent upsert.
//
// Release / source (see DECISIONS.md for the full note):
//   FSANZ AFCD Release 3, "Nutrient profiles" workbook (1,588 foods).
//   Default URL (fetched live, confirmed reachable from this environment at
//   build time):
//   https://www.foodstandards.gov.au/sites/default/files/2025-12/AFCD%20Release%203%20-%20Nutrient%20profiles.xlsx
//   Download page (for future releases / manual verification):
//   https://www.foodstandards.gov.au/science-data/food-nutrient-databases/afcd/data-files
//
// Idempotent: upserts on the `@@unique([source, externalId])` constraint
// (externalId = AFCD's "Public Food Key", e.g. "F002258") — safe to re-run,
// including against a newer release (existing rows get their nutrients
// refreshed rather than duplicated).
//
// No FoodServing rows are created: the AFCD download files don't include
// household measures/serving sizes (only per-100g/per-100mL nutrient
// profiles), so per SPEC.md §4.4 ("add sensible default FoodServings only
// where the dataset provides measures; otherwise gram-only is fine") these
// foods are gram-only. Users can log by grams or add their own servings.
//
// Usage:
//   yarn cedar exec seedAfcd                 # fetches the live FSANZ URL
//   yarn cedar exec seedAfcd --file ./AFCD.xlsx   # parses a local file instead
//     (use this if the live URL has moved, or you're offline — point it at
//     a manually downloaded "Nutrient profiles" workbook from the FSANZ
//     data-files page above)

import { readFile } from 'node:fs/promises'

import { db } from 'api/src/lib/db'
import { parseAfcdWorkbook } from 'api/src/lib/integrations/foodSources/afcd'

const DEFAULT_AFCD_URL =
  'https://www.foodstandards.gov.au/sites/default/files/2025-12/AFCD%20Release%203%20-%20Nutrient%20profiles.xlsx'

interface ScriptArgs {
  _: string[]
  file?: string
  url?: string
  [key: string]: unknown
}

async function loadWorkbookBytes(args: ScriptArgs): Promise<Buffer> {
  if (args.file) {
    console.log(`seedAfcd: reading local file ${args.file}`)
    return readFile(args.file)
  }

  const url = args.url ?? DEFAULT_AFCD_URL
  console.log(`seedAfcd: fetching ${url}`)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(
      `seedAfcd: failed to fetch AFCD workbook (${response.status} ${response.statusText}) from ${url}. ` +
        `Download it manually from https://www.foodstandards.gov.au/science-data/food-nutrient-databases/afcd/data-files ` +
        `and re-run with --file <path>.`
    )
  }
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

// Cedar's `exec` runner calls the default export as `fn({ args: scriptArgs })`.
export default async ({ args }: { args: ScriptArgs }) => {
  const bytes = await loadWorkbookBytes(args)

  const rows = parseAfcdWorkbook(bytes)
  console.log(`seedAfcd: parsed ${rows.length} foods from the AFCD workbook.`)

  let created = 0
  let updated = 0

  // Sequential upserts: simplest/most robust for a one-off, infrequently-run
  // seed script over ~1,600 rows (a few seconds), no need for batching
  // complexity or createMany (which can't upsert).
  for (const row of rows) {
    const existing = await db.food.findUnique({
      where: {
        source_externalId: { source: 'AFCD', externalId: row.externalId },
      },
      select: { id: true },
    })

    await db.food.upsert({
      where: {
        source_externalId: { source: 'AFCD', externalId: row.externalId },
      },
      create: {
        name: row.name,
        source: 'AFCD',
        externalId: row.externalId,
        isLiquid: row.isLiquid,
        per100: row.per100,
        verified: true,
      },
      update: {
        name: row.name,
        isLiquid: row.isLiquid,
        per100: row.per100,
        verified: true,
      },
    })

    if (existing) {
      updated++
    } else {
      created++
    }
  }

  console.log(
    `seedAfcd: done. ${created} food(s) created, ${updated} food(s) updated (of ${rows.length} parsed).`
  )
}
