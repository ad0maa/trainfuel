import { mockRedwoodDirective, getDirectiveName } from '@cedarjs/testing/api'

import requireAuth from './requireAuth.js'

describe('requireAuth directive', () => {
  it('declares the directive sdl as schema, with the correct name', () => {
    expect(requireAuth.schema).toBeTruthy()
    expect(getDirectiveName(requireAuth.schema)).toBe('requireAuth')
  })

  it('does not throw when there is a current user', () => {
    const mockExecution = mockRedwoodDirective(requireAuth, {
      context: { currentUser: { id: 'user-1', email: 'test@example.com' } },
    })

    expect(mockExecution).not.toThrowError()
  })

  it('throws when there is no current user', () => {
    const mockExecution = mockRedwoodDirective(requireAuth, { context: {} })

    expect(mockExecution).toThrowError()
  })
})
