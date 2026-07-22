import type {
  QueryResolvers,
  MutationResolvers,
  FoodLogEntryRelationResolvers,
} from 'types/graphql'

import { UserInputError } from '@cedarjs/graphql-server'

import { localDay, localDateToUtcMidnight } from 'src/lib/date/localDay'
import { db } from 'src/lib/db'
import {
  computeLoggedNutrients,
  type Per100Nutrients,
} from 'src/lib/nutrition/computeNutrients'

import { upsertDailyIntakeRollup } from '../dailyMetrics/dailyMetrics'

// All resolvers scoped to context.currentUser.id, per SPEC.md §3.4/§9. Every
// write recomputes the affected local day's DailyMetric rollup (on-write
// trigger — see api/src/services/dailyMetrics/dailyMetrics.ts).

export const foodLogEntries: QueryResolvers['foodLogEntries'] = async ({
  loggedFor,
}) => {
  const dateStr = await localDay(
    context.currentUser.id,
    loggedFor ? new Date(loggedFor) : new Date()
  )
  const date = localDateToUtcMidnight(dateStr)

  return db.foodLogEntry.findMany({
    where: { userId: context.currentUser.id, loggedFor: date },
    orderBy: { createdAt: 'asc' },
  })
}

async function resolveNutrients(
  foodId: string,
  servingId: string | null | undefined,
  quantity: number,
  unit: 'SERVING' | 'GRAM'
): Promise<Per100Nutrients> {
  const food = await db.food.findUnique({ where: { id: foodId } })
  if (!food) {
    throw new UserInputError('Food not found')
  }

  let servingGrams: number | null = null
  if (unit === 'SERVING') {
    if (!servingId) {
      throw new UserInputError('servingId is required when unit is SERVING')
    }
    const serving = await db.foodServing.findFirst({
      where: { id: servingId, foodId },
    })
    if (!serving) {
      throw new UserInputError('Serving not found for this food')
    }
    servingGrams = serving.grams
  }

  return computeLoggedNutrients({
    per100: food.per100 as unknown as Per100Nutrients,
    quantity,
    unit,
    servingGrams,
  })
}

export const createFoodLogEntry: MutationResolvers['createFoodLogEntry'] =
  async ({ input }) => {
    const userId = context.currentUser.id
    const nutrients = await resolveNutrients(
      input.foodId,
      input.servingId,
      input.quantity,
      input.unit
    )

    const dateStr = await localDay(
      userId,
      input.loggedFor ? new Date(input.loggedFor) : new Date()
    )
    const loggedFor = localDateToUtcMidnight(dateStr)

    const entry = await db.foodLogEntry.create({
      data: {
        userId,
        foodId: input.foodId,
        servingId: input.servingId ?? null,
        loggedFor,
        meal: input.meal,
        quantity: input.quantity,
        unit: input.unit,
        nutrients,
      },
    })

    await upsertDailyIntakeRollup(userId, dateStr)
    return entry
  }

export const updateFoodLogEntry: MutationResolvers['updateFoodLogEntry'] =
  async ({ id, input }) => {
    const existing = await requireOwnedFoodLogEntry(id)

    const foodId = input.foodId ?? existing.foodId
    const servingId =
      input.servingId !== undefined ? input.servingId : existing.servingId
    const quantity = input.quantity ?? existing.quantity
    const unit = input.unit ?? existing.unit

    const nutrients = await resolveNutrients(foodId, servingId, quantity, unit)

    const userId = context.currentUser.id
    const oldDateStr = await localDay(userId, existing.loggedFor)
    const newDateStr = input.loggedFor
      ? await localDay(userId, new Date(input.loggedFor))
      : oldDateStr
    const loggedFor = localDateToUtcMidnight(newDateStr)

    const updated = await db.foodLogEntry.update({
      where: { id },
      data: {
        foodId,
        servingId,
        loggedFor,
        meal: input.meal ?? existing.meal,
        quantity,
        unit,
        nutrients,
      },
    })

    await upsertDailyIntakeRollup(userId, newDateStr)
    if (newDateStr !== oldDateStr) {
      await upsertDailyIntakeRollup(userId, oldDateStr)
    }

    return updated
  }

export const deleteFoodLogEntry: MutationResolvers['deleteFoodLogEntry'] =
  async ({ id }) => {
    const existing = await requireOwnedFoodLogEntry(id)
    const userId = context.currentUser.id
    const dateStr = await localDay(userId, existing.loggedFor)

    const deleted = await db.foodLogEntry.delete({ where: { id } })
    await upsertDailyIntakeRollup(userId, dateStr)
    return deleted
  }

async function requireOwnedFoodLogEntry(id: string) {
  const entry = await db.foodLogEntry.findFirst({
    where: { id, userId: context.currentUser.id },
  })
  if (!entry) {
    throw new UserInputError('Food log entry not found')
  }
  return entry
}

export const FoodLogEntry: FoodLogEntryRelationResolvers = {
  food: (_obj, { root }) => {
    return db.foodLogEntry.findUnique({ where: { id: root?.id } }).food()
  },
  serving: (_obj, { root }) => {
    return db.foodLogEntry.findUnique({ where: { id: root?.id } }).serving()
  },
}
