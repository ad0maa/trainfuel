import { db } from 'src/lib/db'
import { listStravaActivities } from 'src/lib/integrations/strava'
import type { RawStravaActivity } from 'src/lib/integrations/stravaIngest'
import { getFreshStravaTokens } from 'src/services/integrationAccounts/stravaTokens'

import { ingestStravaActivity } from './externalActivities'

// SPEC.md §4.1: "Backfill: on first connect, pull the last 30 days of
// activities" — diverging deliberately from the donor's `backfill_strava_
// activities` Celery task, which pulled *all* history (see DECISIONS.md).
const BACKFILL_WINDOW_DAYS = 30

/**
 * Paginates through the user's recent Strava activities and ingests each
 * one (upsert + matching). Called two ways: fire-and-forget from
 * `connectStrava` right after OAuth, and manually via
 * `yarn cedar exec backfillStravaActivities` (scripts/backfillStravaActivities.ts)
 * as a recovery path if that fire-and-forget run failed or a fresh backfill
 * is needed. Idempotent either way — `ingestStravaActivity` upserts.
 */
export async function backfillStravaActivitiesForUser(
  userId: string
): Promise<number> {
  const account = await db.integrationAccount.findUnique({
    where: { userId_provider: { userId, provider: 'STRAVA' } },
  })
  if (!account) {
    throw new Error(
      `backfillStravaActivitiesForUser: no Strava IntegrationAccount for user ${userId}`
    )
  }

  const tokens = await getFreshStravaTokens(account)
  const afterUnixSeconds = Math.floor(
    (Date.now() - BACKFILL_WINDOW_DAYS * 24 * 60 * 60 * 1000) / 1000
  )

  let page = 1
  let total = 0

  for (;;) {
    const activities = (await listStravaActivities(tokens.accessToken, {
      after: afterUnixSeconds,
      page,
      perPage: 50,
    })) as RawStravaActivity[]

    if (activities.length === 0) {
      break
    }

    for (const raw of activities) {
      await ingestStravaActivity(userId, raw)
      total++
    }

    page++
  }

  await db.integrationAccount.update({
    where: { id: account.id },
    data: { lastSyncedAt: new Date(), status: 'OK', statusDetail: null },
  })

  return total
}
