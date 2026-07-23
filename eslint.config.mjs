import cedarConfig from '@cedarjs/eslint-config'

export default [
  ...(await cedarConfig()),
  // Generated files — codegen output, not source; linting/prettier-checking
  // them just produces noise on every regeneration.
  { ignores: ['**/types/graphql.d.ts', '.cedar/**'] },
]
