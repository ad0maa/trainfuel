import type {
  TodayScheduledItemsQuery,
  TodayScheduledItemsQueryVariables,
  CompleteScheduledItemMutation,
  CompleteScheduledItemMutationVariables,
  SkipScheduledItemMutation,
  SkipScheduledItemMutationVariables,
} from 'types/graphql'

import { useMutation } from '@cedarjs/web'
import type {
  CellSuccessProps,
  CellFailureProps,
  TypedDocumentNode,
} from '@cedarjs/web'
import { toast } from '@cedarjs/web/toast'

export const QUERY: TypedDocumentNode<
  TodayScheduledItemsQuery,
  TodayScheduledItemsQueryVariables
> = gql`
  query TodayScheduledItemsQuery {
    todayScheduledItems {
      id
      type
      title
      description
      scheduledAt
      durationMin
      status
      completion {
        id
        source
        matchConfidence
        completedAt
      }
    }
  }
`

const COMPLETE_SCHEDULED_ITEM_MUTATION: TypedDocumentNode<
  CompleteScheduledItemMutation,
  CompleteScheduledItemMutationVariables
> = gql`
  mutation CompleteScheduledItemMutation($id: String!) {
    completeScheduledItem(id: $id) {
      id
      status
      completion {
        id
        source
        matchConfidence
        completedAt
      }
    }
  }
`

const SKIP_SCHEDULED_ITEM_MUTATION: TypedDocumentNode<
  SkipScheduledItemMutation,
  SkipScheduledItemMutationVariables
> = gql`
  mutation SkipScheduledItemMutation($id: String!) {
    skipScheduledItem(id: $id) {
      id
      status
    }
  }
`

export const Loading = () => (
  <div className="tf-loading">Loading today&apos;s plan…</div>
)

export const Empty = () => (
  <div className="tf-empty">
    Nothing scheduled for today. Enjoy the rest day.
  </div>
)

export const Failure = ({
  error,
}: CellFailureProps<TodayScheduledItemsQueryVariables>) => (
  <div style={{ color: 'red' }}>Error: {error?.message}</div>
)

const TYPE_LABEL: Record<string, string> = {
  RUN: 'Run',
  LIFT: 'Lift',
  MEDICATION: 'Medication',
  SUPPLEMENT: 'Supplement',
  OTHER: 'Other',
}

const SOURCE_LABEL: Record<string, string> = {
  MANUAL: 'Manual',
  STRAVA: 'via Strava',
  HEVY: 'via Hevy',
  HEALTHKIT: 'via HealthKit',
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const Success = ({
  todayScheduledItems,
}: CellSuccessProps<
  TodayScheduledItemsQuery,
  TodayScheduledItemsQueryVariables
>) => {
  const [completeItem, { loading: completing }] = useMutation(
    COMPLETE_SCHEDULED_ITEM_MUTATION,
    {
      refetchQueries: [{ query: QUERY }],
      onError: (error) => toast.error(error.message),
    }
  )

  const [skipItem, { loading: skipping }] = useMutation(
    SKIP_SCHEDULED_ITEM_MUTATION,
    {
      refetchQueries: [{ query: QUERY }],
      onError: (error) => toast.error(error.message),
    }
  )

  const busy = completing || skipping

  return (
    <div className="tf-today-list">
      {/* TODO(M2): calorie/macro ring — a live Level 1 target vs. today's
          logged intake goes here, above or beside the session list. Leave
          this container as the mount point so it doesn't need restructuring. */}
      <div className="tf-macro-ring-slot" />

      <ul className="tf-item-list">
        {todayScheduledItems.map((item) => {
          const isCompleted = item.status === 'COMPLETED'
          const isSkipped = item.status === 'SKIPPED'

          return (
            <li
              key={item.id}
              className={`tf-item tf-item--${item.status.toLowerCase()}`}
            >
              <div className="tf-item-main">
                <span className="tf-item-type">
                  {TYPE_LABEL[item.type] ?? item.type}
                </span>
                <span className="tf-item-time">
                  {formatTime(item.scheduledAt)}
                </span>
                <span className="tf-item-title">{item.title}</span>
                {item.completion && (
                  <span className="tf-source-badge">
                    {SOURCE_LABEL[item.completion.source] ??
                      item.completion.source}
                  </span>
                )}
              </div>
              {item.description && (
                <p className="tf-item-description">{item.description}</p>
              )}
              <div className="tf-item-actions">
                <button
                  type="button"
                  disabled={busy || isCompleted}
                  onClick={() => completeItem({ variables: { id: item.id } })}
                >
                  {isCompleted ? 'Completed' : 'Tick'}
                </button>
                <button
                  type="button"
                  disabled={busy || isCompleted || isSkipped}
                  onClick={() => skipItem({ variables: { id: item.id } })}
                >
                  {isSkipped ? 'Skipped' : 'Skip'}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
