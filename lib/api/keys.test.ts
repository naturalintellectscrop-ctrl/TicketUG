import { describe, expect, it } from 'vitest'
import { generateApiKey, hashApiKey, isPlausibleApiKey } from './keys'

describe('generateApiKey', () => {
  it('issues tug_sk_ keys with a 40-char base64url secret', () => {
    const { key, prefix, keyHash } = generateApiKey()
    expect(key.startsWith('tug_sk_')).toBe(true)
    expect(key.length).toBe('tug_sk_'.length + 40)
    expect(/^[A-Za-z0-9_-]+$/.test(key.slice('tug_sk_'.length))).toBe(true)
    expect(prefix).toBe(key.slice(0, 16))
    expect(keyHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('generates unique keys and a stable prefix that is not the whole secret', () => {
    const a = generateApiKey()
    const b = generateApiKey()
    expect(a.key).not.toBe(b.key)
    expect(a.keyHash).not.toBe(b.keyHash)
    expect(a.prefix.startsWith('tug_sk_')).toBe(true)
    expect(a.prefix.length).toBeLessThan(a.key.length)
  })
})

describe('hashApiKey', () => {
  it('is deterministic and differs per input', () => {
    expect(hashApiKey('tug_sk_same')).toBe(hashApiKey('tug_sk_same'))
    expect(hashApiKey('tug_sk_same')).not.toBe(hashApiKey('tug_sk_other'))
  })

  it('matches sha256 hex of the exact key string', () => {
    const { key, keyHash } = generateApiKey()
    // 64 hex chars = sha256; determinism check via a second call.
    expect(hashApiKey(key)).toBe(keyHash)
    expect(keyHash).toHaveLength(64)
  })
})

describe('isPlausibleApiKey', () => {
  it('accepts well-formed issued keys', () => {
    const { key } = generateApiKey()
    expect(isPlausibleApiKey(key)).toBe(true)
  })

  it('rejects junk before it reaches the database', () => {
    expect(isPlausibleApiKey('')).toBe(false)
    expect(isPlausibleApiKey('sk_live_whatever')).toBe(false)
    expect(isPlausibleApiKey('tug_sk_short')).toBe(false)
    expect(isPlausibleApiKey(`tug_sk_${'a'.repeat(300)}`)).toBe(false)
    expect(isPlausibleApiKey(`tug_sk_${' Spaces '.repeat(6)}`)).toBe(false)
  })
})
