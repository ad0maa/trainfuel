export const schema = gql`
  """
  A raw activity ingested from an external provider (Strava now; Hevy in
  M4). Deliberately lean — no 'raw'/'exercises'/'completions' exposure yet;
  see DECISIONS.md "M3".
  """
  type ExternalActivity {
    id: String!
    source: CompletionSource!
    externalId: String!
    activityType: String!
    startedAt: DateTime!
    durationSec: Int
    distanceM: Float
    energyKcal: Float
    createdAt: DateTime!
  }

  type Query {
    """
    SPEC.md §3.3 rule 4's "unplanned activity" tray: activities with no
    linked Completion (the matching engine found zero PLANNED candidates,
    or the activity's type has no compatible ScheduledItemType), most
    recent first. The user can link one to a specific session via
    'linkExternalActivity'.
    """
    unmatchedExternalActivities: [ExternalActivity!]! @requireAuth
  }

  type Mutation {
    """
    Manually links an unmatched external activity to a specific
    ScheduledItem (the "link" half of rule 4 — "ignore" has no persisted
    state yet, see DECISIONS.md). Sets matchConfidence: MANUAL. Refuses if
    the item already has a completion (never overwrites one, same rule as
    automatic matching and as 'completeScheduledItem').
    """
    linkExternalActivity(
      externalActivityId: String!
      scheduledItemId: String!
    ): ScheduledItem! @requireAuth
  }
`
