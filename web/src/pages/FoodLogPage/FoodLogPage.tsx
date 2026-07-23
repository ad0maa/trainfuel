import { useState } from 'react'

import { Metadata } from '@cedarjs/web'

import DailyEnergySummaryCell from 'src/components/DailyEnergySummaryCell'
import FoodLogEntriesCell from 'src/components/FoodLogEntriesCell'
import { FoodSearchLogger } from 'src/components/FoodSearchLogger'
import PageHeader from 'src/components/PageHeader/PageHeader'

function toDateInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const FoodLogPage = () => {
  const [date, setDate] = useState(() => new Date())

  return (
    <>
      <Metadata title="Food Log" description="Daily food log" />
      <PageHeader title="Food log" subtitle="Meals, macros & daily totals" />

      <div className="tf-date-nav">
        <input
          type="date"
          value={toDateInputValue(date)}
          onChange={(e) => {
            if (!e.target.value) return
            // Construct at local noon to stay clear of any DST-boundary
            // edge cases when this gets serialized to an ISO instant.
            setDate(new Date(`${e.target.value}T12:00:00`))
          }}
        />
      </div>

      <DailyEnergySummaryCell />

      <section className="tf-plan-section">
        <h2>Add food</h2>
        <FoodSearchLogger loggedFor={date} />
      </section>

      <section className="tf-plan-section">
        <FoodLogEntriesCell loggedFor={date.toISOString()} />
      </section>
    </>
  )
}

export default FoodLogPage
