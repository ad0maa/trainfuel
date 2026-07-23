export const schema = gql`
  type MobileAuthPayload {
    token: String!
    userId: String!
    email: String!
  }

  type Mutation {
    """
    Bearer-token login for the mobile app (SPEC.md §2's fallback since
    dbAuth's httpOnly-cookie session doesn't carry over RN's fetch/Apollo
    stack). Verifies the same email/hashedPassword/salt dbAuth already
    uses — same user table, different credential-check entry point.
    Public — this *is* the login check, so it can't require auth itself.
    """
    mobileLogin(email: String!, password: String!): MobileAuthPayload! @skipAuth
  }
`
