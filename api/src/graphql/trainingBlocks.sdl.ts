export const schema = gql`
  type TrainingBlock {
    id: String!
    userId: String!
    name: String!
    phase: BlockPhase!
    startDate: DateTime!
    endDate: DateTime!
    notes: String
    sessions: [ScheduledItem!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  enum BlockPhase {
    REBUILD
    BUILD
    TAPER
    MAINTENANCE
  }

  type Query {
    """
    All training blocks belonging to the current user.
    """
    trainingBlocks: [TrainingBlock!]! @requireAuth

    """
    A single training block, scoped to the current user. Returns null if it
    doesn't exist or belongs to someone else.
    """
    trainingBlock(id: String!): TrainingBlock @requireAuth
  }

  # Note: no userId here — it's always taken from context.currentUser,
  # never trusted from the client.
  input CreateTrainingBlockInput {
    name: String!
    phase: BlockPhase!
    startDate: DateTime!
    endDate: DateTime!
    notes: String
  }

  input UpdateTrainingBlockInput {
    name: String
    phase: BlockPhase
    startDate: DateTime
    endDate: DateTime
    notes: String
  }

  type Mutation {
    createTrainingBlock(input: CreateTrainingBlockInput!): TrainingBlock!
      @requireAuth
    updateTrainingBlock(
      id: String!
      input: UpdateTrainingBlockInput!
    ): TrainingBlock! @requireAuth
    deleteTrainingBlock(id: String!): TrainingBlock! @requireAuth
  }
`
