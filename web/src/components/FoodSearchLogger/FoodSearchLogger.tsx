import { useState, useEffect, useRef } from 'react'

import type {
  SearchFoodsQuery,
  SearchFoodsQueryVariables,
  CreateFoodLogEntryMutation,
  CreateFoodLogEntryMutationVariables,
} from 'types/graphql'

import { useQuery, useMutation } from '@cedarjs/web'
import type { TypedDocumentNode } from '@cedarjs/web'
import { toast } from '@cedarjs/web/toast'

const SEARCH_FOODS_QUERY: TypedDocumentNode<
  SearchFoodsQuery,
  SearchFoodsQueryVariables
> = gql`
  query SearchFoodsQuery($query: String!) {
    searchFoods(query: $query, limit: 15) {
      id
      name
      brand
      isLiquid
      verified
      servings {
        id
        label
        grams
      }
    }
  }
`

const CREATE_FOOD_LOG_ENTRY_MUTATION: TypedDocumentNode<
  CreateFoodLogEntryMutation,
  CreateFoodLogEntryMutationVariables
> = gql`
  mutation CreateFoodLogEntryMutation($input: CreateFoodLogEntryInput!) {
    createFoodLogEntry(input: $input) {
      id
    }
  }
`

const MEALS = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as const

interface FoodSearchLoggerProps {
  /** The local day (YYYY-MM-DD) being logged for — passed through as the loggedFor variable. */
  loggedFor: Date
}

type SearchFood = SearchFoodsQuery['searchFoods'][number]

/** Debounces `value`, only updating the returned value `delayMs` after the last change. */
function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

function LogEntryForm({
  food,
  loggedFor,
  onDone,
}: {
  food: SearchFood
  loggedFor: Date
  onDone: () => void
}) {
  const [meal, setMeal] = useState<(typeof MEALS)[number]>('BREAKFAST')
  const [unit, setUnit] = useState<'GRAM' | 'SERVING'>('GRAM')
  const [servingId, setServingId] = useState(food.servings[0]?.id ?? '')
  const [quantity, setQuantity] = useState(unit === 'GRAM' ? 100 : 1)

  const [createEntry, { loading }] = useMutation(
    CREATE_FOOD_LOG_ENTRY_MUTATION,
    {
      refetchQueries: ['FoodLogEntriesForDayQuery', 'TodayEnergySummaryQuery'],
      awaitRefetchQueries: true,
      onCompleted: () => {
        toast.success(`Logged ${food.name}`)
        onDone()
      },
      onError: (error) => toast.error(error.message),
    }
  )

  return (
    <form
      className="tf-log-entry-form"
      onSubmit={(e) => {
        e.preventDefault()
        createEntry({
          variables: {
            input: {
              foodId: food.id,
              servingId: unit === 'SERVING' ? servingId : null,
              quantity,
              unit,
              meal,
              loggedFor: loggedFor.toISOString(),
            },
          },
        })
      }}
    >
      <select
        value={meal}
        onChange={(e) => setMeal(e.target.value as (typeof MEALS)[number])}
      >
        {MEALS.map((m) => (
          <option key={m} value={m}>
            {m[0] + m.slice(1).toLowerCase()}
          </option>
        ))}
      </select>

      <input
        type="number"
        min="0"
        step="any"
        value={quantity}
        onChange={(e) => setQuantity(Number(e.target.value))}
      />

      {food.servings.length > 0 ? (
        <select
          value={unit === 'GRAM' ? 'GRAM' : servingId}
          onChange={(e) => {
            if (e.target.value === 'GRAM') {
              setUnit('GRAM')
            } else {
              setUnit('SERVING')
              setServingId(e.target.value)
            }
          }}
        >
          <option value="GRAM">g</option>
          {food.servings.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      ) : (
        <span className="tf-unit-label">g</span>
      )}

      <button type="submit" disabled={loading}>
        Add
      </button>
      <button type="button" onClick={onDone}>
        Cancel
      </button>
    </form>
  )
}

/**
 * Search-as-you-type food picker + inline quantity/meal entry. Not a Cell —
 * this needs live interactive state (debounced search term, selected food)
 * rather than a single query/loading/success lifecycle.
 */
export function FoodSearchLogger({ loggedFor }: FoodSearchLoggerProps) {
  const [term, setTerm] = useState('')
  const debouncedTerm = useDebounced(term, 250)
  const [selected, setSelected] = useState<SearchFood | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { data, loading } = useQuery(SEARCH_FOODS_QUERY, {
    variables: { query: debouncedTerm },
  })

  return (
    <div className="tf-food-search">
      <input
        ref={inputRef}
        type="search"
        placeholder="Search foods…"
        value={term}
        onChange={(e) => {
          setTerm(e.target.value)
          setSelected(null)
        }}
      />

      {selected ? (
        <LogEntryForm
          food={selected}
          loggedFor={loggedFor}
          onDone={() => {
            setSelected(null)
            setTerm('')
            inputRef.current?.focus()
          }}
        />
      ) : (
        <ul className="tf-food-search-results">
          {loading && <li className="tf-loading">Searching…</li>}
          {!loading && data?.searchFoods.length === 0 && term.trim() !== '' && (
            <li className="tf-empty">No foods found.</li>
          )}
          {data?.searchFoods.map((food) => (
            <li key={food.id}>
              <button type="button" onClick={() => setSelected(food)}>
                {food.name}
                {food.brand ? ` (${food.brand})` : ''}
                {!food.verified && (
                  <span className="tf-unverified-hint"> — unverified</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default FoodSearchLogger
