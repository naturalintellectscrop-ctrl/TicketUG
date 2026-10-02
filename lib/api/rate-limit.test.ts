import { describe, expect, it } from 'vitest'
import { checkApiKeyRateLimit } from './rate-limit'

describe('checkApiKeyRateLimit', () => {
  it('counts requests within the window and exposes remaining', () => {
    const start = 1_000_000
    const first = checkApiKeyRateLimit('key-a', start, 3, 60_000)
    expect(first.allowed).toBe(true)
    expect(first.remaining).toBe(2)
    const second = checkApiKeyRateLimit('key-a', start + 1, 3, 60_000)
    expect(second.allowed).toBe(true)
    expect(second.remaining).toBe(1)
  })

  it('blocks the request over the limit and reports retry-after', () => {
    const start = 2_000_000
    checkApiKeyRateLimit('key-b', start, 2, 60_000)
    checkApiKeyRateLimit('key-b', start + 10, 2, 60_000)
    const blocked = checkApiKeyRateLimit('key-b', start + 20, 2, 60_000)
    expect(blocked.allowed).toBe(false)
    expect(blocked.remaining).toBe(0)
    expect(blocked.retryAfterSec).toBeGreaterThan(0)
    expect(blocked.retryAfterSec).toBeLessThanOrEqual(60)
  })

  it('opens a fresh window after reset', () => {
    const start = 3_000_000
    checkApiKeyRateLimit('key-c', start, 1, 60_000)
    const blocked = checkApiKeyRateLimit('key-c', start + 1_000, 1, 60_000)
    expect(blocked.allowed).toBe(false)
    const fresh = checkApiKeyRateLimit('key-c', start + 60_001, 1, 60_000)
    expect(fresh.allowed).toBe(true)
    expect(fresh.remaining).toBe(0)
  })

  it('keys are isolated per credential', () => {
    const start = 4_000_000
    checkApiKeyRateLimit('key-d1', start, 1, 60_000)
    const other = checkApiKeyRateLimit('key-d2', start, 1, 60_000)
    expect(other.allowed).toBe(true)
  })
})
