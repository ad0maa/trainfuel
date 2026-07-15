import { useState } from 'react'

import type {
  ScheduledItemsForWeekQuery,
  ScheduledItemsForWeekQueryVariables,
  MoveScheduledItemMutation,
  MoveScheduledItemMutationVariables,
} from 'types/graphql'

import { useMutation } from '@cedarjs/web'
import type {
  CellSuccessProps,
  CellFailureProps,
  TypedDocumentNode,
} from '@cedarjs/web'
import { toast } from '@cedarjs/web/toast'

export const QUERY: TypedDocumentNode<
  ScheduledItemsForWeekQuery,
  ScheduledItemsForWeekQueryVariables
> = gql`
  query ScheduledItemsForWeekQuery($from: DateTime!, $to: DateTime!) {
    scheduledItems(from: $from, to: $to) {
      id
      type
      title
      scheduledAt
      status
      block {
        id
        name
      }
    }
  }
`

const MOVE_SCHEDULED_ITEM_MUTATION: TypedDocumentNode<
  MoveScheduledItemMutation,
  MoveScheduledItemMutationVariables
> = gql`
  mutation MoveScheduledItemMutation($id: String!, $scheduledAt: DateTime!) {
    moveScheduledItem(id: $id, scheduledAt: $scheduledAt) {
      id
      scheduledAt
    }
  }
`

export const Loading = () => <div className="tf-loading">Loading week…</div>

export const Empty = () => (
  <div className="tf-empty">No sessions scheduled this week.</div>
)

export const Failure = ({
  error,
}: CellFailureProps<ScheduledItemsForWeekQueryVariables>) => (
  <div style={{ color: 'red' }}>Error: {error?.message}</div>
)

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Local input value like "2026-07-15T20:00" for <input type="datetime-local">
function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`
}

interface ItemRowProps {
  item: ScheduledItemsForWeekQuery['scheduledItems'][number]
}

function ItemRow({ item }: ItemRowProps) {
  const [editing, setEditing] = useState(false)
  const [moveItem, { loading }] = useMutation(MOVE_SCHEDULED_ITEM_MUTATION, {
    // Refetch by operation name so it matches whatever [from, to] variables
    // the currently-mounted week view is using, rather than trying to
    // reconstruct them here.
    refetchQueries: ['ScheduledItemsForWeekQuery'],
    awaitRefetchQueries: true,
    onError: (error) => toast.error(error.message),
    onCompleted: () => {
      setEditing(false)
      toast.success('Session moved')
    },
  })

  return (
    <li className="tf-week-item">
      <div className="tf-week-item-main">
        <span className="tf-item-type">{item.type}</span>
        <span className="tf-item-title">{item.title}</span>
        {item.block && <span className="tf-item-block">{item.block.name}</span>}
        <span
          className={`tf-status-badge tf-status--${item.status.toLowerCase()}`}
        >
          {item.status}
        </span>
      </div>
      <div className="tf-week-item-actions">
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const form = e.currentTarget
              const value = (
                form.elements.namedItem('scheduledAt') as HTMLInputElement
              ).value
              if (!value) return
              moveItem({
                variables: {
                  id: item.id,
                  scheduledAt: new Date(value).toISOString(),
                },
              })
            }}
          >
            <input
              type="datetime-local"
              name="scheduledAt"
              defaultValue={toDatetimeLocalValue(item.scheduledAt)}
            />
            <button type="submit" disabled={loading}>
              Save
            </button>
            <button type="button" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </form>
        ) : (
          <button type="button" onClick={() => setEditing(true)}>
            Move
          </button>
        )}
      </div>
    </li>
  )
}

export const Success = ({
  scheduledItems,
}: CellSuccessProps<
  ScheduledItemsForWeekQuery,
  ScheduledItemsForWeekQueryVariables
>) => {
  const byDay = new Map<string, typeof scheduledItems>()
  for (const item of scheduledItems) {
    const dayKey = item.scheduledAt.slice(0, 10)
    const existing = byDay.get(dayKey) ?? []
    existing.push(item)
    byDay.set(dayKey, existing)
  }
  const sortedDays = Array.from(byDay.keys()).sort()

  return (
    <div className="tf-week-view">
      {sortedDays.map((dayKey) => {
        const date = new Date(`${dayKey}T00:00:00`)
        const label = `${DAY_LABELS[(date.getDay() + 6) % 7]} ${dayKey}`
        return (
          <div key={dayKey} className="tf-week-day">
            <h3>{label}</h3>
            <ul>
              {byDay.get(dayKey)!.map((item) => (
                <ItemRow key={item.id} item={item} />
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
