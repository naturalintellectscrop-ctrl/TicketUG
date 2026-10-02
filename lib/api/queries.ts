import { pool } from '@/lib/db'
import { v1BadRequest, v1NotFound, type V1PaginationInput } from '@/lib/api/http'
import type { ApiKeyContext } from '@/lib/api/auth'

/**
 * Developer API v1 read queries — organizer-scoped by construction.
 *
 * Every statement filters by the API key's organizer_id, so a credential can
 * never observe another workspace's data. The v1 surface is READ-ONLY: these
 * functions contain zero write statements (the audit guarantee kept from the
 * platform console). Ticket credentials and credential hashes are never
 * selected — an API key cannot mint or reproduce a QR.
 */

export const API_EVENT_LIFECYCLE_STATES = ['DRAFT', 'PUBLISHED', 'SALES_OPEN', 'SALES_CLOSED', 'EVENT_LIVE', 'COMPLETED', 'CANCELLED', 'SUSPENDED', 'ARCHIVED'] as const
export const API_PUBLICATION_STATES = ['PUBLIC', 'PRIVATE'] as const
export const API_ORDER_PAYMENT_STATES = ['AWAITING_PAYMENT', 'PAYMENT_PROCESSING', 'PAID', 'CANCELLED', 'EXPIRED'] as const
export const API_TICKET_STATUSES = ['ISSUED', 'CHECKED_IN', 'CANCELLED', 'REFUNDED', 'VOID'] as const

function validatedFilter(value: string | null, allowed: readonly string[], code: string): string {
  if (value === null || value === '') return ''
  if (!(allowed as readonly string[]).includes(value)) {
    throw v1BadRequest(code, `Filter must be one of: ${allowed.join(', ')}.`)
  }
  return value
}

function likeEscape(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`)
}

export type ApiEventRow = {
  publicId: string
  title: string
  slug: string
  lifecycleState: string
  publicationState: string
  startsAt: string
  endsAt: string
  timezone: string
  venueName: string | null
  ticketTypeCount: number
  ticketsIssued: number
}

export async function listApiEvents(
  ctx: ApiKeyContext,
  options: { q: string; lifecycle: string | null; publication: string | null } & V1PaginationInput,
): Promise<{ rows: ApiEventRow[]; total: number }> {
  const lifecycle = validatedFilter(options.lifecycle, API_EVENT_LIFECYCLE_STATES, 'INVALID_FILTER')
  const publication = validatedFilter(options.publication, API_PUBLICATION_STATES, 'INVALID_FILTER')
  const like = options.q ? `%${likeEscape(options.q)}%` : ''
  const filters = `e.organizer_id = $1
      AND ($2::text = '' OR e.lifecycle_state = $2::text)
      AND ($3::text = '' OR e.publication_state = $3::text)
      AND ($4::text = '' OR e.title ILIKE $4::text OR e.slug ILIKE $4::text)`
  const params = [ctx.organizerId, lifecycle, publication, like]
  const [listResult, countResult] = await Promise.all([
    pool.query<{
      public_id: string
      title: string
      slug: string
      lifecycle_state: string
      publication_state: string
      starts_at: string
      ends_at: string
      timezone: string
      venue_name: string | null
      ticket_type_count: string
      tickets_issued: string
    }>(
      `SELECT e.public_id, e.title, e.slug, e.lifecycle_state, e.publication_state, e.starts_at, e.ends_at, e.timezone,
              v.name AS venue_name,
              (SELECT COUNT(*)::int FROM ticketug.ticket_type tt WHERE tt.event_id = e.id) AS ticket_type_count,
              (SELECT COUNT(*)::int FROM ticketug.ticket t WHERE t.event_id = e.id AND t.status IN ('ISSUED','CHECKED_IN')) AS tickets_issued
         FROM ticketug.event e
         LEFT JOIN ticketug.venue v ON v.id = e.venue_id
        WHERE ${filters}
        ORDER BY e.created_at DESC
        LIMIT $5 OFFSET $6`,
      [...params, options.limit, options.offset],
    ),
    pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ticketug.event e WHERE ${filters}`, params),
  ])
  return {
    rows: listResult.rows.map((row) => ({
      publicId: row.public_id,
      title: row.title,
      slug: row.slug,
      lifecycleState: row.lifecycle_state,
      publicationState: row.publication_state,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      timezone: row.timezone,
      venueName: row.venue_name,
      ticketTypeCount: Number(row.ticket_type_count),
      ticketsIssued: Number(row.tickets_issued),
    })),
    total: Number(countResult.rows[0]?.count ?? 0),
  }
}

export type ApiEventTypeRow = {
  publicId: string
  name: string
  priceMinorUnits: string
  currency: string
  capacity: number
  remainingCapacity: number
  active: boolean
  saleStartsAt: string | null
  saleEndsAt: string | null
}

