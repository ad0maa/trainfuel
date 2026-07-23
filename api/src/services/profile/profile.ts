import type { MutationResolvers, QueryResolvers } from 'types/graphql'

import { UserInputError } from '@cedarjs/graphql-server'

import { db } from 'src/lib/db'

// No donor equivalent to port and no earlier milestone built this — see
// the session that added it for context: every energy calculation
// (todayEnergySummary, the plan generator's timezone) depends on a Profile
// existing, but there was never a create/edit surface for one. This is
// that surface's service.

/**
 * Mirrors the donor Django repo's MAX_DEFICIT_PER_DAY/MAX_SURPLUS_PER_DAY
 * caps (CONSOLIDATION_PLAN.md's deferred guardrail, now implemented): a
 * runaway weeklyWeightDeltaKg would produce an unsafe calorie target via
 * the energy module downstream, so it's clamped at the write boundary
 * rather than trusted from the client.
 */
export const MIN_WEEKLY_WEIGHT_DELTA_KG = -1.0
export const MAX_WEEKLY_WEIGHT_DELTA_KG = 0.5

export const myProfile: QueryResolvers['myProfile'] = () => {
  return db.profile.findUnique({ where: { userId: context.currentUser.id } })
}

export const saveProfile: MutationResolvers['saveProfile'] = async ({
  input,
}) => {
  const { weeklyWeightDeltaKg } = input
  if (
    weeklyWeightDeltaKg != null &&
    (weeklyWeightDeltaKg < MIN_WEEKLY_WEIGHT_DELTA_KG ||
      weeklyWeightDeltaKg > MAX_WEEKLY_WEIGHT_DELTA_KG)
  ) {
    throw new UserInputError(
      `weeklyWeightDeltaKg must be between ${MIN_WEEKLY_WEIGHT_DELTA_KG} and ${MAX_WEEKLY_WEIGHT_DELTA_KG} kg/week.`
    )
  }

  const userId = context.currentUser.id
  return db.profile.upsert({
    where: { userId },
    create: { userId, ...input },
    update: { ...input },
  })
}
