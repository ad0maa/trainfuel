export const schema = gql`
  """
  Which static template to generate from — see CONSOLIDATION_PLAN.md Phase 1
  and api/src/lib/planTemplates/templates.ts. GraphQL enum names can't start
  with a digit, hence the descriptive naming rather than "5K"/"10K".
  """
  enum PlanGoalType {
    COUCH_TO_5K
    FIVE_K
    TEN_K
    HALF_MARATHON
  }

  type FeasibilityResult {
    isFeasible: Boolean!
    weeksRemaining: Int!
    suggestedGoalDate: DateTime!
    message: String!
  }

  type GeneratedTrainingPlan {
    """
    The template week number (1-based) the runner entered at, based on
    currentWeeklyKm — see findEntryWeek in generatePlan.ts.
    """
    entryWeekNo: Int!
    """
    Present only when 'goalDate' was supplied. Null goal dates skip the
    feasibility gate entirely (open-ended plan, no target race date yet).
    """
    feasibility: FeasibilityResult
    blocks: [TrainingBlock!]!
  }

  input GenerateTrainingPlanInput {
    goalType: PlanGoalType!
    """
    Ignored for COUCH_TO_5K, which is duration-based and always starts at
    week 1 regardless of current volume.
    """
    currentWeeklyKm: Float!
    """
    Sessions are anchored to the Monday on/after this date (in the user's
    Profile.timezone), not this exact date.
    """
    startDate: DateTime!
    """
    Optional target race/goal date. When supplied, triggers the
    feasibility gate (GeneratedTrainingPlan.feasibility).
    """
    goalDate: DateTime
    """
    Set true to generate the plan even if it overlaps existing RUN items
    for this user — otherwise an overlap is rejected so a plan can't be
    silently double-booked over an existing one.
    """
    confirmOverlap: Boolean
  }

  type Mutation {
    """
    Generates a full training plan (TrainingBlocks + RUN ScheduledItems)
    from a static template (SPEC.md §7.1's "template auto-generation"
    stretch goal), entering at the week matching the runner's current
    fitness. See CONSOLIDATION_PLAN.md Phase 1 / DECISIONS.md "M2.5".
    """
    generateTrainingPlan(
      input: GenerateTrainingPlanInput!
    ): GeneratedTrainingPlan! @requireAuth
  }
`