export type ApiEventDetail = {
  event: Omit<ApiEventRow, 'ticketTypeCount' | 'ticketsIssued'> & { description: string }
  ticketTypes: ApiEventTypeRow[]
  stats: { paidOrders: number; ticketsIssued: number; checkedIn: number }
}

export async function getApiEvent(ctx: ApiKeyContext, eventPublicId: string): Promise<ApiEventDetail | null> {
  const eventResult = await pool.query<{
    public_id: string
    title: string
    slug: string
    description: string
    lifecycle_state: string
    publication_state: string
    starts_at: string
    ends_at: string
    timezone: string
    venue_name: string | null
  }>(
    `SELECT e.public_id, e.title, e.slug, e.description, e.lifecycle_state, e.publication_state, e.starts_at, e.ends_at, e.timezone, v.name AS venue_name
       FROM ticketug.event e
       LEFT JOIN ticketug.venue v ON v.id = e.venue_id
      WHERE e.organizer_id = $1 AND e.public_id = $2`,
    [ctx.organizerId, eventPublicId],
  )
  const event = eventResult.rows[0]
  if (!event) return null
  const [typeResult, statsResult] = await Promise.all([
    pool.query<{
      public_id: string
      name: string
      price_minor_units: string
      currency: string
      capacity: number
      remaining_capacity: number
      active: boolean
      sale_starts_at: string | null
      sale_ends_at: string | null
    }>(
      `SELECT public_id, name, price_minor_units, currency, capacity, remaining_capacity, active, sale_starts_at, sale_ends_at
         FROM ticketug.ticket_type
        WHERE event_id = (SELECT id FROM ticketug.event WHERE organizer_id = $1 AND public_id = $2)
        ORDER BY sort_order, created_at`,
      [ctx.organizerId, eventPublicId],
    ),
    pool.query<{ paid_orders: string; tickets_issued: string; checked_in: string }>(
      `SELECT
         (SELECT COUNT(*)::text FROM ticketug.order o
           WHERE o.payment_state = 'PAID'
             AND EXISTS (SELECT 1 FROM ticketug.order_item oi JOIN ticketug.ticket_type tt ON tt.id = oi.ticket_type_id
                         WHERE oi.order_id = o.id AND tt.event_id = (SELECT id FROM ticketug.event WHERE organizer_id = $1 AND public_id = $2))) AS paid_orders,
         (SELECT COUNT(*)::text FROM ticketug.ticket t
           WHERE t.event_id = (SELECT id FROM ticketug.event WHERE organizer_id = $1 AND public_id = $2)
             AND t.status IN ('ISSUED','CHECKED_IN')) AS tickets_issued,
         (SELECT COUNT(*)::text FROM ticketug.check_in ci
           WHERE ci.event_id = (SELECT id FROM ticketug.event WHERE organizer_id = $1 AND public_id = $2)) AS checked_in`,
      [ctx.organizerId, eventPublicId],
    ),
  ])
  return {
    event: {
      publicId: event.public_id,
      title: event.title,
      slug: event.slug,
      description: event.description,
      lifecycleState: event.lifecycle_state,
      publicationState: event.publication_state,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      timezone: event.timezone,
      venueName: event.venue_name,
    },
    ticketTypes: typeResult.rows.map((type) => ({
      publicId: type.public_id,
      name: type.name,
      priceMinorUnits: type.price_minor_units,
      currency: type.currency,
      capacity: type.capacity,
      remainingCapacity: type.remaining_capacity,
      active: type.active,
      saleStartsAt: type.sale_starts_at,
      saleEndsAt: type.sale_ends_at,
    })),
    stats: {
      paidOrders: Number(statsResult.rows[0]?.paid_orders ?? 0),
      ticketsIssued: Number(statsResult.rows[0]?.tickets_issued ?? 0),
      checkedIn: Number(statsResult.rows[0]?.checked_in ?? 0),
    },
  }
}

export type ApiOrderRow = {
  publicId: string
  orderNumber: string
  purchaserName: string
  purchaserEmail: string
  purchaserPhone: string | null
  status: string
  totalMinorUnits: string
  currency: string
  createdAt: string
  eventPublicId: string
  eventTitle: string
}

