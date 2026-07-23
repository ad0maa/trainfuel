export const schema = gql`
  enum Sex {
    MALE
    FEMALE
  }

  enum ActivityBaseline {
    SEDENTARY
    LIGHT
    MODERATE
    ACTIVE
    VERY_ACTIVE
  }

  type Profile {
    id: String!
    sex: Sex!
    birthDate: DateTime!
    heightCm: Float!
    goalWeightKg: Float
    weeklyWeightDeltaKg: Float
    activityBaseline: ActivityBaseline!
    proteinTargetGPerDay: Float
    timezone: String!
    """
    Falls back for BMR (SPEC.md §6.1) when there's no DailyMetric.weightKg
    yet — see DECISIONS.md "Schema gap fix".
    """
    currentWeightKg: Float
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Query {
    """
    The current user's profile, or null if they haven't completed
    onboarding yet — every energy-target calculation requires this to
    exist first (see todayEnergySummary's error when it's missing).
    """
    myProfile: Profile @requireAuth
  }

  input SaveProfileInput {
    sex: Sex!
    birthDate: DateTime!
    heightCm: Float!
    goalWeightKg: Float
    """
    e.g. -0.4 for a deficit pacing toward a goal weight. Clamped to
    [-1.0, 0.5] kg/week server-side — a runaway value here would produce an
    unsafe calorie target downstream. See DECISIONS.md.
    """
    weeklyWeightDeltaKg: Float
    activityBaseline: ActivityBaseline
    proteinTargetGPerDay: Float
    timezone: String
    currentWeightKg: Float
  }

  type Mutation {
    """
    Creates the current user's profile if it doesn't exist yet, else
    updates it (upsert — there is only ever one Profile per user).
    """
    saveProfile(input: SaveProfileInput!): Profile! @requireAuth
  }
`
