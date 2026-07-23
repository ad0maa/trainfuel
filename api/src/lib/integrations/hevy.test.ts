// Only the pure decision logic is unit tested here — see the file header
// comment in hevy.ts for why the fetch wrappers themselves aren't.

import { computeHevyBackoffDelayMs } from './hevy'

describe('computeHevyBackoffDelayMs', () => {
  it('prefers the Retry-After header when present and valid', () => {
    expect(computeHevyBackoffDelayMs(0, '5')).toBe(5000)
  })

  it('falls back to exponential backoff when Retry-After is absent', () => {
    expect(computeHevyBackoffDelayMs(0, null)).toBe(1000)
    expect(computeHevyBackoffDelayMs(1, null)).toBe(2000)
    expect(computeHevyBackoffDelayMs(2, null)).toBe(4000)
  })

  it('ignores a malformed Retry-After header and falls back to exponential backoff', () => {
    expect(computeHevyBackoffDelayMs(0, 'not-a-number')).toBe(1000)
  })

  it('returns null once retries are exhausted, signalling "give up"', () => {
    expect(computeHevyBackoffDelayMs(3, null)).toBeNull()
    expect(computeHevyBackoffDelayMs(3, '5')).toBeNull()
  })
})
