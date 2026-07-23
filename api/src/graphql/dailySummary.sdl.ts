export const schema = gql`
  type DailyEnergySummary {
    """
    The local calendar date (YYYY-MM-DD) this summary is for.
    """
    date: String!
    """
    Level 1 (expenditure-adjusted) daily kcal target — see SPEC.md §6.2.
    """
    targetKcal: Float!
    """
    True if the configured deficit/surplus would have gone below BMR and the floor kicked in — show a gentle note.
    """
    flooredAtBmr: Boolean!
    """
    Level 2 (SPEC.md §6.3) macro targets, derived from targetKcal and
    today's planned RUN/LIFT sessions.
    """
    targetProteinG: Float!
    targetCarbsG: Float!
    targetFatG: Float!
    """
    The day type used to pick the carb tier — 'LONG_RUN' | 'QUALITY_RUN' |
    'TRAINING' | 'REST'.
    """
    dayType: String!
    intakeKcal: Float!
    intakeProteinG: Float!
    intakeCarbsG: Float!
    intakeFatG: Float!
  }

  input TdeeEstimateInput {
    sex: Sex!
    birthDate: DateTime!
    heightCm: Float!
    weightKg: Float!
    activityBaseline: ActivityBaseline!
  }

  type TdeeEstimate {
    bmr: Float!
    tdee: Float!
  }

  type Query {
    """
    Today's Level 1 energy target + logged intake so far, for the Dashboard
    calorie/macro ring. Requires a completed Profile (sex/birthDate/heightCm)
    and a resolvable weight (latest DailyMetric.weightKg or
    Profile.currentWeightKg).
    """
    todayEnergySummary: DailyEnergySummary! @requireAuth

    """
    Standalone BMR/TDEE estimate for the TDEE calculator tool — reuses the
    same Mifflin-St Jeor + activity-multiplier logic as todayEnergySummary
    (SPEC.md §6.1/§6.2), but takes its inputs directly instead of reading
    them from Profile/DailyMetric, so it can be used as a scratch
    calculator before (or without) saving a profile.
    """
    tdeeEstimate(input: TdeeEstimateInput!): TdeeEstimate! @requireAuth
  }
`
