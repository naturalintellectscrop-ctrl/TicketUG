import { describe, expect, it } from 'vitest'
import { buildRecoveryPath, GUEST_ORDER_KEY_QUERY, guestTokenStorageKey, recoveryKeyFromSearch } from './guest-order-access'

describe('guest order access keys', () => {
  it('builds stable per-order storage keys', () => {
    expect(guestTokenStorageKey('ord_abc')).toBe('ticketug:guest-token:ord_abc')
  })

  it('builds recovery paths with an encoded key parameter', () => {
    const path = buildRecoveryPath('ord_abc', 'tok/en+1')
    expect(path).toBe(`/guest/orders/ord_abc?${GUEST_ORDER_KEY_QUERY}=tok%2Fen%2B1`)
    expect(recoveryKeyFromSearch(path.slice(path.indexOf('?')))).toBe('tok/en+1')
  })

  it('round-trips plain and special-character keys', () => {
    for (const token of ['plain-token', 'a+b', 'x/y', 'ünïcode', 'a=b&c']) {
      const path = buildRecoveryPath('ord_x', token)
      expect(recoveryKeyFromSearch(path.slice(path.indexOf('?')))).toBe(token)
    }
  })

  it('returns null for missing or empty keys', () => {
    expect(recoveryKeyFromSearch('')).toBeNull()
    expect(recoveryKeyFromSearch('?other=1')).toBeNull()
    expect(recoveryKeyFromSearch('?key=')).toBeNull()
  })

  it('tolerates malformed query input', () => {
    expect(recoveryKeyFromSearch('%%%invalid')).toBeNull()
  })
})
