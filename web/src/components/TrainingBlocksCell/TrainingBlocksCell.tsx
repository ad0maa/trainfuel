import { useState } from 'react'

import type {
  TrainingBlocksQuery,
  TrainingBlocksQueryVariables,
  CreateTrainingBlockMutation,
  CreateTrainingBlockMutationVariables,
  UpdateTrainingBlockMutation,
  UpdateTrainingBlockMutationVariables,
  DeleteTrainingBlockMutation,
  DeleteTrainingBlockMutationVariables,
  CreateScheduledItemMutation,
  CreateScheduledItemMutationVariables,
} from 'types/graphql'

import { useMutation } from '@cedarjs/web'
import type {
  CellSuccessProps,
  CellFailureProps,
  TypedDocumentNode,
} from '@cedarjs/web'
import { toast } from '@cedarjs/web/toast'

import ScheduledItemForm, {
  type ScheduledItemFormValues,
} from 'src/components/ScheduledItemForm'
import TrainingBlockForm, {
  type TrainingBlockFormValues,
} from 'src/components/TrainingBlockForm'

export const QUERY: TypedDocumentNode<
  TrainingBlocksQuery,
  TrainingBlocksQueryVariables
> = gql`
  query TrainingBlocksQuery {
    trainingBlocks {
      id
      name
      phase
      startDate
      endDate
      notes
      sessions {
        id
      }
    }
  }
`

const CREATE_TRAINING_BLOCK_MUTATION: TypedDocumentNode<
  CreateTrainingBlockMutation,
  CreateTrainingBlockMutationVariables
> = gql`
  mutation CreateTrainingBlockMutation($input: CreateTrainingBlockInput!) {
    createTrainingBlock(input: $input) {
      id
    }
  }
`

const UPDATE_TRAINING_BLOCK_MUTATION: TypedDocumentNode<
  UpdateTrainingBlockMutation,
  UpdateTrainingBlockMutationVariables
> = gql`
  mutation UpdateTrainingBlockMutation(
    $id: String!
    $input: UpdateTrainingBlockInput!
  ) {
    updateTrainingBlock(id: $id, input: $input) {
      id
    }
  }
`

const DELETE_TRAINING_BLOCK_MUTATION: TypedDocumentNode<
  DeleteTrainingBlockMutation,
  DeleteTrainingBlockMutationVariables
> = gql`
  mutation DeleteTrainingBlockMutation($id: String!) {
    deleteTrainingBlock(id: $id) {
      id
    }
  }
`

const CREATE_SCHEDULED_ITEM_MUTATION: TypedDocumentNode<
  CreateScheduledItemMutation,
  CreateScheduledItemMutationVariables
> = gql`
  mutation CreateScheduledItemMutation($input: CreateScheduledItemInput!) {
    createScheduledItem(input: $input) {
      id
    }
  }
`

export const Loading = () => <div className="tf-loading">Loading blocks…</div>

export const Empty = () => (
  <div className="tf-empty">No training blocks yet — create one below.</div>
)

export const Failure = ({
  error,
}: CellFailureProps<TrainingBlocksQueryVariables>) => (
  <div className="tf-cell-error">Error: {error?.message}</div>
)

type Block = TrainingBlocksQuery['trainingBlocks'][number]

function BlockRow({ block }: { block: Block }) {
  const [editing, setEditing] = useState(false)
  const [addingSession, setAddingSession] = useState(false)

  const [updateBlock, { loading: updating }] = useMutation(
    UPDATE_TRAINING_BLOCK_MUTATION,
    {
      refetchQueries: ['TrainingBlocksQuery'],
      onError: (error) => toast.error(error.message),
      onCompleted: () => {
        setEditing(false)
        toast.success('Block updated')
      },
    }
  )

  const [deleteBlock] = useMutation(DELETE_TRAINING_BLOCK_MUTATION, {
    refetchQueries: ['TrainingBlocksQuery'],
    onError: (error) => toast.error(error.message),
    onCompleted: () => toast.success('Block deleted'),
  })

  const [createItem, { loading: creatingItem }] = useMutation(
    CREATE_SCHEDULED_ITEM_MUTATION,
    {
      refetchQueries: ['TrainingBlocksQuery', 'ScheduledItemsForWeekQuery'],
      onError: (error) => toast.error(error.message),
      onCompleted: () => {
        setAddingSession(false)
        toast.success('Session added')
      },
    }
  )

  const handleUpdate = (values: TrainingBlockFormValues) => {
    updateBlock({ variables: { id: block.id, input: values } })
  }

  const handleAddSession = (values: ScheduledItemFormValues) => {
    createItem({ variables: { input: { ...values, blockId: block.id } } })
  }

  return (
    <li className="tf-block">
      {editing ? (
        <TrainingBlockForm
          defaultValues={{ ...block, notes: block.notes ?? undefined }}
          onSave={handleUpdate}
          onCancel={() => setEditing(false)}
          saving={updating}
          submitLabel="Update block"
        />
      ) : (
        <>
          <div className="tf-block-header">
            <h3>{block.name}</h3>
            <span className="tf-phase-badge">{block.phase}</span>
          </div>
          <p className="tf-block-dates">
            {block.startDate.slice(0, 10)} → {block.endDate.slice(0, 10)}
          </p>
          {block.notes && <p className="tf-block-notes">{block.notes}</p>}
          <p className="tf-block-session-count">
            {block.sessions.length} session
            {block.sessions.length === 1 ? '' : 's'}
          </p>
          <div className="tf-block-actions">
            <button type="button" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button
              type="button"
              onClick={() => {
                if (
                  confirm(`Delete "${block.name}"? Sessions become standalone.`)
                ) {
                  deleteBlock({ variables: { id: block.id } })
                }
              }}
            >
              Delete
            </button>
            <button type="button" onClick={() => setAddingSession(true)}>
              Add session
            </button>
          </div>
        </>
      )}

      {addingSession && (
        <ScheduledItemForm
          onSave={handleAddSession}
          onCancel={() => setAddingSession(false)}
          saving={creatingItem}
        />
      )}
    </li>
  )
}

function NewBlockForm() {
  const [showForm, setShowForm] = useState(false)
  const [createBlock, { loading }] = useMutation(
    CREATE_TRAINING_BLOCK_MUTATION,
    {
      refetchQueries: ['TrainingBlocksQuery'],
      onError: (error) => toast.error(error.message),
      onCompleted: () => {
        setShowForm(false)
        toast.success('Block created')
      },
    }
  )

  if (!showForm) {
    return (
      <button type="button" onClick={() => setShowForm(true)}>
        + New block
      </button>
    )
  }

  return (
    <TrainingBlockForm
      onSave={(values) => createBlock({ variables: { input: values } })}
      onCancel={() => setShowForm(false)}
      saving={loading}
      submitLabel="Create block"
    />
  )
}

export const Success = ({
  trainingBlocks,
}: CellSuccessProps<TrainingBlocksQuery, TrainingBlocksQueryVariables>) => {
  return (
    <div className="tf-blocks">
      <ul className="tf-block-list">
        {trainingBlocks.map((block) => (
          <BlockRow key={block.id} block={block} />
        ))}
      </ul>
      <NewBlockForm />
    </div>
  )
}
