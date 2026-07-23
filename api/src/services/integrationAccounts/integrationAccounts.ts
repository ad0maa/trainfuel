import type { MutationResolvers, QueryResolvers } from 'types/graphql'

import { UserInputError } from '@cedarjs/graphql-server'

import { encryptToken } from 'src/lib/crypto'
import type { IntegrationAccount } from 'src/lib/db'
import { db } from 'src/lib/db'
import { getHevyUserInfo } from 'src/lib/integrations/hevy'
import {
  exchangeStravaCode,
  getStravaAuthUrl,
} from 'src/lib/integrations/strava'
import { logger } from 'src/lib/logger'
import { pollHevyWorkoutsForUser } from 'src/services/externalActivities/hevyPoll'
import { backfillStravaActivitiesForUser } from 'src/services/externalActivities/stravaBackfill'

// SPEC.md §4.1's OAuth connect/status surface, adapted from the donor's
// `sync/views.py` (StravaConnectView/StravaCallbackView/StravaStatusView)
// to this app's GraphQL-mutation-driven flow (the web app owns the OAuth
// redirect URI and hands the `code` to `connectStrava` — the same pattern
// already reserved for Google Calendar in .env.example, rather than a
// REST callback route). See CONSOLIDATION_PLAN.md Phase 2 / DECISIONS.md "M3".
//
// getFreshStravaTokens lives in ./stravaTokens.ts, not here — it's shared
// with stravaBackfill.ts, and this file already imports *from*
// stravaBackfill.ts (to fire off the post-connect backfill), so keeping the
// token helper here would create a circular import between the two.

// Dot-notation access to a literal env var name (not a generic
// `requireEnv(name)` bracket-access helper) — dynamic `process.env[name]`
// breaks static env-var inlining in production bundlers, Vercel's included.
function stravaRedirectUri(): string {
  const value = process.env.STRAVA_OAUTH_REDIRECT_URI
  if (!value) {
    throw new Error('STRAVA_OAUTH_REDIRECT_URI is not set — see .env.example.')
  }
  return value
}

export const stravaConnectUrl: QueryResolvers['stravaConnectUrl'] = () => {
  return getStravaAuthUrl(stravaRedirectUri())
}

export const connectStrava: MutationResolvers['connectStrava'] = async ({
  code,
}) => {
  const userId = context.currentUser.id
  const auth = await exchangeStravaCode(code)

  const account = await db.integrationAccount.upsert({
    where: { userId_provider: { userId, provider: 'STRAVA' } },
    create: {
      userId,
      provider: 'STRAVA',
      accessToken: encryptToken(auth.accessToken),
      refreshToken: encryptToken(auth.refreshToken),
      expiresAt: auth.expiresAt,
      scope: auth.scope,
      meta: { athleteId: auth.athleteId },
      status: 'OK',
    },
    update: {
      accessToken: encryptToken(auth.accessToken),
      refreshToken: encryptToken(auth.refreshToken),
      expiresAt: auth.expiresAt,
      scope: auth.scope,
      meta: { athleteId: auth.athleteId },
      status: 'OK',
      statusDetail: null,
    },
  })

  // Fire-and-forget backfill, not a durable job — see DECISIONS.md "M3" for
  // why (no job runner set up yet; mirrors M1's cron-deferral). A failure
  // here is recorded on the account's status rather than left silent, and
  // is always re-runnable via `yarn cedar exec backfillStravaActivities`.
  backfillStravaActivitiesForUser(userId).catch(async (error) => {
    logger.error({ error, userId }, 'Strava backfill failed after connect')
    await db.integrationAccount.update({
      where: { id: account.id },
      data: {
        status: 'ERROR',
        statusDetail: error instanceof Error ? error.message : String(error),
      },
    })
  })

  return toIntegrationStatus(account)
}

/**
 * SPEC.md §4.2 / M4: Hevy's connect flow is just "accept + validate +
 * encrypt + store" — no OAuth redirect, unlike Strava/Google. Validates the
 * pasted key with a live call to `GET /v1/user/info` (the cheapest
 * authenticated Hevy endpoint) before persisting, so a typo'd key surfaces
 * immediately in the Settings UI rather than silently failing on the first
 * poll 15 minutes later.
 */
export const connectHevy: MutationResolvers['connectHevy'] = async ({
  apiKey,
}) => {
  const trimmedKey = apiKey.trim()
  if (!trimmedKey) {
    throw new UserInputError('Hevy API key is required.')
  }
  const userId = context.currentUser.id

  const userInfo = await getHevyUserInfo(trimmedKey)

  const account = await db.integrationAccount.upsert({
    where: { userId_provider: { userId, provider: 'HEVY' } },
    create: {
      userId,
      provider: 'HEVY',
      apiKey: encryptToken(trimmedKey),
      meta: { hevyUserId: userInfo.id, hevyUserName: userInfo.name },
      status: 'OK',
    },
    update: {
      apiKey: encryptToken(trimmedKey),
      meta: { hevyUserId: userInfo.id, hevyUserName: userInfo.name },
      status: 'OK',
      statusDetail: null,
    },
  })

  // Fire-and-forget initial poll, not a durable job — same "no job runner
  // yet" gap as connectStrava's backfill (see DECISIONS.md "M3"/"M4"). With
  // no stored cursor, this pulls full workout history (Hevy's own default
  // `since` is the epoch — there's no 30-day-window equivalent for Hevy, see
  // hevyPoll.ts). A failure is recorded on the account's status rather than
  // left silent, and is always re-runnable via
  // `yarn cedar exec pollHevyWorkouts`.
  pollHevyWorkoutsForUser(userId).catch(async (error) => {
    logger.error({ error, userId }, 'Hevy poll failed after connect')
    await db.integrationAccount.update({
      where: { id: account.id },
      data: {
        status: 'ERROR',
        statusDetail: error instanceof Error ? error.message : String(error),
      },
    })
  })

  return toIntegrationStatus(account)
}

export const integrationStatus: QueryResolvers['integrationStatus'] = async ({
  provider,
}) => {
  const account = await db.integrationAccount.findUnique({
    where: {
      userId_provider: { userId: context.currentUser.id, provider },
    },
  })

  if (!account) {
    return {
      provider,
      connected: false,
      status: null,
      statusDetail: null,
      lastSyncedAt: null,
    }
  }

  return toIntegrationStatus(account)
}

function toIntegrationStatus(account: IntegrationAccount) {
  return {
    provider: account.provider,
    connected: true,
    status: account.status,
    statusDetail: account.statusDetail,
    lastSyncedAt: account.lastSyncedAt,
  }
}