export async function listApiOrders(
  ctx: ApiKeyContext,
  options: { event: string | null; status: string | null } & V1PaginationInput,
): Promise<{ rows: ApiOrderRow[]; total: number }> {
  const status = validatedFilter(options.status, API_ORDER_PAYMENT_STATES, 'INVALID_FILTER')
  const event = options.event ?? ''
  const scopedFrom = `FROM ticketug.order o
    JOIN ticketug.order_item oi ON oi.order_id = o.id
    JOIN ticketug.ticket_type tt ON tt.id = oi.ticket_type_id
    JOIN ticketug.event e ON e.id = tt.event_id
   WHERE e.organizer_id = $1
     AND ($2::text = '' OR e.public_id = $2::text)
     AND ($3::text = '' OR o.payment_state = $3::text)`
  const [listResult, countResult] = await Promise.all([
    pool.query<{
      public_id: string
      order_number: string
      purchaser_name: string
      purchaser_email: string
      purchaser_phone: string | null
      payment_state: string
      total_minor_units: string
      currency: string
      created_at: string
      event_public_id: string
      event_title: string
    }>(
      `SELECT DISTINCT o.public_id, o.order_number, o.purchaser_name, o.purchaser_email, o.purchaser_phone, o.payment_state,
              o.total_minor_units, o.currency, o.created_at, e.public_id AS event_public_id, e.title AS event_title
         ${scopedFrom}
        ORDER BY o.created_at DESC
        LIMIT $4 OFFSET $5`,
      [ctx.organizerId, event, status, options.limit, options.offset],
    ),
    pool.query<{ count: string }>(`SELECT COUNT(DISTINCT o.id)::text AS count ${scopedFrom}`, [ctx.organizerId, event, status]),
  ])
  return {
    rows: listResult.rows.map((row) => ({
      publicId: row.public_id,
      orderNumber: row.order_number,
      purchaserName: row.purchaser_name,
      purchaserEmail: row.purchaser_email,
      purchaserPhone: row.purchaser_phone,
      status: row.payment_state,
      totalMinorUnits: row.total_minor_units,
      currency: row.currency,
      createdAt: row.created_at,
      eventPublicId: row.event_public_id,
      eventTitle: row.event_title,
    })),
    total: Number(countResult.rows[0]?.count ?? 0),
  }
}

export async function getApiOrder(ctx: ApiKeyContext, orderPublicId: string): Promise<null | {
  order: Omit<ApiOrderRow, 'eventPublicId' | 'eventTitle'> & { eventPublicId: string; eventTitle: string; updatedAt: string }
  items: Array<{ ticketTypePublicId: string; ticketTypeName: string; quantity: number; unitPriceMinorUnits: string; currency: string; lineTotalMinorUnits: string }>
  tickets: Array<{ publicId: string; status: string; unitNumber: number; attendeeName: string; ticketTypeName: string; issuedAt: string }>
}> {
  const orderResult = await pool.query<{
    public_id: string
    order_number: string
    purchaser_name: string
    purchaser_email: string
    purchaser_phone: string | null
    payment_state: string
    total_minor_units: string
    currency: string
    created_at: string
    updated_at: string
    event_public_id: string
    event_title: string
  }>(
    `SELECT DISTINCT o.public_id, o.order_number, o.purchaser_name, o.purchaser_email, o.purchaser_phone, o.payment_state,
            o.total_minor_units, o.currency, o.created_at, o.updated_at, e.public_id AS event_public_id, e.title AS event_title
       FROM ticketug.order o
       JOIN ticketug.order_item oi ON oi.order_id = o.id
       JOIN ticketug.ticket_type tt ON tt.id = oi.ticket_type_id
       JOIN ticketug.event e ON e.id = tt.event_id AND e.organizer_id = $1
      WHERE o.public_id = $2`,
    [ctx.organizerId, orderPublicId],
  )
  const order = orderResult.rows[0]
  if (!order) return null
  const [itemsResult, ticketsResult] = await Promise.all([
    pool.query<{ ticket_type_public_id: string; ticket_type_name: string; quantity: number; unit_price_minor_units: string; currency_snapshot: string; line_total_minor_units: string }>(
      `SELECT tt.public_id AS ticket_type_public_id, oi.ticket_name_snapshot AS ticket_type_name, oi.quantity,
              oi.unit_price_minor_units, oi.currency_snapshot, oi.line_total_minor_units
         FROM ticketug.order_item oi
         JOIN ticketug.ticket_type tt ON tt.id = oi.ticket_type_id
        WHERE oi.order_id = (SELECT o.id FROM ticketug.order o WHERE o.public_id = $2::text)
          AND EXISTS (SELECT 1 FROM ticketug.event e WHERE e.id = tt.event_id AND e.organizer_id = $1::uuid)
        ORDER BY oi.created_at`,
      [ctx.organizerId, orderPublicId],
    ),
    pool.query<{ public_id: string; status: string; unit_number: number; attendee_name: string; ticket_type_name_snapshot: string; issued_at: string }>(
      `SELECT t.public_id, t.status, t.unit_number, t.attendee_name, t.ticket_type_name_snapshot, t.issued_at
         FROM ticketug.ticket t
        WHERE t.order_id = (SELECT o.id FROM ticketug.order o WHERE o.public_id = $2::text)
          AND EXISTS (SELECT 1 FROM ticketug.order_item oi
                      JOIN ticketug.ticket_type tt ON tt.id = oi.ticket_type_id
                      JOIN ticketug.event e ON e.id = tt.event_id AND e.organizer_id = $1::uuid
                      WHERE oi.id = t.order_item_id)
        ORDER BY t.unit_number`,
      [ctx.organizerId, orderPublicId],
    ),
  ])
  return {
    order: {
      publicId: order.public_id,
      orderNumber: order.order_number,
      purchaserName: order.purchaser_name,
      purchaserEmail: order.purchaser_email,
      purchaserPhone: order.purchaser_phone,
      status: order.payment_state,
      totalMinorUnits: order.total_minor_units,
      currency: order.currency,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      eventPublicId: order.event_public_id,
      eventTitle: order.event_title,
    },
    items: itemsResult.rows.map((item) => ({
      ticketTypePublicId: item.ticket_type_public_id,
      ticketTypeName: item.ticket_type_name,
      quantity: item.quantity,
      unitPriceMinorUnits: item.unit_price_minor_units,
      currency: item.currency_snapshot,
      lineTotalMinorUnits: item.line_total_minor_units,
    })),
    tickets: ticketsResult.rows.map((ticket) => ({
      publicId: ticket.public_id,
      status: ticket.status,
      unitNumber: ticket.unit_number,
      attendeeName: ticket.attendee_name,
      ticketTypeName: ticket.ticket_type_name_snapshot,
      issuedAt: ticket.issued_at,
    })),
  }
}

