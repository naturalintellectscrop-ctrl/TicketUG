// Full order lifecycle — the authoritative state machine lives in the ticketug
// SQL functions (migrations 012/013) and the order_status_valid CHECK added in
// 008-payments.sql. This re-export keeps the shared status vocabulary typed in
// one place for the server layer.
export type OrderStatus = 'AWAITING_PAYMENT' | 'PAYMENT_PROCESSING' | 'PAID' | 'CANCELLED' | 'EXPIRED'

// --- Payment window / inventory reservation expiry -------------------------
// The settlement spec requires temporary reservations to "expire and release
// inventory automatically" and forbids payment processing from holding
// inventory "without a defined expiry/reconciliation mechanism". The specs do
// not pin a duration, so 15 minutes is the operational default, overridable
// via PAYMENT_WINDOW_MINUTES (clamped to 1..120).
//
// NOTE: the authoritative order lifecycle state machine lives in the ticketug
// SQL functions (migrations 012/013) + the order_status_valid CHECK (008).
// This module intentionally carries only the shared payment-window rules so
// TypeScript cannot drift away from the database's copy.
export const PAYMENT_WINDOW_MINUTES = Math.min(120, Math.max(1, Number(process.env.PAYMENT_WINDOW_MINUTES ?? 15) || 15))

export function paymentDeadline(from: Date = new Date()): Date {
  return new Date(from.getTime() + PAYMENT_WINDOW_MINUTES * 60_000)
}
