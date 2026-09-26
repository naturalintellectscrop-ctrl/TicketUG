import type { PoolClient } from 'pg'
import { assertPaymentTransition, type PaymentStatus } from '../payments/payment.rules'
import { isOrderExpiryDue } from './order.rules'

// Transactional order-expiry engine shared by the lazy read-path hook and the
// operator sweep endpoint. Canonical expiry logic lives here (Nest is the
// authoritative backend for payments/orders per docs/ARCHITECTURE.md).
//
// Safety properties:
// - Every eligible order row is locked FOR UPDATE, so a concurrent webhook that
//   is transitioning the order to PAID serializes against expiry (whoever wins,
//   the loser observes the new terminal status and no-ops).
// - The sweep uses FOR UPDATE SKIP LOCKED so two sweepers (or a sweeper racing
//   a payment call) never block each other on unrelated orders.
// - Inventory is restored with the same guarded increment used by cancel()
//   (`remaining_capacity + quantity <= capacity`), making restores idempotent.

export type ExpiringDb = { transaction: <T>(callback: (client: PoolClient) => Promise<T>) => Promise<T> }

export type ExpiredOrderSummary = { publicId: string; orderNumber: string; status: 'EXPIRED'; inventoryRestored: number }

// Caller must already hold FOR UPDATE on the order row.
async function expireLockedOrder(client: PoolClient, orderId: string): Promise<number> {
  const items = (await client.query<{ ticket_type_id: string; quantity: number }>('SELECT ticket_type_id, quantity FROM ticketug.order_item WHERE order_id=$1', [orderId])).rows
  for (const item of items) {
    await client.query('UPDATE ticketug.ticket_type SET remaining_capacity=remaining_capacity+$2, updated_at=now() WHERE id=$1 AND remaining_capacity + $2 <= capacity', [item.ticket_type_id, item.quantity])
  }
  await client.query("UPDATE ticketug.order SET status='EXPIRED', payment_state='EXPIRED', updated_at=now() WHERE id=$1", [orderId])
  // Expire any payment/attempts still in flight so payment status polling
  // reflects terminal state. Transitions are asserted to keep the state
  // machine honest (PENDING/PROCESSING -> EXPIRED is legal per payment.rules).
  const payments = (await client.query<{ id: string; status: string }>("SELECT id, status FROM ticketug.payment WHERE order_id=$1 AND status IN ('PENDING','PROCESSING')", [orderId])).rows
  for (const payment of payments) {
    assertPaymentTransition(payment.status as PaymentStatus, 'EXPIRED')
    await client.query("UPDATE ticketug.payment SET status='EXPIRED', updated_at=now() WHERE id=$1", [payment.id])
    await client.query("UPDATE ticketug.payment_attempt SET status='EXPIRED', completed_at=now() WHERE payment_id=$1 AND status IN ('PENDING','PROCESSING')", [payment.id])
  }
  return items.length
}

// Lazy single-order expiry for read/initiate paths. Returns null when the
// order does not exist or is not due for expiry.
export async function expireOrderIfDue(db: ExpiringDb, publicId: string): Promise<ExpiredOrderSummary | null> {
  return db.transaction(async (client) => {
    const order = (await client.query<{ id: string; public_id: string; order_number: string; status: string; payment_expires_at: string | null }>('SELECT id, public_id, order_number, status, payment_expires_at FROM ticketug.order WHERE public_id=$1 FOR UPDATE', [publicId])).rows[0]
    if (!order || !isOrderExpiryDue(order)) return null
    const inventoryRestored = await expireLockedOrder(client, order.id)
    return { publicId: order.public_id, orderNumber: order.order_number, status: 'EXPIRED' as const, inventoryRestored }
  })
}

// Bulk sweep for the operator/cron endpoint. Bounded per invocation.
export async function expireStaleOrders(db: ExpiringDb, limit = 100): Promise<ExpiredOrderSummary[]> {
  const capped = Math.min(500, Math.max(1, Math.floor(limit) || 100))
  return db.transaction(async (client) => {
    const due = (await client.query<{ id: string; public_id: string; order_number: string }>("SELECT id, public_id, order_number FROM ticketug.order WHERE status IN ('AWAITING_PAYMENT','PAYMENT_PROCESSING') AND payment_expires_at IS NOT NULL AND payment_expires_at <= now() ORDER BY payment_expires_at LIMIT $1 FOR UPDATE SKIP LOCKED", [capped])).rows
    const expired: ExpiredOrderSummary[] = []
    for (const row of due) {
      const inventoryRestored = await expireLockedOrder(client, row.id)
      expired.push({ publicId: row.public_id, orderNumber: row.order_number, status: 'EXPIRED' as const, inventoryRestored })
    }
    return expired
  })
}
