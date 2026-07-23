export const schema = gql`
  type Food {
    id: String!
    name: String!
    brand: String
    source: FoodSource!
    externalId: String
    barcode: String

    """
    Canonical nutrients per 100g (or per 100mL if isLiquid) —
    { kcal, proteinG, carbsG, fatG, fibreG?, sugarG?, sodiumMg?, ... }.
    """
    per100: JSON!
    isLiquid: Boolean!
    servings: [FoodServing!]!
    verified: Boolean!
    createdByUserId: String
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type FoodServing {
    id: String!
    foodId: String!
    label: String!
    grams: Float!
  }

  enum FoodSource {
    AFCD
    OFF
    USDA
    CUSTOM
  }

  type Query {
    """
    Local-DB food search (Postgres trigram similarity), boosted so the
    current user's recent/frequent foods (last 90 days of FoodLogEntry)
    surface first. A blank/omitted query returns recent/frequent foods only.
    """
    searchFoods(query: String!, limit: Int): [Food!]! @requireAuth

    food(id: String!): Food @requireAuth

    """
    Barcode lookup for the mobile scanner (SPEC.md §4.4/§4.5): checks the
    local Food table first, then falls back to a live Open Food Facts
    lookup, caching the result locally on a hit. Returns null if the
    barcode isn't found locally or on OFF, or if OFF's product is missing
    required nutrients (kcal + all three macros per 100g) — the mobile
    client should fall back to manual entry/search in that case.
    """
    foodByBarcode(barcode: String!): Food @requireAuth
  }
`
