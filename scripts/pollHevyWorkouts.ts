// SPEC.md §4.2: "scheduled job every 15 min" for Hevy workouts. There is no
// job runner set up in this codebase yet (same gap M1/M3 left open — see
// DECISIONS.md), so this script is both the manual/recovery path *and* the
// thing an external scheduler (hosting-platform cron/scheduled function,
// system cron, or a future Cedar background job) needs to invoke every 15
// minutes to actually satisfy "poll job every 15 min." Nothing in this repo
// currently calls it on a timer — wiring that up is a follow-up once
// hosting/job-runner is decided (see DECISIONS.md "M4").
//
// Idempotent either way — pollHevyWorkoutsForUser upserts on
// source+externalId and advances a stored cursor, so overlapping/duplicate
// runs are safe no-ops.
//
// Usage:
//   yarn cedar exec pollHevyWorkouts --userId <id>   # one user (required)
//   yarn cedar exec pollHevyWorkouts --all           # every user with a Hevy connection

import { db } from 'api/src/lib/db'
import { pollHevyWorkoutsForUser } from 'api/src/services/externalActivities/hevyPoll'

interface ScriptArgs {
  _: string[]
  userId?: string
  all?: boolean
  [key: string]: unknown
}

export default async ({ args }: { args: ScriptArgs }) => {
  if (!args.userId && !args.all) {
    console.error(
      'pollHevyWorkouts: pass --userId <id> or --all. See the file header for usage.'
    )
    process.exitCode = 1
    return
  }

  const userIds = args.userId
    ? [args.userId]
    : (
        await db.integrationAccount.findMany({
          where: { provider: 'HEVY' },
          select: { userId: true },
        })
      ).map((account) => account.userId)

  let totalUpdated = 0
  let totalDeleted = 0
  for (const userId of userIds) {
    const { updated, deleted } = await pollHevyWorkoutsForUser(userId)
    console.log(
      `pollHevyWorkouts: user ${userId} — ${updated} updated, ${deleted} deleted`
    )
    totalUpdated += updated
    totalDeleted += deleted
  }

  console.log(
    `pollHevyWorkouts: done. ${totalUpdated} updated, ${totalDeleted} deleted across ${userIds.length} user(s).`
  )
}
