export const schema = gql`
  """
  A single day's rollup (SPEC.md §3.5) — weight + intake/target kcal, used
  by the Progress page's weight-trend chart. Named distinctly from the
  Prisma 'DailyMetric' model (rather than reusing that name) because this
  resolver returns a transformed 'date' (a plain date string, not the raw
  Date column) — CedarJS's gqlorm type-mapping infers resolver field types
  from any Prisma model whose name matches a GraphQL type name, which would
  otherwise fight this transformation.
  """
  type DailyMetricPoint {
    date: String!
    weightKg: Float
    intakeKcal: Float
    targetKcal: Float
  }

  type Query {
    """
    The current user's last 'days' days of DailyMetric rows (oldest first),
    for the Progress page's weight-trend chart. Days with no rollup yet
    (never visited, or no food/weight logged) are simply absent — the
    caller should treat this as a sparse series, not a dense one.
    """
    dailyMetrics(days: Int = 90): [DailyMetricPoint!]! @requireAuth
  }
`
