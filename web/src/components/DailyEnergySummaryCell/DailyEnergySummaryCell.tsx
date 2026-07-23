import type { CSSProperties } from 'react'

import type {
  TodayEnergySummaryQuery,
  TodayEnergySummaryQueryVariables,
} from 'types/graphql'

import type {
  CellSuccessProps,
  CellFailureProps,
  TypedDocumentNode,
} from '@cedarjs/web'

export const QUERY: TypedDocumentNode<
  TodayEnergySummaryQuery,
  TodayEnergySummaryQueryVariables
> = gql`
  query TodayEnergySummaryQuery {
    todayEnergySummary {
      date
      targetKcal
      flooredAtBmr
      targetProteinG
      targetCarbsG
      targetFatG
      dayType
      intakeKcal
      intakeProteinG
      intakeCarbsG
      intakeFatG
    }
  }
`

export const Loading = () => (
  <div className="tf-loading">Loading today&apos;s targets…</div>
)

export const Empty = () => null

// A missing Profile/weight is a normal, expected state pre-M7 Settings
// screen (no profile-setup UI exists yet) — show a quiet nudge instead of a
// red error box, since this isn't actually a failure the user can't explain.
export const Failure = ({
  error,
}: CellFailureProps<TodayEnergySummaryQueryVariables>) => (
  <div className="tf-energy-summary tf-energy-summary--incomplete">
    {error?.message?.includes('profile') || error?.message?.includes('weight')
      ? error.message
      : `Error: ${error?.message}`}
  </div>
)

function round(n: number): number {
  return Math.round(n)
}

const DAY_TYPE_LABELS: Record<string, string> = {
  LONG_RUN: 'Long run day',
  QUALITY_RUN: 'Quality run day',
  TRAINING: 'Training day',
  REST: 'Rest day',
}

export const Success = ({
  todayEnergySummary,
}: CellSuccessProps<
  TodayEnergySummaryQuery,
  TodayEnergySummaryQueryVariables
>) => {
  const {
    targetKcal,
    intakeKcal,
    intakeProteinG,
    intakeCarbsG,
    intakeFatG,
    targetProteinG,
    targetCarbsG,
    targetFatG,
    dayType,
    flooredAtBmr,
  } = todayEnergySummary
  const remaining = targetKcal - intakeKcal
  const pct =
    targetKcal > 0
      ? Math.min(100, Math.max(0, (intakeKcal / targetKcal) * 100))
      : 0

  return (
    <div className="tf-energy-summary">
      <div className="tf-energy-summary-daytype">
        <span className="tf-badge tf-badge-ok">
          {DAY_TYPE_LABELS[dayType] ?? dayType}
        </span>
      </div>

      <div
        className="tf-energy-ring"
        role="img"
        aria-label={`${round(intakeKcal)} of ${round(targetKcal)} kcal logged today`}
        style={{ '--tf-ring-pct': `${pct}%` } as CSSProperties}
      >
        <div className="tf-energy-ring-fill" />
        <div className="tf-energy-ring-center">
          <span className="tf-energy-ring-value">{round(remaining)}</span>
          <span className="tf-energy-ring-label">kcal left</span>
        </div>
      </div>

      <dl className="tf-macro-list">
        <div>
          <dt>Target</dt>
          <dd>{round(targetKcal)} kcal</dd>
        </div>
        <div>
          <dt>Logged</dt>
          <dd>{round(intakeKcal)} kcal</dd>
        </div>
        <div>
          <dt>Protein</dt>
          <dd>
            {round(intakeProteinG)} / {round(targetProteinG)} g
          </dd>
        </div>
        <div>
          <dt>Carbs</dt>
          <dd>
            {round(intakeCarbsG)} / {round(targetCarbsG)} g
          </dd>
        </div>
        <div>
          <dt>Fat</dt>
          <dd>
            {round(intakeFatG)} / {round(targetFatG)} g
          </dd>
        </div>
      </dl>

      {flooredAtBmr && (
        <p className="tf-energy-note">
          Your target is capped at your BMR — the configured deficit would
          otherwise go below it.
        </p>
      )}
    </div>
  )
}
