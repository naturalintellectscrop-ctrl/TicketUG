import { describe, expect, it } from 'vitest'
import { getTicketAvailability, validateSaleWindow, validateTicketNumbers } from './ticket-type.rules'

describe('ticket type rules', () => {
  it('rejects invalid sale windows', () => {
    expect(() => validateSaleWindow('2026-01-02T00:00:00Z', '2026-01-01T00:00:00Z')).toThrow()
  })
  it('rejects negative and unsafe ticket numbers', () => {
    expect(() => validateTicketNumbers(-1, 10)).toThrow()
    expect(() => validateTicketNumbers(1000, -1)).toThrow()
    expect(() => validateTicketNumbers(1000.5, 10)).toThrow()
    expect(() => validateTicketNumbers(1000, 10)).not.toThrow()
  })
  it('derives availability without a mutable sold counter', () => {
    const now = new Date('2026-01-10T12:00:00Z')
    expect(getTicketAvailability({ active: false, capacity: 10, now })).toBe('INACTIVE')
    expect(getTicketAvailability({ active: true, capacity: 0, now })).toBe('SOLD_OUT')
    expect(getTicketAvailability({ active: true, capacity: 10, saleStartsAt: '2026-01-11T00:00:00Z', now })).toBe('BEFORE_SALE')
    expect(getTicketAvailability({ active: true, capacity: 10, saleEndsAt: '2026-01-10T00:00:00Z', now })).toBe('AFTER_SALE')
    expect(getTicketAvailability({ active: true, capacity: 10, now })).toBe('ON_SALE')
  })
})
