import type { MutationResolvers } from 'types/graphql'

import { UserInputError } from '@cedarjs/graphql-server'

import {
  DEFAULT_TIMEZONE,
  localDateString,
  localDateToUtcMidnight,
} from 'src/lib/date/localDay'
import { db } from 'src/lib/db'
import type { GoalType } from 'src/lib/planTemplates'
import { generatePlan } from 'src/lib/planTemplates'

// See CONSOLIDATION_PLAN.md Phase 1 ("M2.5") and DECISIONS.md for the
// design behind this mutation. `generatePlan` (api/src/lib/planTemplates)
// is a pure function — this service is the thin, DB-touching shell around
// it: resolve the user's timezone, call the pure generator, persist the
// result inside a transaction, return it.

const GRAPHQL_TO_GOAL_TYPE: Record<string, GoalType> = {
  COUCH_TO_5K: 'c25k',
  FIVE_K: '5k',
  TEN_K: '10k',
  HALF_MARATHON: '21k',
}

export const generateTrainingPlan: MutationResolvers['generateTrainingPlan'] =
  async ({ input }) => {
    const { goalType, currentWeeklyKm, startDate, goalDate, confirmOverlap } =
      input
    const userId = context.currentUser.id

    const profile = await db.profile.findUnique({
      where: { userId },
      select: { timezone: true },
    })
    const timezone = profile?.timezone ?? DEFAULT_TIMEZONE

    const result = generatePlan({
      goalType: GRAPHQL_TO_GOAL_TYPE[goalType],
      currentWeeklyKm,
      startDate: localDateString(new Date(startDate), timezone),
      goalDate: goalDate ? localDateString(new Date(goalDate), timezone) : null,
      timezone,
    })

    if (result.blocks.length === 0) {
      throw new UserInputError(
        'Generated plan has no remaining weeks — nothing to create.'
      )
    }

    const planStart = result.blocks[0].startDate
    const planEnd = result.blocks.at(-1)!.endDate

    if (!confirmOverlap) {
      const overlapping = await db.scheduledItem.count({
        where: {
          userId,
          type: 'RUN',
          isTemplate: false,
          scheduledAt: { gte: planStart, lte: planEnd },
        },
      })
      if (overlapping > 0) {
        throw new UserInputError(
          `This plan would overlap ${overlapping} existing run(s) in its date range. ` +
            `Pass confirmOverlap: true to generate anyway.`
        )
      }
    }

    const createdBlocks = await db.$transaction(
      result.blocks.map((block) =>
        db.trainingBlock.create({
          data: {
            userId,
            name: block.name,
            phase: block.phase,
            startDate: block.startDate,
            endDate: block.endDate,
            sessions: {
              create: block.sessions.map((session) => ({
                userId,
                type: session.type,
                title: session.title,
                description: session.description,
                scheduledAt: session.scheduledAt,
                durationMin: session.durationMin,
                prescription: session.prescription,
              })),
            },
          },
        })
      )
    )

    return {
      entryWeekNo: result.entryWeekNo,
      feasibility: result.feasibility
        ? {
            isFeasible: result.feasibility.isFeasible,
            weeksRemaining: result.feasibility.weeksRemaining,
            suggestedGoalDate: localDateToUtcMidnight(
              result.feasibility.suggestedGoalDate
            ),
            message: result.feasibility.message,
          }
        : null,
      blocks: createdBlocks,
    }
  }
