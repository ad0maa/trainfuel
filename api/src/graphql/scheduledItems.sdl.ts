export const schema = gql`
  type ScheduledItem {
    id: String!
    userId: String!
    blockId: String
    block: TrainingBlock
    type: ScheduledItemType!
    title: String!
    description: String
    scheduledAt: DateTime!
    durationMin: Int
    recurrenceRule: String
    status: ItemStatus!

    """
    True for a recurring "template" row (meds/supplements). Templates are
    never shown on the Today screen and are not directly completable — the
    nightly materialization job expands them into concrete instance rows.
    See DECISIONS.md for the template/instance design.
    """
    isTemplate: Boolean!

    """
    Set on a materialized instance row, pointing back at the template it
    was generated from. Null for one-off items and for templates themselves.
    """
    templateId: String

    prescription: JSON
    gcalEventId: String
    gcalSyncedAt: DateTime
    pushToCalendar: Boolean!
    completion: Completion
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Completion {
    id: String!
    scheduledItemId: String!
    userId: String!
    completedAt: DateTime!
    source: CompletionSource!
    matchConfidence: MatchConfidence!
    externalActivityId: String
    notes: String
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  enum ScheduledItemType {
    RUN
    LIFT
    MEDICATION
    SUPPLEMENT
    OTHER
  }

  enum ItemStatus {
    PLANNED
    COMPLETED
    SKIPPED
    MOVED
  }

  enum CompletionSource {
    STRAVA
    HEVY
    HEALTHKIT
    MANUAL
  }

  enum MatchConfidence {
    EXACT
    FUZZY
    MANUAL
  }

  type Query {
    """
    Scheduled items belonging to the current user, optionally restricted to
    a '[from, to)' window (used for the Today screen and the Plan week
    view). Templates ('isTemplate: true') are excluded unless
    'includeTemplates' is true.
    """
    scheduledItems(
      from: DateTime
      to: DateTime
      includeTemplates: Boolean
    ): [ScheduledItem!]! @requireAuth

    """
    Today's scheduled items for the current user, using their *local*
    calendar day (Profile.timezone, via the shared localDay helper) — not
    the requesting device's timezone. This is what the Today/Dashboard
    screen should use. Templates are always excluded.
    """
    todayScheduledItems: [ScheduledItem!]! @requireAuth

    scheduledItem(id: String!): ScheduledItem @requireAuth
  }

  # No userId here — always taken from context.currentUser.
  input CreateScheduledItemInput {
    blockId: String
    type: ScheduledItemType!
    title: String!
    description: String
    scheduledAt: DateTime!
    durationMin: Int
    """
    RFC5545 RRULE string (no DTSTART — 'scheduledAt' above is the anchor).
    Setting this marks the created row as a template ('isTemplate: true');
    leave null for a one-off session.
    """
    recurrenceRule: String
    prescription: JSON
    pushToCalendar: Boolean
  }

  input UpdateScheduledItemInput {
    blockId: String
    type: ScheduledItemType
    title: String
    description: String
    scheduledAt: DateTime
    durationMin: Int
    prescription: JSON
    pushToCalendar: Boolean
  }

  type Mutation {
    createScheduledItem(input: CreateScheduledItemInput!): ScheduledItem!
      @requireAuth
    updateScheduledItem(
      id: String!
      input: UpdateScheduledItemInput!
    ): ScheduledItem! @requireAuth
    deleteScheduledItem(id: String!): ScheduledItem! @requireAuth

    """
    Manual tick. Creates a Completion (source: MANUAL, matchConfidence:
    MANUAL) and sets status to COMPLETED. If a completion already exists
    (e.g. an earlier auto-match), this is a no-op by default — pass
    'force: true' to explicitly re-confirm and overwrite it as a manual
    completion. See DECISIONS.md for the full rationale.
    """
    completeScheduledItem(
      id: String!
      notes: String
      force: Boolean
    ): ScheduledItem! @requireAuth

    """
    Marks an item SKIPPED. No-op if the item is already COMPLETED (skipping
    a completed item makes no sense — never overwrites a completion). There
    is no notes field on ScheduledItem itself (only Completion has notes),
    so this mutation intentionally takes no notes param.
    """
    skipScheduledItem(id: String!): ScheduledItem! @requireAuth

    """
    Reschedules an item to a new scheduledAt (day/time move). Simple
    single-field update — see DECISIONS.md for why this isn't drag-and-drop.
    """
    moveScheduledItem(id: String!, scheduledAt: DateTime!): ScheduledItem!
      @requireAuth
  }
`
