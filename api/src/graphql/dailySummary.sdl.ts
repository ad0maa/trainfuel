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
    intakeKcal: Float!
    intakeProteinG: Float!
    intakeCarbsG: Float!
    intakeFatG: Float!
  }

  type Query {
    """
    Today's Level 1 energy target + logged intake so far, for the Dashboard
    calorie/macro ring. Requires a completed Profile (sex/birthDate/heightCm)
    and a resolvable weight (latest DailyMetric.weightKg or
    Profile.currentWeightKg).
    """
    todayEnergySummary: DailyEnergySummary! @requireAuth
  }
`
