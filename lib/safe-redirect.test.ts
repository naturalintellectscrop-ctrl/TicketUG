import { describe, expect, it } from 'vitest'
import { isSafeInternalPath, safeInternalPath } from './safe-redirect'

describe('safe internal redirect paths', () => {
  it('accepts ordinary internal paths', () => {
    expect(isSafeInternalPath('/account')).toBe(true)
    expect(isSafeInternalPath('/events/launch-night/order')).toBe(true)
    expect(isSafeInternalPath('/guest/orders/ord_abc?key=x')).toBe(true)
    expect(isSafeInternalPath('/')).toBe(true)
  })

  it('rejects off-site and protocol-relative targets', () => {
    expect(isSafeInternalPath('https://evil.example')).toBe(false)
    expect(isSafeInternalPath('http://evil.example/account')).toBe(false)
    expect(isSafeInternalPath('//evil.example')).toBe(false)
    expect(isSafeInternalPath('/\\evil.example')).toBe(false)
    expect(isSafeInternalPath('javascript:alert(1)')).toBe(false)
  })

  it('rejects non-strings, empties and control characters', () => {
    expect(isSafeInternalPath(undefined)).toBe(false)
    expect(isSafeInternalPath(null)).toBe(false)
    expect(isSafeInternalPath(42)).toBe(false)
    expect(isSafeInternalPath('')).toBe(false)
    expect(isSafeInternalPath('/a\r\nSet-Cookie: x')).toBe(false)
    expect(isSafeInternalPath('/a\tb')).toBe(false)
  })

  it('caps path length to keep URLs sane', () => {
    expect(isSafeInternalPath(`/${'a'.repeat(600)}`)).toBe(false)
    expect(isSafeInternalPath(`/${'a'.repeat(300)}`)).toBe(true)
  })

  it('falls back safely', () => {
    expect(safeInternalPath('//evil.example', '/account')).toBe('/account')
    expect(safeInternalPath('/events/x/order', '/account')).toBe('/events/x/order')
  })
})
