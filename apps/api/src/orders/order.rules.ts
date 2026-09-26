// Full order lifecycle — mirrors the order_status_valid CHECK added in 008-payments.sql.
export type OrderStatus = 'AWAITING_PAYMENT' | 'PAYMENT_PROCESSING' | 'PAID' | 'CANCELLED' | 'EXPIRED'

export function validateOrderItems(items: Array<{ ticketTypeId: string; quantity: number }>) {
  if (!items.length) throw new Error('At least one order item is required')
  const ids = new Set<string>()
  for (const item of items) {
    if (ids.has(item.ticketTypeId)) throw new Error('Each ticket type may appear once per order')
    ids.add(item.ticketTypeId)
    if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) throw new Error('Quantity must be a positive integer')
  }
}

export function calculateLineTotal(unitPriceMinorUnits: number, quantity: number) {
  if (!Number.isSafeInteger(unitPriceMinorUnits) || unitPriceMinorUnits < 0) throw new Error('Invalid unit price')
  if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error('Invalid quantity')
  const total = BigInt(unitPriceMinorUnits) * BigInt(quantity)
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Order total exceeds supported range')
  return Number(total)
}

export function calculateOrderTotal(lines: number[]) {
  const total = lines.reduce((sum, line) => sum + BigInt(line), BigInt(0))
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Order total exceeds supported range')
  return Number(total)
}

// --- Payment window / inventory reservation expiry -------------------------
// The settlement spec requires temporary reservations to "expire and release
// inventory automatically" and forbids payment processing from holding
// inventory "without a defined expiry/reconciliation mechanism". The specs do
// not pin a duration, so 15 minutes is the operational default, overridable
// via PAYMENT_WINDOW_MINUTES (clamped to 1..120).
export const PAYMENT_WINDOW_MINUTES = Math.min(120, Math.max(1, Number(process.env.PAYMENT_WINDOW_MINUTES ?? 15) || 15))

export function paymentDeadline(from: Date = new Date()): Date {
  return new Date(from.getTime() + PAYMENT_WINDOW_MINUTES * 60_000)
}

export function isOrderExpiryDue(order: { status: string; payment_expires_at: string | Date | null }, now: Date = new Date()): boolean {
  if (order.status !== 'AWAITING_PAYMENT' && order.status !== 'PAYMENT_PROCESSING') return false
  if (!order.payment_expires_at) return false
  return new Date(order.payment_expires_at).getTime() <= now.getTime()
}
