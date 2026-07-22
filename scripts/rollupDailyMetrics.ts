// SPEC.md §3.5: "A nightly job (and on-write triggers where cheap) maintains
// this table [DailyMetric]." The on-write trigger lives in
// api/src/services/foodLogEntries/foodLogEntries.ts (every create/update/
// delete recomputes that day's rollup immediately); this script is the
// nightly/backfill counterpart — safe to re-run for any date range, purely
// additive/corrective (upsert, never destructive).
//
// Usage:
//   yarn cedar exec rollupDailyMetrics                       # yesterday + today, all users
//   yarn cedar exec rollupDailyMetrics --days 30              # last 30 days, all users
//   yarn cedar exec rollupDailyMetrics --userId <id> --days 7 # one user

import { addLocalDays, localDay } from 'api/src/lib/date/localDay'
import { db } from 'api/src/lib/db'
import { upsertDailyIntakeRollup } from 'api/src/services/dailyMetrics/dailyMetrics'

interface ScriptArgs {
  _: string[]
  days?: number
  userId?: string
  [key: string]: unknown
}

export default async ({ args }: { args: ScriptArgs }) => {
  const days = args.days ?? 2
  const users = args.userId
    ? [{ id: args.userId }]
    : await db.user.findMany({ select: { id: true } })

  let rollupCount = 0

  for (const user of users) {
    const todayStr = await localDay(user.id, new Date())
    for (let i = 0; i < days; i++) {
      const dateStr = addLocalDays(todayStr, -i)
      await upsertDailyIntakeRollup(user.id, dateStr)
      rollupCount++
    }
  }

  console.log(
    `rollupDailyMetrics: refreshed ${rollupCount} user/day rollup(s) across ${users.length} user(s), ${days} day(s) back.`
  )
}
