import { describe, expect, it } from 'vitest'
import { resolveSupabaseConfig } from './supabase-config'

describe('supabase config resolution', () => {
  const valid = { SUPABASE_URL: 'https://vmebmexwqfpnlioicqgj.supabase.co', SUPABASE_ANON_KEY: 'publishable-key' }

  it('accepts a complete configuration', () => {
    expect(resolveSupabaseConfig(valid)).toEqual({ url: 'https://vmebmexwqfpnlioicqgj.supabase.co', anonKey: 'publishable-key' })
  })

  it('trims whitespace around values', () => {
    expect(resolveSupabaseConfig({ ...valid, SUPABASE_URL: '  https://vmebmexwqfpnlioicqgj.supabase.co  ' })?.url).toBe('https://vmebmexwqfpnlioicqgj.supabase.co')
  })

  it('returns null in development when unconfigured (auth stays dead, builds succeed)', () => {
    expect(resolveSupabaseConfig({})).toBeNull()
    expect(resolveSupabaseConfig({ SUPABASE_URL: 'https://x.supabase.co' })).toBeNull()
    expect(resolveSupabaseConfig({ SUPABASE_ANON_KEY: 'key' })).toBeNull()
  })

  it('rejects a URL without an http(s) scheme', () => {
    expect(resolveSupabaseConfig({ ...valid, SUPABASE_URL: 'not-a-url' })).toBeNull()
  })

  it('fails closed in production when unconfigured', () => {
    for (const env of [{}, { SUPABASE_URL: 'https://x.supabase.co' }, { SUPABASE_ANON_KEY: 'key' }, { SUPABASE_URL: 'not-a-url', SUPABASE_ANON_KEY: 'key' }]) {
      expect(() => resolveSupabaseConfig({ ...env, NODE_ENV: 'production' })).toThrow('SUPABASE_URL and SUPABASE_ANON_KEY must be set in production')
    }
  })

  it('passes with a complete configuration in production', () => {
    expect(resolveSupabaseConfig({ ...valid, NODE_ENV: 'production' })).toEqual({ url: valid.SUPABASE_URL, anonKey: valid.SUPABASE_ANON_KEY })
  })
})
