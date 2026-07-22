// SPEC.md §4.1: manual/recovery counterpart to the fire-and-forget backfill
// `connectStrava` kicks off automatically after OAuth (see DECISIONS.md
// "M3" for why that isn't a durable job). Re-run this any time — it's
// idempotent (ingestStravaActivity upserts on source+externalId).
//
// Usage:
//   yarn cedar exec backfillStravaActivities --userId <id>   # one user (required)
//   yarn cedar exec backfillStravaActivities --all           # every user with a Strava connection

import { db } from 'api/src/lib/db'
import { backfillStravaActivitiesForUser } from 'api/src/services/externalActivities/stravaBackfill'

interface ScriptArgs {
  _: string[]
  userId?: string
  all?: boolean
  [key: string]: unknown
}

export default async ({ args }: { args: ScriptArgs }) => {
  if (!args.userId && !args.all) {
    console.error(
      'backfillStravaActivities: pass --userId <id> or --all. See the file header for usage.'
    )
    process.exitCode = 1
    return
  }

  const userIds = args.userId
    ? [args.userId]
    : (
        await db.integrationAccount.findMany({
          where: { provider: 'STRAVA' },
          select: { userId: true },
        })
      ).map((account) => account.userId)

  let totalActivities = 0
  for (const userId of userIds) {
    const count = await backfillStravaActivitiesForUser(userId)
    console.log(
      `backfillStravaActivities: user ${userId} — ${count} activity(ies) ingested`
    )
    totalActivities += count
  }

  console.log(
    `backfillStravaActivities: done. ${totalActivities} activity(ies) across ${userIds.length} user(s).`
  )
}
