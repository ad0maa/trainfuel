import type {
  FoodLogEntriesForDayQuery,
  FoodLogEntriesForDayQueryVariables,
  DeleteFoodLogEntryMutation,
  DeleteFoodLogEntryMutationVariables,
} from 'types/graphql'

import { useMutation } from '@cedarjs/web'
import type {
  CellSuccessProps,
  CellFailureProps,
  TypedDocumentNode,
} from '@cedarjs/web'
import { toast } from '@cedarjs/web/toast'

export const QUERY: TypedDocumentNode<
  FoodLogEntriesForDayQuery,
  FoodLogEntriesForDayQueryVariables
> = gql`
  query FoodLogEntriesForDayQuery($loggedFor: DateTime!) {
    foodLogEntries(loggedFor: $loggedFor) {
      id
      meal
      quantity
      unit
      nutrients
      food {
        id
        name
        brand
      }
      serving {
        id
        label
      }
    }
  }
`

const DELETE_FOOD_LOG_ENTRY_MUTATION: TypedDocumentNode<
  DeleteFoodLogEntryMutation,
  DeleteFoodLogEntryMutationVariables
> = gql`
  mutation DeleteFoodLogEntryMutation($id: String!) {
    deleteFoodLogEntry(id: $id) {
      id
    }
  }
`

export const Loading = () => <div className="tf-loading">Loading food log…</div>

export const Empty = () => (
  <div className="tf-empty">Nothing logged yet today.</div>
)

export const Failure = ({
  error,
}: CellFailureProps<FoodLogEntriesForDayQueryVariables>) => (
  <div className="tf-cell-error">Error: {error?.message}</div>
)

const MEAL_ORDER = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as const
const MEAL_LABEL: Record<string, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
  SNACK: 'Snack',
}

export const Success = ({
  foodLogEntries,
}: CellSuccessProps<
  FoodLogEntriesForDayQuery,
  FoodLogEntriesForDayQueryVariables
>) => {
  const [deleteEntry, { loading }] = useMutation(
    DELETE_FOOD_LOG_ENTRY_MUTATION,
    {
      refetchQueries: ['FoodLogEntriesForDayQuery'],
      awaitRefetchQueries: true,
      onError: (error) => toast.error(error.message),
    }
  )

  const byMeal = new Map<string, typeof foodLogEntries>()
  for (const entry of foodLogEntries) {
    const existing = byMeal.get(entry.meal) ?? []
    existing.push(entry)
    byMeal.set(entry.meal, existing)
  }

  return (
    <div className="tf-food-log">
      {MEAL_ORDER.filter((meal) => byMeal.has(meal)).map((meal) => (
        <div key={meal} className="tf-meal-section">
          <h3>{MEAL_LABEL[meal]}</h3>
          <ul className="tf-food-entry-list">
            {byMeal.get(meal)!.map((entry) => {
              const nutrients = entry.nutrients as { kcal?: number }
              return (
                <li key={entry.id} className="tf-food-entry">
                  <span className="tf-food-entry-name">
                    {entry.food.name}
                    {entry.food.brand ? ` (${entry.food.brand})` : ''}
                  </span>
                  <span className="tf-food-entry-qty">
                    {entry.quantity}
                    {entry.unit === 'SERVING'
                      ? ` × ${entry.serving?.label ?? 'serving'}`
                      : 'g'}
                  </span>
                  <span className="tf-food-entry-kcal">
                    {Math.round(nutrients.kcal ?? 0)} kcal
                  </span>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => deleteEntry({ variables: { id: entry.id } })}
                  >
                    Remove
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}
