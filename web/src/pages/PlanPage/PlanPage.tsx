import { useState } from 'react'

import { Metadata } from '@cedarjs/web'

import GenerateTrainingPlanForm from 'src/components/GenerateTrainingPlanForm'
import PageHeader from 'src/components/PageHeader/PageHeader'
import TrainingBlocksCell from 'src/components/TrainingBlocksCell'
import WeekScheduledItemsCell from 'src/components/WeekScheduledItemsCell'

// Monday-start week containing `date`, as [startOfMonday, startOfNextMonday).
// Client-side, browser-local computation — good enough for a multi-day
// overview grid (unlike the Today screen, which must use the shared
// localDay/Profile.timezone helper for exact day-boundary precision; see
// DECISIONS.md).
function mondayStartingWeek(date: Date): { from: Date; to: Date } {
  const day = date.getDay() // 0 = Sunday
  const diffToMonday = (day + 6) % 7
  const monday = new Date(date)
  monday.setHours(0, 0, 0, 0)
  monday.setDate(monday.getDate() - diffToMonday)
  const nextMonday = new Date(monday)
  nextMonday.setDate(monday.getDate() + 7)
  return { from: monday, to: nextMonday }
}

const PlanPage = () => {
  const [weekAnchor, setWeekAnchor] = useState(() => new Date())
  const { from, to } = mondayStartingWeek(weekAnchor)

  return (
    <>
      <Metadata
        title="Plan"
        description="Training blocks and weekly schedule"
      />
      <PageHeader title="Plan" subtitle="Training blocks & weekly schedule" />

      <section className="tf-plan-section">
        <h2>Blocks</h2>
        <TrainingBlocksCell />
        <GenerateTrainingPlanForm />
      </section>

      <section className="tf-plan-section">
        <div className="tf-week-nav">
          <button
            type="button"
            onClick={() =>
              setWeekAnchor((d) => {
                const next = new Date(d)
                next.setDate(next.getDate() - 7)
                return next
              })
            }
          >
            ← Previous week
          </button>
          <h2>
            Week of {from.toLocaleDateString()} –{' '}
            {new Date(to.getTime() - 1).toLocaleDateString()}
          </h2>
          <button
            type="button"
            onClick={() =>
              setWeekAnchor((d) => {
                const next = new Date(d)
                next.setDate(next.getDate() + 7)
                return next
              })
            }
          >
            Next week →
          </button>
        </div>
        <WeekScheduledItemsCell
          from={from.toISOString()}
          to={to.toISOString()}
        />
      </section>
    </>
  )
}

export default PlanPage
