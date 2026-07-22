import { Link, routes } from '@cedarjs/router'
import { Metadata } from '@cedarjs/web'

import DailyEnergySummaryCell from 'src/components/DailyEnergySummaryCell'
import TodayScheduledItemsCell from 'src/components/TodayScheduledItemsCell'
import UnmatchedActivitiesCell from 'src/components/UnmatchedActivitiesCell'

const DashboardPage = () => {
  return (
    <>
      <Metadata title="Dashboard" description="Today's plan" />

      <main className="tf-page">
        <header className="tf-page-header">
          <h1>Today</h1>
          <nav className="tf-page-nav">
            <Link to={routes.foodLog()} className="tf-nav-link">
              Food log
            </Link>
            <Link to={routes.plan()} className="tf-nav-link">
              Plan
            </Link>
            <Link to={routes.settings()} className="tf-nav-link">
              Settings
            </Link>
          </nav>
        </header>

        <DailyEnergySummaryCell />
        <TodayScheduledItemsCell />
        <UnmatchedActivitiesCell />
      </main>
    </>
  )
}

export default DashboardPage
