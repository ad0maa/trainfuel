import { Metadata } from '@cedarjs/web'

import DailyEnergySummaryCell from 'src/components/DailyEnergySummaryCell'
import PageHeader from 'src/components/PageHeader/PageHeader'
import TodayScheduledItemsCell from 'src/components/TodayScheduledItemsCell'
import UnmatchedActivitiesCell from 'src/components/UnmatchedActivitiesCell'

const DashboardPage = () => {
  return (
    <>
      <Metadata title="Dashboard" description="Today's plan" />
      <PageHeader title="Today" subtitle="Your plan for today" />

      <DailyEnergySummaryCell />
      <TodayScheduledItemsCell />
      <UnmatchedActivitiesCell />
    </>
  )
}

export default DashboardPage