export type ApiTicketRow = {
  publicId: string
  status: string
  unitNumber: number
  attendeeName: string
  attendeeEmail: string
  ticketTypePublicId: string
  ticketTypeName: string
  orderNumber: string
  orderPublicId: string
  eventPublicId: string
  eventTitle: string
  issuedAt: string
  checkedInAt: string | null
}

export async function listApiTickets(
  ctx: ApiKeyContext,
  options: { event: string | null; status: string | null } & V1PaginationInput,
): Promise<{ rows: ApiTicketRow[]; total: number }> {
  const status = validatedFilter(options.status, API_TICKET_STATUSES, 'INVALID_FILTER')
  const event = options.event ?? ''
  const filters = `e.organizer_id = $1
      AND ($2::text = '' OR e.public_id = $2::text)
      AND ($3::text = '' OR t.status = $3::text)`
  const params = [ctx.organizerId, event, status]
  const [listResult, countResult] = await Promise.all([
    pool.query<{
      public_id: string
      status: string
      unit_number: number
      attendee_name: string
      attendee_email: string
      ticket_type_public_id: string
      ticket_type_name_snapshot: string
      order_number: string
      order_public_id: string
      event_public_id: string
      event_title: string
      issued_at: string
      checked_in_at: string | null
    }>(
      `SELECT t.public_id, t.status, t.unit_number, t.attendee_name, t.attendee_email,
              tt.public_id AS ticket_type_public_id, t.ticket_type_name_snapshot,
              o.order_number, o.public_id AS order_public_id,
              e.public_id AS event_public_id, e.title AS event_title,
              t.issued_at, ci.checked_in_at
         FROM ticketug.ticket t
         JOIN ticketug.event e ON e.id = t.event_id
         JOIN ticketug.ticket_type tt ON tt.id = t.ticket_type_id
         JOIN ticketug.order o ON o.id = t.order_id
         LEFT JOIN ticketug.check_in ci ON ci.ticket_id = t.id
        WHERE ${filters}
        ORDER BY t.issued_at DESC
        LIMIT $4 OFFSET $5`,
      [...params, options.limit, options.offset],
    ),
    pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
         FROM ticketug.ticket t
         JOIN ticketug.event e ON e.id = t.event_id
        WHERE ${filters}`,
      params,
    ),
  ])
  return {
    rows: listResult.rows.map((row) => ({
      publicId: row.public_id,
      status: row.status,
      unitNumber: row.unit_number,
      attendeeName: row.attendee_name,
      attendeeEmail: row.attendee_email,
      ticketTypePublicId: row.ticket_type_public_id,
      ticketTypeName: row.ticket_type_name_snapshot,
      orderNumber: row.order_number,
      orderPublicId: row.order_public_id,
      eventPublicId: row.event_public_id,
      eventTitle: row.event_title,
      issuedAt: row.issued_at,
      checkedInAt: row.checked_in_at,
    })),
    total: Number(countResult.rows[0]?.count ?? 0),
  }
}

/** Guard for detail lookups: `v1NotFound()` if the scoped query found nothing. */
export function requireFound<T>(value: T | null): T {
  if (value === null) throw v1NotFound()
  return value
}
