import { pool } from './db'
import { logServerError } from './server/errors'

/**
 * Workspace-level (cross-event) read loaders for the organizer console:
 * Overview aggregates, the workspace order list, and report tables shared
 * with the CSV export route.
 *
 * Security model — identical to every other organizer surface:
 *   - every statement carries `organizer_id = $1` AND an EXISTS membership
 *     check for the acting profile in the SAME query;
 *   - all values are parameterized;
 *   - database failures are returned as `null` after logServerError() so
 *     pages render honest "unavailable" panels, never zeros.
 *
 * Money notes: `total_minor_units` is whole UGX. "Gross" figures are sums of
 * PAID order totals — provider-collected, BEFORE platform fees. The schema
 * has no fee/settlement primitives, so nothing here may be labeled "net".
 */

const ORDER_STATES = ['AWAITING_PAYMENT', 'PAYMENT_PROCESSING', 'PAID', 'CANCELLED', 'EXPIRED'] as const
export type OrderState = (typeof ORDER_STATES)[number]
export const WORKSPACE_ORDER_STATES: readonly OrderState[] = ORDER_STATES

export function isOrderState(value: string | null | undefined): value is OrderState {
  return !!value && (ORDER_STATES as readonly string[]).includes(value)
}

/** Completes a GROUP BY result so every known state always renders. */
export function fillOrderStates(rows: Array<{ payment_state: string; order_count: number; total_minor_units: string | number }>): Array<{ state: OrderState; count: number; totalMinorUnits: number }> {
  const map = new Map(rows.map((row) => [row.payment_state, row]))
  return ORDER_STATES.map((state) => ({
    state,
    count: Number(map.get(state)?.order_count ?? 0),
    totalMinorUnits: Number(map.get(state)?.total_minor_units ?? 0),
  }))
}

const ORDER_SCOPE = `EXISTS (
      SELECT 1 FROM ticketug.order_item oi
      JOIN ticketug.ticket_type tt ON tt.id = oi.ticket_type_id
      JOIN ticketug.event e ON e.id = tt.event_id
     WHERE oi.order_id = o.id AND e.organizer_id = $1)`

export type WorkspaceOverview = {
  lifecycleCounts: Array<{ lifecycle_state: string; event_count: number }>
  upcoming: Array<{ id: string; title: string; starts_at: string; timezone: string; lifecycle_state: string }>
  capacity: { total: number; remaining: number }
  orderStates: Array<{ state: OrderState; count: number; totalMinorUnits: number }>
  tickets: { issued: number; checkedIn: number }
  attention: {
    unpublishedWithFutureStarts: Array<{ id: string; title: string; starts_at: string; lifecycle_state: string }>
    withoutTicketTypes: Array<{ id: string; title: string }>
  }
} | null

/** Overview aggregates. The order/revenue aggregate carries its own
 * owner/manager gate inside the SQL (staff sessions never fetch buyer
 * financial data — the UI additionally hides the tile). */
