import type {
  StravaIntegrationQuery,
  StravaIntegrationQueryVariables,
  StravaConnectUrlQuery,
  StravaConnectUrlQueryVariables,
} from 'types/graphql'

import { useQuery } from '@cedarjs/web'
import type {
  CellSuccessProps,
  CellFailureProps,
  TypedDocumentNode,
} from '@cedarjs/web'

// SPEC.md §4.1 / §7.1: the Settings screen's integration connect/status
// surface. See CONSOLIDATION_PLAN.md Phase 2 / DECISIONS.md "M3".

export const QUERY: TypedDocumentNode<
  StravaIntegrationQuery,
  StravaIntegrationQueryVariables
> = gql`
  query StravaIntegrationQuery {
    integrationStatus(provider: STRAVA) {
      connected
      status
      statusDetail
      lastSyncedAt
    }
  }
`

const STRAVA_CONNECT_URL_QUERY: TypedDocumentNode<
  StravaConnectUrlQuery,
  StravaConnectUrlQueryVariables
> = gql`
  query StravaConnectUrlQuery {
    stravaConnectUrl
  }
`

export const Loading = () => (
  <div className="tf-loading">Loading Strava status…</div>
)

export const Empty = () => null

export const Failure = ({
  error,
}: CellFailureProps<StravaIntegrationQueryVariables>) => (
  <div style={{ color: 'red' }}>Error: {error?.message}</div>
)

function ConnectButton() {
  // Fetched eagerly (cheap — a single string) so the button is immediately
  // clickable rather than round-tripping on click.
  const { data, loading, error } = useQuery(STRAVA_CONNECT_URL_QUERY)

  // STRAVA_CLIENT_ID/STRAVA_OAUTH_REDIRECT_URI not being configured on this
  // deployment throws server-side (see stravaConnectUrl in
  // integrationAccounts.ts) — surface that as a real message rather than a
  // silently-disabled button with no explanation.
  if (error) {
    return (
      <p className="tf-integration-error">
        Strava isn&apos;t configured on this deployment yet (no STRAVA_CLIENT_ID
        set).
      </p>
    )
  }

  return (
    <button
      type="button"
      disabled={loading || !data?.stravaConnectUrl}
      onClick={() => {
        if (data?.stravaConnectUrl) {
          window.location.href = data.stravaConnectUrl
        }
      }}
    >
      Connect Strava
    </button>
  )
}

export const Success = ({
  integrationStatus,
}: CellSuccessProps<
  StravaIntegrationQuery,
  StravaIntegrationQueryVariables
>) => {
  if (!integrationStatus.connected) {
    return (
      <div className="tf-integration-card">
        <p>Not connected — auto-tick your runs from Strava.</p>
        <ConnectButton />
      </div>
    )
  }

  return (
    <div className="tf-integration-card">
      <p>
        Connected
        {integrationStatus.status === 'ERROR' && (
          <span className="tf-status-badge tf-status--error"> — error</span>
        )}
      </p>
      {integrationStatus.statusDetail && (
        <p className="tf-integration-error">{integrationStatus.statusDetail}</p>
      )}
      {integrationStatus.lastSyncedAt && (
        <p className="tf-integration-synced">
          Last synced{' '}
          {new Date(integrationStatus.lastSyncedAt).toLocaleString()}
        </p>
      )}
      {integrationStatus.status === 'ERROR' && <ConnectButton />}
    </div>
  )
}
