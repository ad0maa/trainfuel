import { useState } from 'react'

import type {
  HevyIntegrationQuery,
  HevyIntegrationQueryVariables,
  ConnectHevyMutation,
  ConnectHevyMutationVariables,
} from 'types/graphql'

import { useMutation } from '@cedarjs/web'
import type {
  CellSuccessProps,
  CellFailureProps,
  TypedDocumentNode,
} from '@cedarjs/web'
import { toast } from '@cedarjs/web/toast'

// SPEC.md §4.2 / §7.1: the Settings screen's Hevy connect/status surface.
// Unlike Strava, there's no OAuth redirect — the user pastes a personal API
// key (requires Hevy Pro, minted at https://hevy.com/settings?developer)
// straight into a form here. See CONSOLIDATION_PLAN.md Phase 3+ /
// DECISIONS.md "M4".

export const QUERY: TypedDocumentNode<
  HevyIntegrationQuery,
  HevyIntegrationQueryVariables
> = gql`
  query HevyIntegrationQuery {
    integrationStatus(provider: HEVY) {
      connected
      status
      statusDetail
      lastSyncedAt
    }
  }
`

const CONNECT_HEVY_MUTATION: TypedDocumentNode<
  ConnectHevyMutation,
  ConnectHevyMutationVariables
> = gql`
  mutation ConnectHevyMutation($apiKey: String!) {
    connectHevy(apiKey: $apiKey) {
      connected
      status
    }
  }
`

export const Loading = () => (
  <div className="tf-loading">Loading Hevy status…</div>
)

export const Empty = () => null

export const Failure = ({
  error,
}: CellFailureProps<HevyIntegrationQueryVariables>) => (
  <div style={{ color: 'red' }}>Error: {error?.message}</div>
)

function ConnectForm() {
  const [apiKey, setApiKey] = useState('')

  const [connectHevy, { loading }] = useMutation(CONNECT_HEVY_MUTATION, {
    refetchQueries: ['HevyIntegrationQuery'],
    onError: (error) => toast.error(error.message),
    onCompleted: () => {
      toast.success('Hevy connected — syncing recent workouts…')
      setApiKey('')
    },
  })

  return (
    <form
      className="tf-hevy-connect-form"
      onSubmit={(e) => {
        e.preventDefault()
        const trimmed = apiKey.trim()
        if (trimmed) {
          connectHevy({ variables: { apiKey: trimmed } })
        }
      }}
    >
      <input
        type="password"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder="Hevy API key"
        aria-label="Hevy API key"
        autoComplete="off"
      />
      <button type="submit" disabled={loading || !apiKey.trim()}>
        Connect Hevy
      </button>
    </form>
  )
}

export const Success = ({
  integrationStatus,
}: CellSuccessProps<HevyIntegrationQuery, HevyIntegrationQueryVariables>) => {
  if (!integrationStatus.connected) {
    return (
      <div className="tf-integration-card">
        <p>
          Not connected — auto-tick your lifts from Hevy (requires Hevy Pro).
          Find your key at{' '}
          <a
            href="https://hevy.com/settings?developer"
            target="_blank"
            rel="noreferrer"
          >
            hevy.com/settings?developer
          </a>
          .
        </p>
        <ConnectForm />
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
      {integrationStatus.status === 'ERROR' && <ConnectForm />}
    </div>
  )
}
