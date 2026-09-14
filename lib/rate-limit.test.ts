import { describe, expect, it } from 'vitest'
import { checkRateLimit } from './rate-limit'

describe('development rate limiter', () => {
  it('denies requests after the configured threshold', () => {
    const key = `test-${crypto.randomUUID()}`
    expect(checkRateLimit(key, 2).allowed).toBe(true)
    expect(checkRateLimit(key, 2).allowed).toBe(true)
    expect(checkRateLimit(key, 2).allowed).toBe(false)
  })
})