export async function loadWorkspaceOverview(organizerId: string, profileId: string): Promise<WorkspaceOverview> {
  try {
    const [lifecycle, upcoming, capacity, orders, tickets, drafts, noTypes] = await Promise.all([
      pool.query<{ lifecycle_state: string; event_count: number }>(
        `SELECT lifecycle_state, COUNT(*)::int AS event_count
           FROM ticketug.event
          WHERE organizer_id = $1
            AND EXISTS (SELECT 1 FROM ticketug.organizer_member WHERE organizer_id = $1 AND user_profile_id = $2 AND status = 'ACTIVE')
          GROUP BY lifecycle_state`,
        [organizerId, profileId],
      ),
      pool.query<{ id: string; title: string; starts_at: string; timezone: string; lifecycle_state: string }>(
        `SELECT id, title, starts_at, timezone, lifecycle_state
           FROM ticketug.event
          WHERE organizer_id = $1
            AND EXISTS (SELECT 1 FROM ticketug.organizer_member WHERE organizer_id = $1 AND user_profile_id = $2 AND status = 'ACTIVE')
            AND starts_at >= now()
          ORDER BY starts_at
          LIMIT 5`,
        [organizerId, profileId],
      ),
      pool.query<{ total: string; remaining: string }>(
        `SELECT COALESCE(SUM(tt.capacity), 0) AS total, COALESCE(SUM(tt.remaining_capacity), 0) AS remaining
           FROM ticketug.ticket_type tt
           JOIN ticketug.event e ON e.id = tt.event_id
          WHERE e.organizer_id = $1
            AND EXISTS (SELECT 1 FROM ticketug.organizer_member WHERE organizer_id = $1 AND user_profile_id = $2 AND status = 'ACTIVE')`,
        [organizerId, profileId],
      ),
      pool.query<{ payment_state: string; order_count: number; total_minor_units: string }>(
        `SELECT o.payment_state, COUNT(*)::int AS order_count, COALESCE(SUM(o.total_minor_units), 0) AS total_minor_units
           FROM ticketug.order o
          WHERE ${ORDER_SCOPE}
            AND EXISTS (SELECT 1 FROM ticketug.organizer_member WHERE organizer_id = $1 AND user_profile_id = $2 AND status = 'ACTIVE' AND role IN ('ORGANIZER_OWNER', 'ORGANIZER_MANAGER'))
          GROUP BY o.payment_state`,
        [organizerId, profileId],
      ),
      pool.query<{ issued: number; checkedIn: number }>(
        `SELECT (SELECT COUNT(*)::int FROM ticketug.ticket t
                   JOIN ticketug.event e ON e.id = t.event_id
                  WHERE e.organizer_id = $1
                    AND EXISTS (SELECT 1 FROM ticketug.organizer_member WHERE organizer_id = $1 AND user_profile_id = $2 AND status = 'ACTIVE')) AS issued,
                (SELECT COUNT(*)::int FROM ticketug.check_in ci
                   JOIN ticketug.event e ON e.id = ci.event_id
                  WHERE e.organizer_id = $1
                    AND EXISTS (SELECT 1 FROM ticketug.organizer_member WHERE organizer_id = $1 AND user_profile_id = $2 AND status = 'ACTIVE')) AS "checkedIn"`,
        [organizerId, profileId],
      ),
      // "Needs attention" — real derivations only: a draft that is supposed to
      // happen (future start) is not on sale yet; an active event without any
      // ticket type cannot sell anything on its public page.
      pool.query<{ id: string; title: string; starts_at: string; lifecycle_state: string }>(
        `SELECT id, title, starts_at, lifecycle_state
           FROM ticketug.event
          WHERE organizer_id = $1
            AND EXISTS (SELECT 1 FROM ticketug.organizer_member WHERE organizer_id = $1 AND user_profile_id = $2 AND status = 'ACTIVE')
            AND lifecycle_state IN ('DRAFT', 'PUBLISHED', 'SUSPENDED')
            AND starts_at >= now()
          ORDER BY starts_at
          LIMIT 5`,
        [organizerId, profileId],
      ),
      pool.query<{ id: string; title: string }>(
        `SELECT e.id, e.title
           FROM ticketug.event e
          WHERE e.organizer_id = $1
            AND EXISTS (SELECT 1 FROM ticketug.organizer_member WHERE organizer_id = $1 AND user_profile_id = $2 AND status = 'ACTIVE')
            AND e.lifecycle_state IN ('DRAFT', 'PUBLISHED', 'SALES_OPEN')
            AND NOT EXISTS (SELECT 1 FROM ticketug.ticket_type tt WHERE tt.event_id = e.id)
          ORDER BY e.starts_at
          LIMIT 5`,
        [organizerId, profileId],
      ),
    ])
    return {
      lifecycleCounts: lifecycle.rows,
      upcoming: upcoming.rows,
      capacity: { total: Number(capacity.rows[0]?.total ?? 0), remaining: Number(capacity.rows[0]?.remaining ?? 0) },
      orderStates: fillOrderStates(orders.rows),
      tickets: { issued: tickets.rows[0]?.issued ?? 0, checkedIn: tickets.rows[0]?.checkedIn ?? 0 },
      attention: { unpublishedWithFutureStarts: drafts.rows, withoutTicketTypes: noTypes.rows },
    }
  } catch (error) {
    logServerError('page:organizer-overview', error)
    return null
  }
}

export type WorkspaceOrderRow = {
  id: string
  publicId: string
  orderNumber: string
  purchaserName: string
  purchaserEmail: string
  isGuest: boolean
  paymentState: string
  currency: string
  totalMinorUnits: string
  eventId: string | null
  eventTitle: string | null
  createdAt: string
}

export type WorkspaceOrderList = { rows: WorkspaceOrderRow[]; total: number } | null

/** Cross-event order list for one workspace. The SQL itself enforces the
 * owner/manager gate (buyer PII — matching the per-event orders page), so
 * the data layer stays safe independent of any caller. */
