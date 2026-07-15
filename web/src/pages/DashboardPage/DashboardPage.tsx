import { Link, routes } from '@cedarjs/router'
import { Metadata } from '@cedarjs/web'

import TodayScheduledItemsCell from 'src/components/TodayScheduledItemsCell'

const DashboardPage = () => {
  return (
    <>
      <Metadata title="Dashboard" description="Today's plan" />

      <main className="tf-page">
        <header className="tf-page-header">
          <h1>Today</h1>
          <Link to={routes.plan()} className="tf-nav-link">
            Plan
          </Link>
        </header>

        <TodayScheduledItemsCell />
      </main>
    </>
  )
}

export default DashboardPage
