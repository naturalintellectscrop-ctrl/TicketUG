import { pool } from './db'

export type EventSalesMetrics = {
  ordersByStatus: Array<{ status: string; count: number }>
  paidRevenueMinor: number
  paidOrderCount: number
  ticketsIssued: number
  checkedIn: number
  ticketTypes: Array<{ id: string; name: string; capacity: number; remainingCapacity: number; active: boolean }>
  totalCapacity: number
  remainingCapacity: number
}

// Order statuses match the order_status_valid constraint added by migration 008.
const ORDER_STATUSES = ['AWAITING_PAYMENT', 'PAYMENT_PROCESSING', 'PAID', 'CANCELLED', 'EXPIRED'] as const

// Read-only aggregates for the organizer per-event sales summary (Master Spec §19).
// Aggregate numbers only — attendee PII must never be exposed through this loader.
export async function loadEventSalesMetrics(eventId: string): Promise<EventSalesMetrics> {
  const [ordersResult, ticketCountsResult, ticketTypesResult] = await Promise.all([
    // Orders belong to the event when any order item references one of its ticket types.
    // EXISTS keeps each order counted once even when it holds multiple items.
    pool.query<{ status: string; orderCount: number; totalMinorUnits: string }>(
      `SELECT o.status, COUNT(*)::int AS "orderCount", COALESCE(SUM(o.total_minor_units), 0) AS "totalMinorUnits"
         FROM ticketug.order o
        WHERE EXISTS (
              SELECT 1
                FROM ticketug.order_item oi
                JOIN ticketug.ticket_type tt ON tt.id = oi.ticket_type_id
               WHERE oi.order_id = o.id AND tt.event_id = $1)
        GROUP BY o.status`,
      [eventId],
    ),
    // ticket.event_id is direct (migration 009); check_in carries event_id with UNIQUE(ticket_id) (010).
    pool.query<{ ticketsIssued: number; checkedIn: number }>(
      `SELECT (SELECT COUNT(*)::int FROM ticketug.ticket WHERE event_id = $1) AS "ticketsIssued",
              (SELECT COUNT(*)::int FROM ticketug.check_in WHERE event_id = $1) AS "checkedIn"`,
      [eventId],
    ),
    pool.query<{ id: string; name: string; capacity: number; remainingCapacity: number; active: boolean }>(
      `SELECT id, name, capacity, remaining_capacity AS "remainingCapacity", active
         FROM ticketug.ticket_type
        WHERE event_id = $1
        ORDER BY sort_order, created_at`,
      [eventId],
    ),
  ])

  const ordersByStatus = new Map(ordersResult.rows.map((row) => [row.status, row]))
  const paid = ordersByStatus.get('PAID')

  return {
    ordersByStatus: ORDER_STATUSES.map((status) => ({ status, count: ordersByStatus.get(status)?.orderCount ?? 0 })),
    paidRevenueMinor: Number(paid?.totalMinorUnits ?? 0),
    paidOrderCount: paid?.orderCount ?? 0,
    ticketsIssued: ticketCountsResult.rows[0]?.ticketsIssued ?? 0,
    checkedIn: ticketCountsResult.rows[0]?.checkedIn ?? 0,
    ticketTypes: ticketTypesResult.rows,
    totalCapacity: ticketTypesResult.rows.reduce((sum, type) => sum + type.capacity, 0),
    remainingCapacity: ticketTypesResult.rows.reduce((sum, type) => sum + type.remainingCapacity, 0),
  }
}