export async function listWorkspaceOrders(organizerId: string, profileId: string, filters: { q?: string; state?: string; page?: number; pageSize?: number }): Promise<WorkspaceOrderList> {
  const pageSize = filters.pageSize ?? 25
  const term = `%${(filters.q?.trim() ?? '').replace(/[%_]/g, (match) => `\\${match}`)}%`
  const state = isOrderState(filters.state) ? filters.state : null
  const offset = (Math.max(1, filters.page ?? 1) - 1) * pageSize
  const where = [
    ORDER_SCOPE,
    `EXISTS (SELECT 1 FROM ticketug.organizer_member WHERE organizer_id = $1 AND user_profile_id = $2 AND status = 'ACTIVE' AND role IN ('ORGANIZER_OWNER', 'ORGANIZER_MANAGER'))`,
    `($3::text = '' OR o.order_number ILIKE $3 OR o.public_id ILIKE $3 OR o.purchaser_email ILIKE $3 OR o.purchaser_name ILIKE $3)`,
    `($4::text IS NULL OR o.payment_state = $4)`,
  ]
  try {
    const [list, count] = await Promise.all([
      pool.query<WorkspaceOrderRow>(
        `SELECT o.id, o.public_id AS "publicId", o.order_number AS "orderNumber",
                o.purchaser_name AS "purchaserName", o.purchaser_email AS "purchaserEmail",
                (o.user_profile_id IS NULL) AS "isGuest", o.payment_state AS "paymentState",
                o.currency, o.total_minor_units AS "totalMinorUnits", o.created_at AS "createdAt",
                first_event.event_id AS "eventId", first_event.event_title AS "eventTitle"
           FROM ticketug.order o
           LEFT JOIN LATERAL (
                SELECT tt.event_id AS event_id, e.title AS event_title
                  FROM ticketug.order_item oi
                  JOIN ticketug.ticket_type tt ON tt.id = oi.ticket_type_id
                  JOIN ticketug.event e ON e.id = tt.event_id
                 WHERE oi.order_id = o.id AND e.organizer_id = $1
                 LIMIT 1
           ) first_event ON true
          WHERE ${where.join(' AND ')}
          ORDER BY o.created_at DESC
          LIMIT $5 OFFSET $6`,
        [organizerId, profileId, term, state, pageSize, offset],
      ),
      pool.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total FROM ticketug.order o WHERE ${where.join(' AND ')}`,
        [organizerId, profileId, term, state],
      ),
    ])
    return { rows: list.rows, total: count.rows[0]?.total ?? 0 }
  } catch (error) {
    logServerError('page:organizer-orders', error)
    return null
  }
}

export type SalesByEventRow = {
  id: string
  title: string
  lifecycle_state: string
  starts_at: string
  paidOrders: number
  grossPaidMinor: string
  ticketsIssued: number
  checkedIn: number
  capacity: number
  remaining: number
}

/** Per-event sales table (single grouped query — no N+1). Used by both the
 * Reports page and the sales-by-event CSV export. The SQL enforces the
 * owner/manager gate (sales data is owner/manager data). */
export async function loadSalesByEvent(organizerId: string, profileId: string, limit = 100): Promise<SalesByEventRow[] | null> {
  try {
    const result = await pool.query<SalesByEventRow>(
      `SELECT e.id, e.title, e.lifecycle_state, e.starts_at,
              (SELECT COUNT(*)::int FROM ticketug.order o
                WHERE o.payment_state = 'PAID'
                  AND EXISTS (SELECT 1 FROM ticketug.order_item oi JOIN ticketug.ticket_type tt ON tt.id = oi.ticket_type_id
                               WHERE oi.order_id = o.id AND tt.event_id = e.id)) AS "paidOrders",
              (SELECT COALESCE(SUM(o.total_minor_units), 0) FROM ticketug.order o
                WHERE o.payment_state = 'PAID'
                  AND EXISTS (SELECT 1 FROM ticketug.order_item oi JOIN ticketug.ticket_type tt ON tt.id = oi.ticket_type_id
                               WHERE oi.order_id = o.id AND tt.event_id = e.id)) AS "grossPaidMinor",
              (SELECT COUNT(*)::int FROM ticketug.ticket t WHERE t.event_id = e.id) AS "ticketsIssued",
              (SELECT COUNT(*)::int FROM ticketug.check_in ci WHERE ci.event_id = e.id) AS "checkedIn",
              COALESCE((SELECT SUM(tt.capacity) FROM ticketug.ticket_type tt WHERE tt.event_id = e.id), 0) AS capacity,
              COALESCE((SELECT SUM(tt.remaining_capacity) FROM ticketug.ticket_type tt WHERE tt.event_id = e.id), 0) AS remaining
         FROM ticketug.event e
        WHERE e.organizer_id = $1
          AND EXISTS (SELECT 1 FROM ticketug.organizer_member WHERE organizer_id = $1 AND user_profile_id = $2 AND status = 'ACTIVE' AND role IN ('ORGANIZER_OWNER', 'ORGANIZER_MANAGER'))
        ORDER BY "grossPaidMinor" DESC, e.starts_at DESC
        LIMIT $3`,
      [organizerId, profileId, limit],
    )
    return result.rows
  } catch (error) {
    logServerError('page:organizer-reports', error)
    return null
  }
}

export type OrdersByStateTotals = Array<{ state: OrderState; count: number; totalMinorUnits: number }> | null

/** Workspace-wide order-state totals (same scope as listWorkspaceOrders;
 * owner/manager gate enforced inside the SQL). */
export async function loadOrdersByState(organizerId: string, profileId: string): Promise<OrdersByStateTotals> {
  try {
    const result = await pool.query<{ payment_state: string; order_count: number; total_minor_units: string }>(
      `SELECT o.payment_state, COUNT(*)::int AS order_count, COALESCE(SUM(o.total_minor_units), 0) AS total_minor_units
         FROM ticketug.order o
        WHERE ${ORDER_SCOPE}
          AND EXISTS (SELECT 1 FROM ticketug.organizer_member WHERE organizer_id = $1 AND user_profile_id = $2 AND status = 'ACTIVE' AND role IN ('ORGANIZER_OWNER', 'ORGANIZER_MANAGER'))
        GROUP BY o.payment_state`,
      [organizerId, profileId],
    )
    return fillOrderStates(result.rows)
  } catch (error) {
    logServerError('page:organizer-reports-states', error)
    return null
  }
}

/** Publication readiness for ONE event, computed from real persisted fields
 * only. Advisory UI data — the lifecycle state machine in SQL remains the
 * sole authority for transitions (this never blocks or bypasses it).
 * Re-scoped by organizer + membership for defense-in-depth, mirroring the
 * event console's own gate. `key` lets the page build safe absolute hrefs. */
export type ReadinessKey = 'description' | 'ticket-type' | 'on-sale' | 'schedule'
export async function loadPublicationReadiness(eventId: string, organizerId: string, profileId: string): Promise<Array<{ key: ReadinessKey; label: string; met: boolean; hint: string }> | null> {
  try {
    const result = await pool.query<{ description_empty: boolean; starts_future: boolean; ticketTypeCount: number; onSaleCount: number }>(
      `SELECT (e.description = '') AS description_empty,
              (e.starts_at >= now()) AS starts_future,
              (SELECT COUNT(*)::int FROM ticketug.ticket_type tt WHERE tt.event_id = e.id) AS "ticketTypeCount",
              (SELECT COUNT(*)::int FROM ticketug.ticket_type tt
                WHERE tt.event_id = e.id AND tt.active AND tt.remaining_capacity > 0
                  AND (tt.sale_starts_at IS NULL OR tt.sale_starts_at <= now())
                  AND (tt.sale_ends_at IS NULL OR tt.sale_ends_at >= now())) AS "onSaleCount"
         FROM ticketug.event e
        WHERE e.id = $1
          AND e.organizer_id = $2
          AND EXISTS (SELECT 1 FROM ticketug.organizer_member WHERE organizer_id = $2 AND user_profile_id = $3 AND status = 'ACTIVE')`,
      [eventId, organizerId, profileId],
    )
    const row = result.rows[0]
    if (!row) return null
    return [
      { key: 'description', label: 'Event description added', met: !row.description_empty, hint: 'Buyers read this first on the public page.' },
      { key: 'ticket-type', label: 'At least one ticket type created', met: row.ticketTypeCount > 0, hint: 'Without a ticket type nobody can buy a ticket.' },
      { key: 'on-sale', label: 'At least one ticket type on sale with stock', met: row.onSaleCount > 0, hint: 'A ticket type must be active, stocked, and inside its sales window.' },
      { key: 'schedule', label: 'Start date is in the future', met: row.starts_future, hint: 'Events are published while they still have an upcoming start.' },
    ]
  } catch (error) {
    logServerError('page:organizer-publish-readiness', error)
    return null
  }
}
