export const schema = gql`
  enum Provider {
    STRAVA
    HEVY
    GOOGLE_CALENDAR
  }

  """
  Redacted view of an IntegrationAccount for the Settings screen — never
  exposes accessToken/refreshToken/apiKey (SPEC.md §3.6: "never return raw
  tokens through GraphQL"). Always returned, even when nothing is connected
  yet (connected: false, other fields null), so the client never has to
  null-check the whole result.
  """
  type IntegrationStatus {
    provider: Provider!
    connected: Boolean!
    status: String
    statusDetail: String
    lastSyncedAt: DateTime
  }

  type Query {
    """
    The URL to send the user to for Strava OAuth. STRAVA_CLIENT_ID and
    STRAVA_OAUTH_REDIRECT_URI must be configured (see .env.example).
    """
    stravaConnectUrl: String! @requireAuth

    """
    Connection status for a given provider, scoped to the current user.
    """
    integrationStatus(provider: Provider!): IntegrationStatus! @requireAuth
  }

  type Mutation {
    """
    Exchanges an OAuth 'code' (from the STRAVA_OAUTH_REDIRECT_URI redirect)
    for tokens, stores them (encrypted) on IntegrationAccount, and kicks off
    a 30-day activity backfill in the background. See DECISIONS.md "M3" for
    why the backfill isn't awaited here.
    """
    connectStrava(code: String!): IntegrationStatus! @requireAuth
  }
`
