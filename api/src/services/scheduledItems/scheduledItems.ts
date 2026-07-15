import type {
  QueryResolvers,
  MutationResolvers,
  ScheduledItemRelationResolvers,
} from 'types/graphql'

import { UserInputError } from '@cedarjs/graphql-server'

import { localDayBoundsUtcForUser } from 'src/lib/date/localDay'
import { db } from 'src/lib/db'

// All resolvers run behind `@requireAuth`, so `context.currentUser` is
// guaranteed. Every query/mutation is scoped to `context.currentUser.id`.
//
// Template/instance recurrence design: see DECISIONS.md. Templates
// (`isTemplate: true`) are excluded from `scheduledItems` unless
// `includeTemplates` is explicitly requested (Today/Plan screens should
// never see raw templates — only their materialized instances).

export const scheduledItems: QueryResolvers['scheduledItems'] = ({
  from,
  to,
  includeTemplates,
}) => {
  return db.scheduledItem.findMany({
    where: {
      userId: context.currentUser.id,
      isTemplate: includeTemplates ? undefined : false,
      scheduledAt:
        from || to
          ? {
              gte: from ?? undefined,
              lt: to ?? undefined,
            }
          : undefined,
    },
    orderBy: { scheduledAt: 'asc' },
  })
}

/**
 * Today's items for the Today/Dashboard screen, using the shared
 * `localDay` helper (Profile.timezone) rather than any client-supplied
 * date — this is the one place "today" is computed, per SPEC.md §9.
 */
export const todayScheduledItems: QueryResolvers['todayScheduledItems'] =
  async () => {
    const { startUtc, endUtc } = await localDayBoundsUtcForUser(
      context.currentUser.id,
      new Date()
    )

    return db.scheduledItem.findMany({
      where: {
        userId: context.currentUser.id,
        isTemplate: false,
        scheduledAt: { gte: startUtc, lt: endUtc },
      },
      orderBy: { scheduledAt: 'asc' },
    })
  }

export const scheduledItem: QueryResolvers['scheduledItem'] = ({ id }) => {
  return db.scheduledItem.findFirst({
    where: { id, userId: context.currentUser.id },
  })
}

export const createScheduledItem: MutationResolvers['createScheduledItem'] =
  async ({ input }) => {
    if (input.blockId) {
      await requireOwnedTrainingBlock(input.blockId)
    }

    return db.scheduledItem.create({
      data: {
        ...input,
        userId: context.currentUser.id,
        // Setting a recurrenceRule marks this row as a recurring template —
        // it's expanded by the materialization job, never shown/completed
        // directly. See DECISIONS.md.
        isTemplate: !!input.recurrenceRule,
      },
    })
  }

export const updateScheduledItem: MutationResolvers['updateScheduledItem'] =
  async ({ id, input }) => {
    await requireOwnedScheduledItem(id)

    if (input.blockId) {
      await requireOwnedTrainingBlock(input.blockId)
    }

    return db.scheduledItem.update({
      data: input,
      where: { id },
    })
  }

export const deleteScheduledItem: MutationResolvers['deleteScheduledItem'] =
  async ({ id }) => {
    await requireOwnedScheduledItem(id)

    return db.scheduledItem.delete({
      where: { id },
    })
  }

/**
 * Manual tick (SPEC.md §3.3/§5: "manual completions... are never
 * overwritten"). If a Completion already exists — e.g. a prior auto-match
 * — this is a no-op by default: we return the item unchanged rather than
 * silently clobbering it. Passing `force: true` is an explicit re-confirm
 * that overwrites the existing completion as a fresh manual one (used for
 * the "auto-matched — confirm?" FUZZY case from §3.3 rule 3, once
 * auto-matching exists in M3+).
 */
export const completeScheduledItem: MutationResolvers['completeScheduledItem'] =
  async ({ id, notes, force }) => {
    const item = await requireOwnedScheduledItem(id)
    const existingCompletion = await db.completion.findUnique({
      where: { scheduledItemId: id },
    })

    if (existingCompletion && !force) {
      return item
    }

    const completedAt = new Date()

    if (existingCompletion && force) {
      await db.completion.update({
        where: { scheduledItemId: id },
        data: {
          completedAt,
          source: 'MANUAL',
          matchConfidence: 'MANUAL',
          notes: notes ?? existingCompletion.notes,
          externalActivityId: null,
        },
      })
    } else {
      await db.completion.create({
        data: {
          scheduledItemId: id,
          userId: context.currentUser.id,
          completedAt,
          source: 'MANUAL',
          matchConfidence: 'MANUAL',
          notes: notes ?? null,
        },
      })
    }

    return db.scheduledItem.update({
      where: { id },
      data: { status: 'COMPLETED' },
    })
  }

/**
 * Marks an item SKIPPED. No-op if it's already COMPLETED — skipping must
 * never overwrite a completion (same "manual completions are never
 * overwritten" rule as above).
 */
export const skipScheduledItem: MutationResolvers['skipScheduledItem'] =
  async ({ id }) => {
    const item = await requireOwnedScheduledItem(id)

    if (item.status === 'COMPLETED') {
      return item
    }

    return db.scheduledItem.update({
      where: { id },
      data: { status: 'SKIPPED' },
    })
  }

/**
 * Reschedules an item to a new `scheduledAt`. Kept deliberately simple — a
 * single-field update, not a drag-and-drop calendar interaction. See
 * DECISIONS.md for why the ItemStatus.MOVED enum value is *not* set here
 * (status stays PLANNED so the item keeps showing up normally at its new
 * time; MOVED is reserved for the M5 calendar-sync reconcile job).
 */
export const moveScheduledItem: MutationResolvers['moveScheduledItem'] =
  async ({ id, scheduledAt }) => {
    await requireOwnedScheduledItem(id)

    return db.scheduledItem.update({
      where: { id },
      data: { scheduledAt },
    })
  }

/** Throws if the item doesn't exist or isn't owned by the current user. */
async function requireOwnedScheduledItem(id: string) {
  const item = await db.scheduledItem.findFirst({
    where: { id, userId: context.currentUser.id },
  })
  if (!item) {
    throw new UserInputError('Scheduled item not found')
  }
  return item
}

/** Throws if the block doesn't exist or isn't owned by the current user. */
async function requireOwnedTrainingBlock(id: string) {
  const block = await db.trainingBlock.findFirst({
    where: { id, userId: context.currentUser.id },
    select: { id: true },
  })
  if (!block) {
    throw new UserInputError('Training block not found')
  }
}

export const ScheduledItem: ScheduledItemRelationResolvers = {
  block: (_obj, { root }) => {
    return db.scheduledItem.findUnique({ where: { id: root?.id } }).block()
  },
  completion: (_obj, { root }) => {
    return db.scheduledItem.findUnique({ where: { id: root?.id } }).completion()
  },
}
