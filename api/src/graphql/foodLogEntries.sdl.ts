export const schema = gql`
  type FoodLogEntry {
    id: String!
    userId: String!
    foodId: String!
    food: Food!
    loggedFor: DateTime!
    meal: MealSlot!
    quantity: Float!
    unit: LogUnit!
    servingId: String
    serving: FoodServing

    """
    Computed nutrient snapshot at log time (immutable — see SPEC.md §3.4).
    { kcal, proteinG, carbsG, fatG, ...whatever optional fields Food.per100 had }.
    """
    nutrients: JSON!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  enum MealSlot {
    BREAKFAST
    LUNCH
    DINNER
    SNACK
  }

  enum LogUnit {
    SERVING
    GRAM
  }

  type Query {
    """
    The current user's food log entries for the local day containing
    'loggedFor' (defaults to today, via the shared localDay helper).
    """
    foodLogEntries(loggedFor: DateTime): [FoodLogEntry!]! @requireAuth
  }

  input CreateFoodLogEntryInput {
    foodId: String!
    servingId: String
    quantity: Float!
    unit: LogUnit!
    meal: MealSlot!
    """
    Defaults to today (in the user's local timezone) if omitted.
    """
    loggedFor: DateTime
  }

  input UpdateFoodLogEntryInput {
    foodId: String
    servingId: String
    quantity: Float
    unit: LogUnit
    meal: MealSlot
    loggedFor: DateTime
  }

  type Mutation {
    """
    Computes and snapshots the nutrient values from Food.per100 (+ serving
    grams, if unit is SERVING) at creation time, then rolls up the affected
    day's DailyMetric intake* fields.
    """
    createFoodLogEntry(input: CreateFoodLogEntryInput!): FoodLogEntry!
      @requireAuth
    updateFoodLogEntry(
      id: String!
      input: UpdateFoodLogEntryInput!
    ): FoodLogEntry! @requireAuth
    deleteFoodLogEntry(id: String!): FoodLogEntry! @requireAuth
  }
`
