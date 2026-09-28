import { describe, expect, it } from 'vitest'
import { resolveAuthSecret } from './auth-secret'

const longSecret = 'ticketug-production-secret-with-32+chars'

describe('auth secret resolution (production fail-closed)', () => {
  it('accepts a production secret of at least 32 characters', () => {
    expect(resolveAuthSecret({ BETTER_AUTH_SECRET: longSecret, NODE_ENV: 'production' })).toBe(longSecret)
    expect(resolveAuthSecret({ BETTER_AUTH_SECRET: 'x'.repeat(32), NODE_ENV: 'production' })).toBe('x'.repeat(32))
  })

  it('throws in production when the secret is missing', () => {
    expect(() => resolveAuthSecret({ NODE_ENV: 'production' })).toThrowError(/at least 32 characters/)
    expect(() => resolveAuthSecret({ BETTER_AUTH_SECRET: undefined, NODE_ENV: 'production' })).toThrowError(/at least 32 characters/)
  })

  it('throws in production when the secret is shorter than 32 characters', () => {
    expect(() => resolveAuthSecret({ BETTER_AUTH_SECRET: 'short-secret', NODE_ENV: 'production' })).toThrowError(/at least 32 characters/)
    expect(() => resolveAuthSecret({ BETTER_AUTH_SECRET: 'x'.repeat(31), NODE_ENV: 'production' })).toThrowError(/at least 32 characters/)
  })

  it('falls back to the development secret outside production', () => {
    expect(resolveAuthSecret({ NODE_ENV: 'development' })).toBe('ticketug-local-development-secret-32-chars')
    expect(resolveAuthSecret({ NODE_ENV: 'test' })).toBe('ticketug-local-development-secret-32-chars')
    expect(resolveAuthSecret({})).toBe('ticketug-local-development-secret-32-chars')
  })

  it('ignores short explicit secrets outside production (matches the API-side fallback)', () => {
    expect(resolveAuthSecret({ BETTER_AUTH_SECRET: 'short-secret', NODE_ENV: 'development' })).toBe('ticketug-local-development-secret-32-chars')
  })
})
