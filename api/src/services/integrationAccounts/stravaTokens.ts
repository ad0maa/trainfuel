import { decryptToken, encryptToken } from 'src/lib/crypto'
import type { IntegrationAccount } from 'src/lib/db'
import { db } from 'src/lib/db'
import type { StravaTokenSet } from 'src/lib/integrations/strava'
import { ensureFreshStravaTokens } from 'src/lib/integrations/strava'

// Split out from integrationAccounts.ts so both that file (connectStrava)
// and stravaBackfill.ts (which needs fresh tokens too) can import this
// without a circular dependency between the two.

/**
 * Shared by the backfill script and the webhook handler: decrypts the
 * stored tokens, refreshes them if they're expiring soon (SPEC.md §4.1:
 * "refresh proactively in the integration client, not in callers" — the
 * client decides *whether* to refresh, this just persists the result), and
 * always returns a currently-valid token set.
 */
export async function getFreshStravaTokens(
  account: Pick<
    IntegrationAccount,
    'id' | 'accessToken' | 'refreshToken' | 'expiresAt'
  >
): Promise<StravaTokenSet> {
  if (!account.accessToken || !account.refreshToken || !account.expiresAt) {
    throw new Error(
      `IntegrationAccount ${account.id} is missing Strava token fields — reconnect required.`
    )
  }

  const stored: StravaTokenSet = {
    accessToken: decryptToken(account.accessToken),
    refreshToken: decryptToken(account.refreshToken),
    expiresAt: account.expiresAt,
  }

  const fresh = await ensureFreshStravaTokens(stored)
  if (fresh.accessToken !== stored.accessToken) {
    await db.integrationAccount.update({
      where: { id: account.id },
      data: {
        accessToken: encryptToken(fresh.accessToken),
        refreshToken: encryptToken(fresh.refreshToken),
        expiresAt: fresh.expiresAt,
      },
    })
  }

  return fresh
}
