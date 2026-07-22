import { useState } from 'react'

import { Link, routes } from '@cedarjs/router'
import { Metadata } from '@cedarjs/web'

import DailyEnergySummaryCell from 'src/components/DailyEnergySummaryCell'
import FoodLogEntriesCell from 'src/components/FoodLogEntriesCell'
import { FoodSearchLogger } from 'src/components/FoodSearchLogger'

function toDateInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const FoodLogPage = () => {
  const [date, setDate] = useState(() => new Date())

  return (
    <>
      <Metadata title="Food Log" description="Daily food log" />

      <main className="tf-page">
        <header className="tf-page-header">
          <h1>Food log</h1>
          <Link to={routes.home()} className="tf-nav-link">
            Today
          </Link>
        </header>

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
      </main>
    </>
  )
}

export default FoodLogPage
