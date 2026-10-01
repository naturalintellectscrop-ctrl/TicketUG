import { describe, expect, it } from 'vitest'
import { paymentDeadline, PAYMENT_WINDOW_MINUTES } from './order-rules'

// The authoritative order/expiry state machine lives in the ticketug SQL
// functions (migrations 012/013) and the order_status_valid CHECK (008);
// these tests cover the shared payment-window rules the server layer consumes.
describe('payment window rules', () => {
  it('computes the deadline inside the configured window', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    expect(PAYMENT_WINDOW_MINUTES).toBeGreaterThanOrEqual(1)
    expect(PAYMENT_WINDOW_MINUTES).toBeLessThanOrEqual(120)
    expect(paymentDeadline(now).getTime()).toBe(now.getTime() + PAYMENT_WINDOW_MINUTES * 60_000)
  })
})
