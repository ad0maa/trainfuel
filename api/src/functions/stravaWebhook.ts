import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda'

import { db } from 'src/lib/db'
import { getStravaActivity } from 'src/lib/integrations/strava'
import type { RawStravaActivity } from 'src/lib/integrations/stravaIngest'
import { logger } from 'src/lib/logger'
import { ingestStravaActivity } from 'src/services/externalActivities/externalActivities'
import { getFreshStravaTokens } from 'src/services/integrationAccounts/stravaTokens'

// SPEC.md §4.1: Strava's push subscription webhook — single endpoint
// handling both the GET validation challenge and POST activity events.
// Ported from the donor's `sync/views.py` StravaWebhookView, adapted to a
// Cedar Lambda-style function (served at `/api/stravaWebhook` per
// cedar.toml's `apiUrl`). No CSRF exemption needed here the way the
// donor's Django view required one — Cedar's CSRF middleware only wraps the
// dbAuth `auth` function, not arbitrary custom functions like this one.
//
// Processing happens inline, synchronously, rather than being handed to a
// job queue — there is no job runner set up yet (see DECISIONS.md "M3");
// a single activity fetch + ingest is cheap enough that this is fine for
// v1's single-user scale. Errors are logged, not surfaced to Strava: Strava
// retries on any non-2xx response, and retrying an already-failed fetch
// (e.g. a since-deleted activity) would just repeat the failure.

function jsonResponse(
  statusCode: number,
  body: unknown
): APIGatewayProxyResult {
  return {
    statusCode,
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }
}

function handleSubscriptionValidation(
  event: APIGatewayProxyEvent
): APIGatewayProxyResult {
  const params = event.queryStringParameters ?? {}
  const mode = params['hub.mode']
  const token = params['hub.verify_token']
  const challenge = params['hub.challenge']

  if (
    mode === 'subscribe' &&
    challenge &&
    token === process.env.STRAVA_WEBHOOK_VERIFY_TOKEN
  ) {
    return jsonResponse(200, { 'hub.challenge': challenge })
  }
  return jsonResponse(403, { error: 'Forbidden' })
}

async function processActivityEvent(
  athleteId: number,
  activityId: number
): Promise<void> {
  const account = await db.integrationAccount.findFirst({
    where: {
      provider: 'STRAVA',
      meta: { path: ['athleteId'], equals: athleteId },
    },
  })
  if (!account) {
    logger.warn(
      { athleteId },
      'Strava webhook: no IntegrationAccount for athlete'
    )
    return
  }

  const tokens = await getFreshStravaTokens(account)
  const raw = (await getStravaActivity(
    tokens.accessToken,
    activityId
  )) as RawStravaActivity
  await ingestStravaActivity(account.userId, raw)
}

async function handleWebhookEvent(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  let body: {
    object_type?: string
    aspect_type?: string
    owner_id?: number
    object_id?: number
  }
  try {
    body = JSON.parse(event.body ?? '')
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON' })
  }

  if (
    body.object_type === 'activity' &&
    body.aspect_type === 'create' &&
    body.owner_id != null &&
    body.object_id != null
  ) {
    try {
      await processActivityEvent(body.owner_id, body.object_id)
    } catch (error) {
      logger.error(
        { error, event: body },
        'Strava webhook: failed to process activity event'
      )
    }
  }

  // Always 200 quickly — Strava retries on non-2xx.
  return jsonResponse(200, { status: 'ok' })
}

export const handler = async (
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'GET') {
    return handleSubscriptionValidation(event)
  }
  if (event.httpMethod === 'POST') {
    return handleWebhookEvent(event)
  }
  return jsonResponse(405, { error: 'Method Not Allowed' })
}
