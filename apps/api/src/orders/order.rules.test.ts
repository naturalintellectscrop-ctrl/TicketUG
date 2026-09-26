import { describe, expect, it } from 'vitest'
import { assertOrderTransition, calculateLineTotal, calculateOrderTotal, isOrderExpiryDue, paymentDeadline, PAYMENT_WINDOW_MINUTES, validateOrderItems, type OrderStatus } from './order.rules'

describe('order rules', () => {
  it('requires positive unique quantities', () => {
    expect(() => validateOrderItems([])).toThrow()
    expect(() => validateOrderItems([{ ticketTypeId: 'a', quantity: 0 }])).toThrow()
    expect(() => validateOrderItems([{ ticketTypeId: 'a', quantity: 1 }, { ticketTypeId: 'a', quantity: 1 }])).toThrow()
    expect(() => validateOrderItems([{ ticketTypeId: 'a', quantity: 2 }])).not.toThrow()
  })
  it('calculates deterministic integer totals', () => {
    expect(calculateLineTotal(50000, 2)).toBe(100000)
    expect(calculateOrderTotal([100000, 75000])).toBe(175000)
  })
  it('rejects unsafe totals', () => {
    expect(() => calculateLineTotal(Number.MAX_SAFE_INTEGER, 2)).toThrow()
  })
})

describe('payment window / expiry rules', () => {
  it('computes the deadline inside the configured window', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    expect(PAYMENT_WINDOW_MINUTES).toBeGreaterThanOrEqual(1)
    expect(PAYMENT_WINDOW_MINUTES).toBeLessThanOrEqual(120)
    expect(paymentDeadline(now).getTime()).toBe(now.getTime() + PAYMENT_WINDOW_MINUTES * 60_000)
  })
  it('marks only open orders past their deadline as due', () => {
    const now = new Date('2026-01-01T00:15:00.000Z')
    const expiredAt = new Date('2026-01-01T00:00:00.000Z')
    const futureAt = new Date('2026-01-01T01:00:00.000Z')
    expect(isOrderExpiryDue({ status: 'AWAITING_PAYMENT', payment_expires_at: expiredAt.toISOString() }, now)).toBe(true)
    expect(isOrderExpiryDue({ status: 'PAYMENT_PROCESSING', payment_expires_at: expiredAt.toISOString() }, now)).toBe(true)
    expect(isOrderExpiryDue({ status: 'AWAITING_PAYMENT', payment_expires_at: futureAt.toISOString() }, now)).toBe(false)
    expect(isOrderExpiryDue({ status: 'AWAITING_PAYMENT', payment_expires_at: null }, now)).toBe(false)
    expect(isOrderExpiryDue({ status: 'PAID', payment_expires_at: expiredAt.toISOString() }, now)).toBe(false)
    expect(isOrderExpiryDue({ status: 'CANCELLED', payment_expires_at: expiredAt.toISOString() }, now)).toBe(false)
    expect(isOrderExpiryDue({ status: 'EXPIRED', payment_expires_at: expiredAt.toISOString() }, now)).toBe(false)
  })
  it('treats deadline equality as due (boundary)', () => {
    const at = '2026-01-01T00:00:00.000Z'
    expect(isOrderExpiryDue({ status: 'AWAITING_PAYMENT', payment_expires_at: at }, new Date(at))).toBe(true)
  })
})

describe('order lifecycle state machine', () => {
  it('allows every path out of the pre-payment states', () => {
    expect(() => assertOrderTransition('AWAITING_PAYMENT', 'PAYMENT_PROCESSING')).not.toThrow()
    expect(() => assertOrderTransition('AWAITING_PAYMENT', 'PAID')).not.toThrow()
    expect(() => assertOrderTransition('AWAITING_PAYMENT', 'CANCELLED')).not.toThrow()
    expect(() => assertOrderTransition('AWAITING_PAYMENT', 'EXPIRED')).not.toThrow()
    expect(() => assertOrderTransition('PAYMENT_PROCESSING', 'PAID')).not.toThrow()
    expect(() => assertOrderTransition('PAYMENT_PROCESSING', 'CANCELLED')).not.toThrow()
    expect(() => assertOrderTransition('PAYMENT_PROCESSING', 'EXPIRED')).not.toThrow()
  })
  it('rejects payment processing started twice and same-state writes', () => {
    expect(() => assertOrderTransition('AWAITING_PAYMENT', 'AWAITING_PAYMENT')).toThrow()
    expect(() => assertOrderTransition('PAYMENT_PROCESSING', 'PAYMENT_PROCESSING')).toThrow()
    expect(() => assertOrderTransition('PAYMENT_PROCESSING', 'AWAITING_PAYMENT')).toThrow()
  })
  it('treats PAID, CANCELLED and EXPIRED as terminal', () => {
    const terminal: OrderStatus[] = ['PAID', 'CANCELLED', 'EXPIRED']
    const all: OrderStatus[] = ['AWAITING_PAYMENT', 'PAYMENT_PROCESSING', 'PAID', 'CANCELLED', 'EXPIRED']
    for (const from of terminal) for (const to of all) expect(() => assertOrderTransition(from, to)).toThrow()
  })
})
