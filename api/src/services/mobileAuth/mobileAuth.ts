import type { MutationResolvers } from 'types/graphql'

import { hashPassword } from '@cedarjs/auth-dbauth-api'
import { AuthenticationError } from '@cedarjs/graphql-server'

import { db } from 'src/lib/db'
import { signMobileToken } from 'src/lib/mobileAuthToken'

// Deliberately vague on failure (same "don't help an attacker narrow down
// username vs. password" reasoning as api/src/functions/auth.ts's dbAuth
// error messages) rather than distinguishing "no such user" from "wrong
// password".
const INVALID_CREDENTIALS_MESSAGE = 'Incorrect email or password.'

export const mobileLogin: MutationResolvers['mobileLogin'] = async ({
  email,
  password,
}) => {
  const user = await db.user.findUnique({ where: { email } })
  if (!user) {
    throw new AuthenticationError(INVALID_CREDENTIALS_MESSAGE)
  }

  // Reuses dbAuth's own scrypt-based hashPassword (api/src/functions/auth.ts
  // signup writes hashedPassword/salt with this same function) so a mobile
  // login is checked against literally the same credential, not a
  // reimplementation of the hashing scheme.
  const [computedHash] = hashPassword(password, { salt: user.salt })
  if (computedHash !== user.hashedPassword) {
    throw new AuthenticationError(INVALID_CREDENTIALS_MESSAGE)
  }

  return {
    token: signMobileToken(user.id),
    userId: user.id,
    email: user.email,
  }
}
