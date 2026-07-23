export const schema = gql`
  enum HealthKind {
    BODY_MASS
    ACTIVE_ENERGY
    RESTING_HR
    HRV
    SLEEP
  }

  type HealthSample {
    id: String!
    kind: HealthKind!
    value: Float!
    unit: String!
    sampledAt: DateTime!
    sourceId: String!
    createdAt: DateTime!
  }

  input HealthSampleInput {
    kind: HealthKind!
    value: Float!
    unit: String!
    sampledAt: DateTime!
    """
    HealthKit's own sample UUID — the dedupe key (SPEC.md §4.5: 'Dedupe
    server-side on HealthKit UUID').
    """
    sourceId: String!
  }

  type Mutation {
    """
    Batch-ingests HealthKit samples synced from the mobile app (SPEC.md
    §4.5). Idempotent — re-posting an already-seen sample (same kind +
    sourceId for this user) is a safe no-op, so the mobile client can freely
    retry a batch after a dropped response. BODY_MASS samples additionally
    update DailyMetric.weightKg for their local day, to the latest sample
    on that day. Returns only the samples actually newly created (previously
    ingested ones are silently skipped, per the idempotency rule above).
    """
    syncHealthSamples(samples: [HealthSampleInput!]!): [HealthSample!]!
      @requireAuth
  }
`
