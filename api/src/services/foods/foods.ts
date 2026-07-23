import type { QueryResolvers, FoodRelationResolvers } from 'types/graphql'

import { db } from 'src/lib/db'
import {
  fetchOffProduct,
  normalizeOffProduct,
} from 'src/lib/integrations/foodSources/openFoodFacts'

// SPEC.md §4.4: "Search order: local Food table (Postgres pg_trgm
// ILIKE/similarity + recent/frequent boost) → OFF → USDA... Recent/frequent:
// query over FoodLogEntry (last 90 days, frequency-weighted) — this is the
// top of every search UI." M2 scope is local AFCD data only — OFF/USDA live
// lookups are deferred (OFF is tied to the M6 mobile barcode scanner flow).

const RECENT_FREQUENT_WINDOW_DAYS = 90
const DEFAULT_SEARCH_LIMIT = 20

async function recentFrequentFoodIds(
  userId: string,
  limit: number
): Promise<string[]> {
  const since = new Date(
    Date.now() - RECENT_FREQUENT_WINDOW_DAYS * 24 * 60 * 60 * 1000
  )

  const grouped = await db.foodLogEntry.groupBy({
    by: ['foodId'],
    where: { userId, loggedFor: { gte: since } },
    _count: { foodId: true },
    orderBy: { _count: { foodId: 'desc' } },
    take: limit,
  })

  return grouped.map((g) => g.foodId)
}

/**
 * Foods matching `query` via Postgres trigram similarity (falls back to
 * plain ILIKE for very short/low-similarity queries so single-word searches
 * like "egg" still return something), re-ranked so the current user's
 * recent/frequent foods (last 90 days) surface first when they also match.
 * A blank query returns recent/frequent foods only, which is what every
 * search UI should show before the user types anything.
 */
export const searchFoods: QueryResolvers['searchFoods'] = async ({
  query,
  limit,
}) => {
  const take = limit ?? DEFAULT_SEARCH_LIMIT
  const trimmed = query?.trim() ?? ''
  const recentIds = await recentFrequentFoodIds(context.currentUser.id, take)

  if (trimmed === '') {
    if (recentIds.length === 0) return []
    const foods = await db.food.findMany({ where: { id: { in: recentIds } } })
    const byId = new Map(foods.map((f) => [f.id, f]))
    return recentIds
      .map((id) => byId.get(id))
      .filter((f): f is NonNullable<typeof f> => !!f)
  }

  // similarity() (not the `%` operator) is used explicitly so this doesn't
  // depend on the session-level pg_trgm.similarity_threshold GUC. Only ids
  // are selected here — the raw query result type doesn't line up with
  // Prisma's generated Food type, so the actual rows are hydrated via a
  // normal (fully-typed) `findMany` below and reordered to match.
  const matchIds = await db.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM "Food"
    WHERE similarity(name, ${trimmed}) > 0.15 OR name ILIKE ${'%' + trimmed + '%'}
    ORDER BY similarity(name, ${trimmed}) DESC
    LIMIT ${take * 2}
  `

  const orderedIds = matchIds.map((m) => m.id)
  const foods = await db.food.findMany({ where: { id: { in: orderedIds } } })
  const byId = new Map(foods.map((f) => [f.id, f]))

  const recentSet = new Set(recentIds)
  const boosted = orderedIds
    .map((id) => byId.get(id))
    .filter((f): f is NonNullable<typeof f> => !!f)
    .sort((a, b) => {
      const aRecent = recentSet.has(a.id) ? 0 : 1
      const bRecent = recentSet.has(b.id) ? 0 : 1
      return aRecent - bRecent // stable sort: recent/frequent first, similarity order preserved within each group
    })

  return boosted.slice(0, take)
}

export const food: QueryResolvers['food'] = ({ id }) => {
  return db.food.findUnique({ where: { id } })
}

/**
 * SPEC.md §4.4/§4.5's OFF barcode flow — local DB first, then a live OFF
 * lookup on miss, caching the result on a hit (upsert on
 * `@@unique([source, externalId])`, `externalId` = the barcode itself, per
 * §4.4). Returns null (not an error) when the barcode isn't found
 * anywhere, or OFF's product is missing required nutrients — either way
 * the mobile client's job is to fall back to manual entry, not surface a
 * GraphQL error for an ordinary "unknown barcode."
 */
export const foodByBarcode: QueryResolvers['foodByBarcode'] = async ({
  barcode,
}) => {
  const local = await db.food.findFirst({ where: { barcode } })
  if (local) return local

  const raw = await fetchOffProduct(barcode)
  const normalized = normalizeOffProduct(barcode, raw)
  if (!normalized) return null

  return db.food.upsert({
    where: { source_externalId: { source: 'OFF', externalId: barcode } },
    create: {
      name: normalized.name,
      brand: normalized.brand,
      source: 'OFF',
      externalId: barcode,
      barcode,
      per100: normalized.per100,
      isLiquid: normalized.isLiquid,
      verified: false,
    },
    update: {
      name: normalized.name,
      brand: normalized.brand,
      per100: normalized.per100,
      isLiquid: normalized.isLiquid,
    },
  })
}

export const Food: FoodRelationResolvers = {
  servings: (_obj, { root }) => {
    return db.food.findUnique({ where: { id: root?.id } }).servings()
  },
}
