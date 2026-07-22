import { useState } from 'react'

import type {
  UnmatchedActivitiesQuery,
  UnmatchedActivitiesQueryVariables,
  LinkableScheduledItemsQuery,
  LinkableScheduledItemsQueryVariables,
  LinkExternalActivityMutation,
  LinkExternalActivityMutationVariables,
} from 'types/graphql'

import { useMutation, useQuery } from '@cedarjs/web'
import type {
  CellSuccessProps,
  CellFailureProps,
  TypedDocumentNode,
} from '@cedarjs/web'
import { toast } from '@cedarjs/web/toast'

// SPEC.md §3.3 rule 4's "unplanned activity" tray — activities the matching
// engine (api/src/lib/matching.ts) couldn't auto-tick, either because there
// were zero same-day compatible-type PLANNED sessions, or the activity's
// type has no ScheduledItemType equivalent (e.g. a ride). See
// CONSOLIDATION_PLAN.md Phase 2 / DECISIONS.md "M3".

export const QUERY: TypedDocumentNode<
  UnmatchedActivitiesQuery,
  UnmatchedActivitiesQueryVariables
> = gql`
  query UnmatchedActivitiesQuery {
    unmatchedExternalActivities {
      id
      source
      activityType
      startedAt
      durationSec
      distanceM
    }
  }
`

// Reuses the existing scheduledItems(from, to) query (WeekScheduledItemsCell)
// rather than adding a new backend query — filtered client-side to PLANNED
// RUN/LIFT items, over a wide-enough window that most manual links (a run
// logged a day or two off-plan) will find their match.
const LINKABLE_SCHEDULED_ITEMS_QUERY: TypedDocumentNode<
  LinkableScheduledItemsQuery,
  LinkableScheduledItemsQueryVariables
> = gql`
  query LinkableScheduledItemsQuery($from: DateTime!, $to: DateTime!) {
    scheduledItems(from: $from, to: $to) {
      id
      type
      title
      scheduledAt
      status
    }
  }
`

const LINK_EXTERNAL_ACTIVITY_MUTATION: TypedDocumentNode<
  LinkExternalActivityMutation,
  LinkExternalActivityMutationVariables
> = gql`
  mutation LinkExternalActivityMutation(
    $externalActivityId: String!
    $scheduledItemId: String!
  ) {
    linkExternalActivity(
      externalActivityId: $externalActivityId
      scheduledItemId: $scheduledItemId
    ) {
      id
      status
    }
  }
`

const LINK_WINDOW_DAYS = 14

export const Loading = () => (
  <div className="tf-loading">Loading unmatched activities…</div>
)

export const Empty = () => null // nothing unmatched — don't clutter the dashboard

export const Failure = ({
  error,
}: CellFailureProps<UnmatchedActivitiesQueryVariables>) => (
  <div style={{ color: 'red' }}>Error: {error?.message}</div>
)

type Activity = UnmatchedActivitiesQuery['unmatchedExternalActivities'][number]

function formatDuration(durationSec?: number | null): string | null {
  if (!durationSec) return null
  const minutes = Math.round(durationSec / 60)
  return `${minutes} min`
}

function formatDistance(distanceM?: number | null): string | null {
  if (!distanceM) return null
  return `${(distanceM / 1000).toFixed(1)} km`
}

function ActivityRow({ activity }: { activity: Activity }) {
  const [linking, setLinking] = useState(false)

  const { data, loading: loadingItems } = useQuery(
    LINKABLE_SCHEDULED_ITEMS_QUERY,
    {
      skip: !linking,
      variables: {
        from: new Date(
          Date.now() - LINK_WINDOW_DAYS * 24 * 60 * 60 * 1000
        ).toISOString(),
        to: new Date(
          Date.now() + LINK_WINDOW_DAYS * 24 * 60 * 60 * 1000
        ).toISOString(),
      },
    }
  )

  const [linkActivity, { loading: submitting }] = useMutation(
    LINK_EXTERNAL_ACTIVITY_MUTATION,
    {
      refetchQueries: ['UnmatchedActivitiesQuery', 'TodayScheduledItemsQuery'],
      onError: (error) => toast.error(error.message),
      onCompleted: () => {
        setLinking(false)
        toast.success('Activity linked')
      },
    }
  )

  const linkableItems = (data?.scheduledItems ?? []).filter(
    (item) =>
      item.status === 'PLANNED' && (item.type === 'RUN' || item.type === 'LIFT')
  )

  const distance = formatDistance(activity.distanceM)
  const duration = formatDuration(activity.durationSec)

  return (
    <li className="tf-unmatched-activity">
      <div className="tf-unmatched-activity-main">
        <span className="tf-item-type">{activity.activityType}</span>
        <span>{new Date(activity.startedAt).toLocaleString()}</span>
        {distance && <span>{distance}</span>}
        {duration && <span>{duration}</span>}
        <span className="tf-source-badge">{activity.source}</span>
      </div>

      {linking ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const select = e.currentTarget.elements.namedItem(
              'scheduledItemId'
            ) as HTMLSelectElement
            if (!select.value) return
            linkActivity({
              variables: {
                externalActivityId: activity.id,
                scheduledItemId: select.value,
              },
            })
          }}
        >
          <select name="scheduledItemId" disabled={loadingItems}>
            <option value="">
              {loadingItems ? 'Loading sessions…' : 'Choose a session…'}
            </option>
            {linkableItems.map((item) => (
              <option key={item.id} value={item.id}>
                {new Date(item.scheduledAt).toLocaleDateString()} — {item.title}
              </option>
            ))}
          </select>
          <button type="submit" disabled={submitting}>
            Link
          </button>
          <button type="button" onClick={() => setLinking(false)}>
            Cancel
          </button>
        </form>
      ) : (
        <button type="button" onClick={() => setLinking(true)}>
          Link to a session
        </button>
      )}
    </li>
  )
}

export const Success = ({
  unmatchedExternalActivities,
}: CellSuccessProps<
  UnmatchedActivitiesQuery,
  UnmatchedActivitiesQueryVariables
>) => {
  return (
    <section className="tf-unmatched-activities">
      <h2>Unplanned activities</h2>
      <ul>
        {unmatchedExternalActivities.map((activity) => (
          <ActivityRow key={activity.id} activity={activity} />
        ))}
      </ul>
    </section>
  )
}
