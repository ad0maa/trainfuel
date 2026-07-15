import type {
  QueryResolvers,
  MutationResolvers,
  TrainingBlockRelationResolvers,
} from 'types/graphql'

import { UserInputError } from '@cedarjs/graphql-server'

import { db } from 'src/lib/db'

// All resolvers here run behind the `@requireAuth` SDL directive, so
// `context.currentUser` is guaranteed to be set. Every query/mutation is
// scoped to `context.currentUser.id` — the client-supplied id is never
// trusted (there is no `userId` in the create/update inputs; see SPEC.md
// §3.1 and §9 "no premature abstraction... userId plumbed everywhere").

export const trainingBlocks: QueryResolvers['trainingBlocks'] = () => {
  return db.trainingBlock.findMany({
    where: { userId: context.currentUser.id },
    orderBy: { startDate: 'asc' },
  })
}

export const trainingBlock: QueryResolvers['trainingBlock'] = ({ id }) => {
  return db.trainingBlock.findFirst({
    where: { id, userId: context.currentUser.id },
  })
}

export const createTrainingBlock: MutationResolvers['createTrainingBlock'] = ({
  input,
}) => {
  return db.trainingBlock.create({
    data: { ...input, userId: context.currentUser.id },
  })
}

export const updateTrainingBlock: MutationResolvers['updateTrainingBlock'] =
  async ({ id, input }) => {
    await requireOwnedTrainingBlock(id)

    return db.trainingBlock.update({
      data: input,
      where: { id },
    })
  }

export const deleteTrainingBlock: MutationResolvers['deleteTrainingBlock'] =
  async ({ id }) => {
    await requireOwnedTrainingBlock(id)

    return db.trainingBlock.delete({
      where: { id },
    })
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

export const TrainingBlock: TrainingBlockRelationResolvers = {
  sessions: (_obj, { root }) => {
    return db.trainingBlock.findUnique({ where: { id: root?.id } }).sessions()
  },
}
