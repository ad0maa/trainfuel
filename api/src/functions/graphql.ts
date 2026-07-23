import type { Decoder } from '@cedarjs/api'
import { createAuthDecoder } from '@cedarjs/auth-dbauth-api'
import { createGraphQLHandler } from '@cedarjs/graphql-server'

import directives from 'src/directives/**/*.{js,ts}'
import sdls from 'src/graphql/**/*.sdl.{js,ts}'
import services from 'src/services/**/*.{js,ts}'

import { cookieName, getCurrentUser } from 'src/lib/auth'
import { db } from 'src/lib/db'
import { logger } from 'src/lib/logger'
import { verifyMobileToken } from 'src/lib/mobileAuthToken'

const dbAuthDecoder = createAuthDecoder(cookieName)

// Mobile sends `Authorization: Bearer <token>` + `auth-provider: mobile`
// (the header @cedarjs/api's getAuthenticationContext uses to pick which
// decoder in this array gets tried — see mobileAuthToken.ts for the token
// itself, and apps/mobile/src/lib/apolloClient.ts for the client side that
// sends these headers).
const mobileAuthDecoder: Decoder = async (token, type) => {
  if (type !== 'mobile') {
    return null
  }
  return verifyMobileToken(token)
}

export const handler = createGraphQLHandler({
  authDecoder: [dbAuthDecoder, mobileAuthDecoder],
  getCurrentUser,
  loggerConfig: { logger, options: {} },
  directives,
  sdls,
  services,
  onException: () => {
    // Disconnect from your database with an unhandled exception.
    db.$disconnect()
  },
})
