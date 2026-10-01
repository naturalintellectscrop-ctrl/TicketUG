/**
 * Platform Control Center data layer — READ-ONLY.
 *
 * Every query in this module is a parameterized SELECT against the ticketug
 * schema (plus auth.users for identity columns the platform owns). There are
 * deliberately NO UPDATE/DELETE/INSERT statements here: the control center is
 * an investigation and monitoring surface. All state changes in TicketUG flow
 * through their owning API routes and transactional SQL functions (order
 * lifecycle, payment events, event transitions, membership changes) — the
 * platform dashboard reports on them but never bypasses them.
 *
 * Conventions:
 * - Aggregates return COUNT(*)::int (number) and SUM(...)::bigint (string from
 *   pg) — sums are converted with Number() like lib/event-sales-metrics.ts.
 * - Lists paginate server-side (LIMIT/OFFSET + a paired COUNT) — tables are
 *   never loaded whole into the browser.
 * - Ticket credential columns (credential, credential_hash) and guest access
 *   token hashes are NEVER selected: a control center that displayed them
 *   would let any viewer mint valid QR credentials.
 * - webhook_event.payload is never rendered (it can contain purchaser PII);
 *   the webhook stream shows envelope columns only.
 */
import { pool } from '@/lib/db'
import { logServerError } from '@/lib/server/errors'
import { loadEventSalesMetrics } from '@/lib/event-sales-metrics'

export const PAGE_SIZE = 25

/** Escape LIKE metacharacters in user-supplied search terms. */
function like(term: string): string {
  return `%${term.replace(/[\\%_]/g, (match) => `\\${match}`)}%`
}

/* ── Overview metrics ──────────────────────────────────────────────────── */

export type PlatformMetrics = {
  users: number
  organizers: number
  eventsAll: number
  eventsPublic: number
  eventsSalesLive: number
  eventsUpcoming: number
  ordersAll: number
  ordersPaid: number
  ordersAwaitingPayment: number
  ordersProcessing: number
  ordersExpired: number
  ordersCancelled: number
  grossCollectedMinor: number
  paymentsSucceeded: number
  paymentsOpen: number
  paymentsFailed: number
  paymentsStuckProcessing: number
  ticketsIssued: number
  ticketsCheckedIn: number
  ticketsVoid: number
  checkInsTotal: number
  webhookFailures: number
  webhooksUnprocessed: number
  ticketIssuanceFailures: number
  invitationsPending: number
  invitationsExpiredPending: number
  securityEventsTotal: number
}

// One round-trip: every counter is a scalar subselect over an indexed column.
// Null on database failure — an outage is never rendered as a zero platform.
export async function loadPlatformMetrics(): Promise<PlatformMetrics | null> {
  try {
    const result = await pool.query<PlatformMetrics>(`SELECT
      (SELECT COUNT(*)::int FROM ticketug.user_profile) AS users,
      (SELECT COUNT(*)::int FROM ticketug.organizer) AS organizers,
      (SELECT COUNT(*)::int FROM ticketug.event) AS "eventsAll",
      (SELECT COUNT(*)::int FROM ticketug.event WHERE publication_state = 'PUBLIC') AS "eventsPublic",
      (SELECT COUNT(*)::int FROM ticketug.event WHERE lifecycle_state IN ('SALES_OPEN','EVENT_LIVE')) AS "eventsSalesLive",
      (SELECT COUNT(*)::int FROM ticketug.event WHERE lifecycle_state NOT IN ('CANCELLED','COMPLETED','ARCHIVED') AND starts_at > now()) AS "eventsUpcoming",
      (SELECT COUNT(*)::int FROM ticketug.order) AS "ordersAll",
      (SELECT COUNT(*)::int FROM ticketug.order WHERE payment_state = 'PAID') AS "ordersPaid",
      (SELECT COUNT(*)::int FROM ticketug.order WHERE payment_state = 'AWAITING_PAYMENT') AS "ordersAwaitingPayment",
      (SELECT COUNT(*)::int FROM ticketug.order WHERE payment_state = 'PAYMENT_PROCESSING') AS "ordersProcessing",
      (SELECT COUNT(*)::int FROM ticketug.order WHERE payment_state = 'EXPIRED') AS "ordersExpired",
      (SELECT COUNT(*)::int FROM ticketug.order WHERE payment_state = 'CANCELLED') AS "ordersCancelled",
      (SELECT COALESCE(SUM(amount_minor_units), 0)::bigint FROM ticketug.payment WHERE status = 'SUCCEEDED') AS "grossCollectedMinor",
      (SELECT COUNT(*)::int FROM ticketug.payment WHERE status = 'SUCCEEDED') AS "paymentsSucceeded",
      (SELECT COUNT(*)::int FROM ticketug.payment WHERE status IN ('PENDING','PROCESSING')) AS "paymentsOpen",
      (SELECT COUNT(*)::int FROM ticketug.payment WHERE status = 'FAILED') AS "paymentsFailed",
      (SELECT COUNT(*)::int FROM ticketug.payment WHERE status = 'PROCESSING' AND updated_at < now() - interval '1 hour') AS "paymentsStuckProcessing",
      (SELECT COUNT(*)::int FROM ticketug.ticket) AS "ticketsIssued",
      (SELECT COUNT(*)::int FROM ticketug.ticket WHERE status = 'CHECKED_IN') AS "ticketsCheckedIn",
      (SELECT COUNT(*)::int FROM ticketug.ticket WHERE status = 'VOID') AS "ticketsVoid",
      (SELECT COUNT(*)::int FROM ticketug.check_in) AS "checkInsTotal",
      (SELECT COUNT(*)::int FROM ticketug.webhook_event WHERE processing_status IN ('FAILED','REJECTED')) AS "webhookFailures",
      (SELECT COUNT(*)::int FROM ticketug.webhook_event WHERE processing_status = 'RECEIVED') AS "webhooksUnprocessed",
      (SELECT COUNT(*)::int FROM ticketug.ticket_issuance_event WHERE status = 'FAILED') AS "ticketIssuanceFailures",
      (SELECT COUNT(*)::int FROM ticketug.organizer_invitation WHERE status = 'PENDING' AND expires_at >= now()) AS "invitationsPending",
      (SELECT COUNT(*)::int FROM ticketug.organizer_invitation WHERE status = 'PENDING' AND expires_at < now()) AS "invitationsExpiredPending",
      (SELECT COUNT(*)::int FROM ticketug.security_event) AS "securityEventsTotal"`)
    return result.rows[0] ?? null
  } catch (error) {
    logServerError('platform:metrics', error)
    return null
  }
}

/* ── Overview recent activity ──────────────────────────────────────────── */

export type RecentOrder = { publicId: string; orderNumber: string; purchaserEmail: string; paymentState: string; totalMinorUnits: string; createdAt: string; isGuest: boolean }
export type RecentPayment = { publicId: string; provider: string; status: string; amountMinorUnits: string; orderNumber: string; orderPublicId: string; updatedAt: string }
export type RecentEvent = { publicId: string; title: string; organizerName: string; lifecycleState: string; startsAt: string }
export type RecentAuditEvent = { id: string; eventType: string; createdAt: string; actorName: string | null; actorEmail: string | null }

export async function loadRecentActivity(): Promise<{ orders: RecentOrder[]; payments: RecentPayment[]; events: RecentEvent[]; audit: RecentAuditEvent[] } | null> {
  try {
    const [orders, payments, events, audit] = await Promise.all([
      pool.query<RecentOrder>(
        `SELECT o.public_id AS "publicId", o.order_number AS "orderNumber", o.purchaser_email AS "purchaserEmail",
                o.payment_state AS "paymentState", o.total_minor_units AS "totalMinorUnits", o.created_at AS "createdAt",
                (o.user_profile_id IS NULL) AS "isGuest"
           FROM ticketug.order o ORDER BY o.created_at DESC LIMIT 8`),
      pool.query<RecentPayment>(
        `SELECT p.public_id AS "publicId", p.provider, p.status, p.amount_minor_units AS "amountMinorUnits",
                o.order_number AS "orderNumber", o.public_id AS "orderPublicId", p.updated_at AS "updatedAt"
           FROM ticketug.payment p JOIN ticketug.order o ON o.id = p.order_id
          ORDER BY p.updated_at DESC LIMIT 8`),
      pool.query<RecentEvent>(
        `SELECT e.public_id AS "publicId", e.title, org.name AS "organizerName",
                e.lifecycle_state AS "lifecycleState", e.starts_at AS "startsAt"
           FROM ticketug.event e JOIN ticketug.organizer org ON org.id = e.organizer_id
          ORDER BY e.created_at DESC LIMIT 8`),
      pool.query<RecentAuditEvent>(
        `SELECT se.id, se.event_type AS "eventType", se.created_at AS "createdAt",
                p.display_name AS "actorName", u.email AS "actorEmail"
           FROM ticketug.security_event se
           LEFT JOIN ticketug.user_profile p ON p.id = se.user_profile_id
           LEFT JOIN auth.users u ON u.id::text = p.auth_user_id
          ORDER BY se.created_at DESC LIMIT 8`),
    ])
    return { orders: orders.rows, payments: payments.rows, events: events.rows, audit: audit.rows }
  } catch (error) {
    logServerError('platform:recent-activity', error)
    return null
  }
}

/* ── Events explorer ───────────────────────────────────────────────────── */

export type PlatformEventRow = {
  id: string
  publicId: string
  title: string
  slug: string
  organizerName: string
  organizerId: string
  venueName: string | null
  publicationState: string
  lifecycleState: string
  startsAt: string
  endsAt: string
  ticketTypeCount: number
  ticketsIssued: number
}

export const EVENT_LIFECYCLE_STATES = ['DRAFT', 'PUBLISHED', 'SALES_OPEN', 'SALES_CLOSED', 'EVENT_LIVE', 'COMPLETED', 'CANCELLED', 'SUSPENDED', 'ARCHIVED'] as const

export async function listPlatformEvents(filters: { q?: string; lifecycle?: string; publication?: string; page?: number }): Promise<{ rows: PlatformEventRow[]; total: number } | null> {
  const term = like(filters.q?.trim() ?? '')
  const lifecycle = EVENT_LIFECYCLE_STATES.find((state) => state === filters.lifecycle) ?? null
  const publication = filters.publication === 'PUBLIC' || filters.publication === 'PRIVATE' ? filters.publication : null
  const where = [`($1::text = '' OR e.title ILIKE $1 OR e.slug ILIKE $1 OR e.public_id ILIKE $1 OR org.name ILIKE $1)`,
    `($2::text IS NULL OR e.lifecycle_state = $2)`,
    `($3::text IS NULL OR e.publication_state = $3)`]
  try {
    const [rows, count] = await Promise.all([
      pool.query<PlatformEventRow>(
        `SELECT e.id, e.public_id AS "publicId", e.title, e.slug, org.name AS "organizerName",
                org.id AS "organizerId", v.name AS "venueName", e.publication_state AS "publicationState",
                e.lifecycle_state AS "lifecycleState", e.starts_at AS "startsAt", e.ends_at AS "endsAt",
                (SELECT COUNT(*)::int FROM ticketug.ticket_type tt WHERE tt.event_id = e.id) AS "ticketTypeCount",
                (SELECT COUNT(*)::int FROM ticketug.ticket t WHERE t.event_id = e.id) AS "ticketsIssued"
           FROM ticketug.event e
           JOIN ticketug.organizer org ON org.id = e.organizer_id
           LEFT JOIN ticketug.venue v ON v.id = e.venue_id
          WHERE ${where.join(' AND ')}
          ORDER BY e.starts_at DESC
          LIMIT $4 OFFSET $5`,
        [term, lifecycle, publication, PAGE_SIZE, (Math.max(1, filters.page ?? 1) - 1) * PAGE_SIZE]),
      pool.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total
           FROM ticketug.event e JOIN ticketug.organizer org ON org.id = e.organizer_id
          WHERE ${where.join(' AND ')}`,
        [term, lifecycle, publication]),
    ])
    return { rows: rows.rows, total: count.rows[0]?.total ?? 0 }
  } catch (error) {
    logServerError('platform:events-list', error)
    return null
  }
}

export type PlatformEventDetail = {
  event: PlatformEventRow & { description: string; timezone: string; discoverable: boolean; createdAt: string }
  ticketTypes: Array<{ id: string; publicId: string; name: string; priceMinorUnits: string; currency: string; capacity: number; remainingCapacity: number; active: boolean; ticketsIssued: number }>
  gates: Array<{ id: string; name: string; isActive: boolean; ticketTypeCount: number }>
  staff: Array<{ id: string; profileId: string; displayName: string; email: string | null; status: string; gateName: string | null }>
  orders: Array<{ publicId: string; orderNumber: string; purchaserEmail: string; paymentState: string; totalMinorUnits: string; createdAt: string }>
  checkIns: Array<{ ticketPublicId: string; checkedInAt: string; scannerName: string }>
  sales: { paidOrderCount: number; paidRevenueMinor: number; ticketsIssued: number; checkedIn: number } | null
} | null

export async function loadPlatformEventDetail(publicId: string): Promise<PlatformEventDetail> {
  try {
    const eventResult = await pool.query<NonNullable<PlatformEventDetail>['event']>(
      `SELECT e.id, e.public_id AS "publicId", e.title, e.slug, org.name AS "organizerName",
              org.id AS "organizerId", v.name AS "venueName", e.publication_state AS "publicationState",
              e.lifecycle_state AS "lifecycleState", e.starts_at AS "startsAt", e.ends_at AS "endsAt",
              e.description, e.timezone, e.discoverable, e.created_at AS "createdAt",
              (SELECT COUNT(*)::int FROM ticketug.ticket_type tt WHERE tt.event_id = e.id) AS "ticketTypeCount",
              (SELECT COUNT(*)::int FROM ticketug.ticket t WHERE t.event_id = e.id) AS "ticketsIssued"
         FROM ticketug.event e
         JOIN ticketug.organizer org ON org.id = e.organizer_id
         LEFT JOIN ticketug.venue v ON v.id = e.venue_id
        WHERE e.public_id = $1`, [publicId])
    const event = eventResult.rows[0]
    if (!event) return null

    const [ticketTypes, gates, staff, orders, checkIns, sales] = await Promise.all([
      pool.query<NonNullable<PlatformEventDetail>['ticketTypes'][number]>(
        `SELECT tt.id, tt.public_id AS "publicId", tt.name, tt.price_minor_units AS "priceMinorUnits", tt.currency,
                tt.capacity, tt.remaining_capacity AS "remainingCapacity", tt.active,
                (SELECT COUNT(*)::int FROM ticketug.ticket t WHERE t.ticket_type_id = tt.id) AS "ticketsIssued"
           FROM ticketug.ticket_type tt WHERE tt.event_id = $1 ORDER BY tt.sort_order, tt.created_at`, [event.id]),
      pool.query<NonNullable<PlatformEventDetail>['gates'][number]>(
        `SELECT g.id, g.name, g.is_active AS "isActive",
                (SELECT COUNT(*)::int FROM ticketug.ticket_type_gate ttg WHERE ttg.gate_id = g.id) AS "ticketTypeCount"
           FROM ticketug.event_gate g WHERE g.event_id = $1 ORDER BY g.created_at`, [event.id]),
      pool.query<NonNullable<PlatformEventDetail>['staff'][number]>(
        `SELECT esa.id, p.id AS "profileId", p.display_name AS "displayName", u.email, esa.status, g.name AS "gateName"
           FROM ticketug.event_staff_assignment esa
           JOIN ticketug.user_profile p ON p.id = esa.user_profile_id
           LEFT JOIN auth.users u ON u.id::text = p.auth_user_id
           LEFT JOIN ticketug.event_gate g ON g.id = esa.gate_id
          WHERE esa.event_id = $1 ORDER BY esa.created_at`, [event.id]),
      pool.query<NonNullable<PlatformEventDetail>['orders'][number]>(
        `SELECT o.public_id AS "publicId", o.order_number AS "orderNumber", o.purchaser_email AS "purchaserEmail",
                o.payment_state AS "paymentState", o.total_minor_units AS "totalMinorUnits", o.created_at AS "createdAt"
           FROM ticketug.order o
          WHERE EXISTS (SELECT 1 FROM ticketug.order_item oi
                          JOIN ticketug.ticket_type tt ON tt.id = oi.ticket_type_id
                         WHERE oi.order_id = o.id AND tt.event_id = $1)
          ORDER BY o.created_at DESC LIMIT 10`, [event.id]),
      pool.query<NonNullable<PlatformEventDetail>['checkIns'][number]>(
        `SELECT t.public_id AS "ticketPublicId", c.checked_in_at AS "checkedInAt", p.display_name AS "scannerName"
           FROM ticketug.check_in c
           JOIN ticketug.ticket t ON t.id = c.ticket_id
           LEFT JOIN ticketug.user_profile p ON p.id = c.scanner_profile_id
          WHERE c.event_id = $1 ORDER BY c.checked_in_at DESC LIMIT 10`, [event.id]),
      loadEventSalesMetrics(event.id).catch(() => null),
    ])

    return { event, ticketTypes: ticketTypes.rows, gates: gates.rows, staff: staff.rows, orders: orders.rows, checkIns: checkIns.rows, sales }
  } catch (error) {
    logServerError('platform:event-detail', error)
    return null
  }
}

/* ── Organizers ────────────────────────────────────────────────────────── */

export type PlatformOrganizerRow = {
  id: string
  name: string
  slug: string
  createdAt: string
  memberCount: number
  eventCount: number
  publicEvents: number
  paidOrders: number
  collectedMinor: string
}

export async function listPlatformOrganizers(filters: { q?: string; page?: number }): Promise<{ rows: PlatformOrganizerRow[]; total: number } | null> {
  const term = like(filters.q?.trim() ?? '')
  try {
    const [rows, count] = await Promise.all([
      pool.query<PlatformOrganizerRow>(
        `WITH order_events AS (
            SELECT DISTINCT oi.order_id, e.organizer_id
              FROM ticketug.order_item oi
              JOIN ticketug.ticket_type tt ON tt.id = oi.ticket_type_id
              JOIN ticketug.event e ON e.id = tt.event_id
         ),
         org_sales AS (
            SELECT oe.organizer_id,
                   COUNT(DISTINCT ord.id) FILTER (WHERE ord.payment_state = 'PAID')::int AS paid_orders,
                   COALESCE(SUM(p.amount_minor_units) FILTER (WHERE p.status = 'SUCCEEDED'), 0)::bigint AS collected_minor
              FROM order_events oe
              JOIN ticketug.order ord ON ord.id = oe.order_id
              JOIN ticketug.payment p ON p.order_id = ord.id
             GROUP BY oe.organizer_id
         )
         SELECT o.id, o.name, o.slug, o.created_at AS "createdAt",
                (SELECT COUNT(*)::int FROM ticketug.organizer_member m WHERE m.organizer_id = o.id AND m.status = 'ACTIVE') AS "memberCount",
                COALESCE(ev.events_all, 0)::int AS "eventCount",
                COALESCE(ev.events_public, 0)::int AS "publicEvents",
                COALESCE(s.paid_orders, 0)::int AS "paidOrders",
                COALESCE(s.collected_minor, 0)::text AS "collectedMinor"
           FROM ticketug.organizer o
           LEFT JOIN (SELECT organizer_id,
                             COUNT(*)::int AS events_all,
                             COUNT(*) FILTER (WHERE publication_state = 'PUBLIC')::int AS events_public
                        FROM ticketug.event GROUP BY organizer_id) ev ON ev.organizer_id = o.id
           LEFT JOIN org_sales s ON s.organizer_id = o.id
          WHERE ($1::text = '' OR o.name ILIKE $1 OR o.slug ILIKE $1)
          ORDER BY o.created_at DESC
          LIMIT $2 OFFSET $3`,
        [term, PAGE_SIZE, (Math.max(1, filters.page ?? 1) - 1) * PAGE_SIZE]),
      pool.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total FROM ticketug.organizer o WHERE ($1::text = '' OR o.name ILIKE $1 OR o.slug ILIKE $1)`, [term]),
    ])
    return { rows: rows.rows, total: count.rows[0]?.total ?? 0 }
  } catch (error) {
    logServerError('platform:organizers-list', error)
    return null
  }
}

export type PlatformOrganizerDetail = {
  organizer: { id: string; name: string; slug: string; createdAt: string; createdByEmail: string | null }
  members: Array<{ profileId: string; displayName: string; email: string | null; role: string; status: string; since: string }>
  invitations: Array<{ id: string; invitedEmail: string; role: string; status: string; expiresAt: string; createdAt: string }>
  events: Array<{ publicId: string; title: string; lifecycleState: string; publicationState: string; startsAt: string; ticketsIssued: number }>
  venues: Array<{ id: string; name: string; city: string | null; eventCount: number }>
} | null

export async function loadPlatformOrganizerDetail(organizerId: string): Promise<PlatformOrganizerDetail> {
  try {
    const organizerResult = await pool.query<NonNullable<PlatformOrganizerDetail>['organizer']>(
      `SELECT o.id, o.name, o.slug, o.created_at AS "createdAt", u.email AS "createdByEmail"
         FROM ticketug.organizer o
         LEFT JOIN ticketug.user_profile p ON p.id = o.created_by
         LEFT JOIN auth.users u ON u.id::text = p.auth_user_id
        WHERE o.id = $1`, [organizerId])
    const organizer = organizerResult.rows[0]
    if (!organizer) return null

    const [members, invitations, events, venues] = await Promise.all([
      pool.query<NonNullable<PlatformOrganizerDetail>['members'][number]>(
        `SELECT p.id AS "profileId", p.display_name AS "displayName", u.email, m.role, m.status, m.created_at AS "since"
           FROM ticketug.organizer_member m
           JOIN ticketug.user_profile p ON p.id = m.user_profile_id
           LEFT JOIN auth.users u ON u.id::text = p.auth_user_id
          WHERE m.organizer_id = $1 ORDER BY m.created_at`, [organizerId]),
      pool.query<NonNullable<PlatformOrganizerDetail>['invitations'][number]>(
        `SELECT id, invited_email AS "invitedEmail", role, status, expires_at AS "expiresAt", created_at AS "createdAt"
           FROM ticketug.organizer_invitation WHERE organizer_id = $1 ORDER BY created_at DESC LIMIT 20`, [organizerId]),
      pool.query<NonNullable<PlatformOrganizerDetail>['events'][number]>(
        `SELECT e.public_id AS "publicId", e.title, e.lifecycle_state AS "lifecycleState", e.publication_state AS "publicationState",
                e.starts_at AS "startsAt",
                (SELECT COUNT(*)::int FROM ticketug.ticket t WHERE t.event_id = e.id) AS "ticketsIssued"
           FROM ticketug.event e WHERE e.organizer_id = $1 ORDER BY e.starts_at DESC`, [organizerId]),
      pool.query<NonNullable<PlatformOrganizerDetail>['venues'][number]>(
        `SELECT v.id, v.name, v.city,
                (SELECT COUNT(*)::int FROM ticketug.event e WHERE e.venue_id = v.id) AS "eventCount"
           FROM ticketug.venue v WHERE v.organizer_id = $1 ORDER BY v.name`, [organizerId]),
    ])

    return { organizer, members: members.rows, invitations: invitations.rows, events: events.rows, venues: venues.rows }
  } catch (error) {
    logServerError('platform:organizer-detail', error)
    return null
  }
}

/* ── Users ─────────────────────────────────────────────────────────────── */

export type PlatformUserRow = {
  id: string
  displayName: string
  email: string | null
  emailConfirmed: boolean
  platformRoles: string[]
  organizerMemberships: number
  ordersCount: number
  ticketsCount: number
  createdAt: string
  lastSignInAt: string | null
}

export async function listPlatformUsers(filters: { q?: string; page?: number }): Promise<{ rows: PlatformUserRow[]; total: number } | null> {
  const term = like(filters.q?.trim() ?? '')
  try {
    const [rows, count] = await Promise.all([
      pool.query<PlatformUserRow>(
        `SELECT p.id, p.display_name AS "displayName", u.email,
                (u.email_confirmed_at IS NOT NULL) AS "emailConfirmed",
                COALESCE((SELECT ARRAY_AGG(pr.role ORDER BY pr.role) FROM ticketug.platform_role pr WHERE pr.user_profile_id = p.id), '{}') AS "platformRoles",
                (SELECT COUNT(*)::int FROM ticketug.organizer_member m WHERE m.user_profile_id = p.id AND m.status = 'ACTIVE') AS "organizerMemberships",
                (SELECT COUNT(*)::int FROM ticketug.order o WHERE o.user_profile_id = p.id) AS "ordersCount",
                (SELECT COUNT(*)::int FROM ticketug.ticket t WHERE t.owner_profile_id = p.id) AS "ticketsCount",
                p.created_at AS "createdAt", u.last_sign_in_at AS "lastSignInAt"
           FROM ticketug.user_profile p
           LEFT JOIN auth.users u ON u.id::text = p.auth_user_id
          WHERE ($1::text = '' OR p.display_name ILIKE $1 OR u.email ILIKE $1)
          ORDER BY p.created_at DESC
          LIMIT $2 OFFSET $3`,
        [term, PAGE_SIZE, (Math.max(1, filters.page ?? 1) - 1) * PAGE_SIZE]),
      pool.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total
           FROM ticketug.user_profile p
           LEFT JOIN auth.users u ON u.id::text = p.auth_user_id
          WHERE ($1::text = '' OR p.display_name ILIKE $1 OR u.email ILIKE $1)`, [term]),
    ])
    return { rows: rows.rows, total: count.rows[0]?.total ?? 0 }
  } catch (error) {
    logServerError('platform:users-list', error)
    return null
  }
}

export type PlatformUserDetail = {
  profile: { id: string; displayName: string; phone: string | null; createdAt: string; email: string | null; emailConfirmed: boolean; lastSignInAt: string | null; authCreatedAt: string | null; deliveryEmail: string | null; deliveryPhone: string | null }
  platformRoles: Array<{ role: string; grantedAt: string }>
  memberships: Array<{ organizerId: string; organizerName: string; role: string; status: string; since: string }>
  staffAssignments: Array<{ eventId: string; eventTitle: string; status: string; gateName: string | null }>
  orders: Array<{ publicId: string; orderNumber: string; paymentState: string; totalMinorUnits: string; createdAt: string }>
  tickets: Array<{ publicId: string; eventTitle: string; status: string; issuedAt: string; checkedInAt: string | null }>
  checkIns: Array<{ eventTitle: string; checkedInAt: string }>
  audit: Array<{ eventType: string; createdAt: string }>
} | null

export async function loadPlatformUserDetail(profileId: string): Promise<PlatformUserDetail> {
  try {
    const profileResult = await pool.query<NonNullable<PlatformUserDetail>['profile']>(
      `SELECT p.id, p.display_name AS "displayName", p.phone, p.created_at AS "createdAt",
              u.email, (u.email_confirmed_at IS NOT NULL) AS "emailConfirmed", u.last_sign_in_at AS "lastSignInAt",
              u.created_at AS "authCreatedAt",
              ap.delivery_email AS "deliveryEmail", ap.delivery_phone AS "deliveryPhone"
         FROM ticketug.user_profile p
         LEFT JOIN auth.users u ON u.id::text = p.auth_user_id
         LEFT JOIN ticketug.attendee_profile ap ON ap.user_profile_id = p.id
        WHERE p.id = $1`, [profileId])
    const profile = profileResult.rows[0]
    if (!profile) return null

    const [roles, memberships, staff, orders, tickets, checkIns, audit] = await Promise.all([
      pool.query<NonNullable<PlatformUserDetail>['platformRoles'][number]>(
        `SELECT role, created_at AS "grantedAt" FROM ticketug.platform_role WHERE user_profile_id = $1 ORDER BY created_at`, [profileId]),
      pool.query<NonNullable<PlatformUserDetail>['memberships'][number]>(
        `SELECT o.id AS "organizerId", o.name AS "organizerName", m.role, m.status, m.created_at AS "since"
           FROM ticketug.organizer_member m JOIN ticketug.organizer o ON o.id = m.organizer_id
          WHERE m.user_profile_id = $1 ORDER BY m.created_at`, [profileId]),
      pool.query<NonNullable<PlatformUserDetail>['staffAssignments'][number]>(
        `SELECT e.id AS "eventId", e.title AS "eventTitle", esa.status, g.name AS "gateName"
           FROM ticketug.event_staff_assignment esa
           JOIN ticketug.event e ON e.id = esa.event_id
           LEFT JOIN ticketug.event_gate g ON g.id = esa.gate_id
          WHERE esa.user_profile_id = $1 ORDER BY esa.created_at DESC LIMIT 20`, [profileId]),
      pool.query<NonNullable<PlatformUserDetail>['orders'][number]>(
        `SELECT public_id AS "publicId", order_number AS "orderNumber", payment_state AS "paymentState",
                total_minor_units AS "totalMinorUnits", created_at AS "createdAt"
           FROM ticketug.order WHERE user_profile_id = $1 ORDER BY created_at DESC LIMIT 20`, [profileId]),
      pool.query<NonNullable<PlatformUserDetail>['tickets'][number]>(
        `SELECT t.public_id AS "publicId", t.event_title_snapshot AS "eventTitle", t.status,
                t.issued_at AS "issuedAt", t.checked_in_at AS "checkedInAt"
           FROM ticketug.ticket t WHERE t.owner_profile_id = $1 ORDER BY t.issued_at DESC LIMIT 20`, [profileId]),
      pool.query<NonNullable<PlatformUserDetail>['checkIns'][number]>(
        `SELECT e.title AS "eventTitle", c.checked_in_at AS "checkedInAt"
           FROM ticketug.check_in c JOIN ticketug.event e ON e.id = c.event_id
          WHERE c.scanner_profile_id = $1 ORDER BY c.checked_in_at DESC LIMIT 20`, [profileId]),
      pool.query<NonNullable<PlatformUserDetail>['audit'][number]>(
        `SELECT event_type AS "eventType", created_at AS "createdAt"
           FROM ticketug.security_event WHERE user_profile_id = $1 ORDER BY created_at DESC LIMIT 20`, [profileId]),
    ])

    return { profile, platformRoles: roles.rows, memberships: memberships.rows, staffAssignments: staff.rows, orders: orders.rows, tickets: tickets.rows, checkIns: checkIns.rows, audit: audit.rows }
  } catch (error) {
    logServerError('platform:user-detail', error)
    return null
  }
}

/* ── Orders ────────────────────────────────────────────────────────────── */

export const ORDER_PAYMENT_STATES = ['AWAITING_PAYMENT', 'PAYMENT_PROCESSING', 'PAID', 'CANCELLED', 'EXPIRED'] as const

export type PlatformOrderRow = {
  id: string
  publicId: string
  orderNumber: string
  purchaserEmail: string
  purchaserName: string
  isGuest: boolean
  paymentState: string
  currency: string
  totalMinorUnits: string
  ticketsCount: number
  paymentStatus: string | null
  paymentExpiresAt: string | null
  createdAt: string
}

export async function listPlatformOrders(filters: { q?: string; state?: string; page?: number }): Promise<{ rows: PlatformOrderRow[]; total: number } | null> {
  const term = like(filters.q?.trim() ?? '')
  const state = ORDER_PAYMENT_STATES.find((candidate) => candidate === filters.state) ?? null
  const where = [`($1::text = '' OR o.order_number ILIKE $1 OR o.purchaser_email ILIKE $1 OR o.public_id ILIKE $1)`,
    `($2::text IS NULL OR o.payment_state = $2)`]
  try {
    const [rows, count] = await Promise.all([
      pool.query<PlatformOrderRow>(
        `SELECT o.id, o.public_id AS "publicId", o.order_number AS "orderNumber", o.purchaser_email AS "purchaserEmail",
                o.purchaser_name AS "purchaserName", (o.user_profile_id IS NULL) AS "isGuest",
                o.payment_state AS "paymentState", o.currency, o.total_minor_units AS "totalMinorUnits",
                (SELECT COUNT(*)::int FROM ticketug.ticket t WHERE t.order_id = o.id) AS "ticketsCount",
                p.status AS "paymentStatus", o.payment_expires_at AS "paymentExpiresAt", o.created_at AS "createdAt"
           FROM ticketug.order o
           LEFT JOIN ticketug.payment p ON p.order_id = o.id
          WHERE ${where.join(' AND ')}
          ORDER BY o.created_at DESC
          LIMIT $3 OFFSET $4`,
        [term, state, PAGE_SIZE, (Math.max(1, filters.page ?? 1) - 1) * PAGE_SIZE]),
      pool.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total FROM ticketug.order o WHERE ${where.join(' AND ')}`, [term, state]),
    ])
    return { rows: rows.rows, total: count.rows[0]?.total ?? 0 }
  } catch (error) {
    logServerError('platform:orders-list', error)
    return null
  }
}

export type PlatformOrderDetail = {
  order: { id: string; publicId: string; orderNumber: string; purchaserName: string; purchaserEmail: string; purchaserPhone: string | null; isGuest: boolean; buyerEmail: string | null; status: string; paymentState: string; currency: string; totalMinorUnits: string; paymentExpiresAt: string | null; createdAt: string; updatedAt: string; cancelledAt: string | null }
  items: Array<{ ticketTypeName: string; quantity: number; unitPriceMinorUnits: string; lineTotalMinorUnits: string; eventTitle: string; eventPublicId: string }>
  payment: { publicId: string; provider: string; status: string; amountMinorUnits: string; providerCustomerReference: string | null; successfulProviderReference: string | null; failureCode: string | null; failureMessage: string | null; createdAt: string; succeededAt: string | null; failedAt: string | null } | null
  attempts: Array<{ publicId: string; provider: string; status: string; providerAttemptReference: string | null; amountMinorUnits: string; initiatedAt: string; completedAt: string | null; failureCode: string | null }>
  tickets: Array<{ publicId: string; attendeeName: string; status: string; unitNumber: number; ticketTypeName: string; issuedAt: string; checkedInAt: string | null }>
  issuance: Array<{ status: string; providerReference: string; ticketCount: number; errorCode: string | null; createdAt: string; completedAt: string | null }>
} | null

export async function loadPlatformOrderDetail(publicId: string): Promise<PlatformOrderDetail> {
  try {
    const orderResult = await pool.query<NonNullable<PlatformOrderDetail>['order']>(
      `SELECT o.id, o.public_id AS "publicId", o.order_number AS "orderNumber", o.purchaser_name AS "purchaserName",
              o.purchaser_email AS "purchaserEmail", o.purchaser_phone AS "purchaserPhone",
              (o.user_profile_id IS NULL) AS "isGuest", u.email AS "buyerEmail",
              o.status, o.payment_state AS "paymentState", o.currency, o.total_minor_units AS "totalMinorUnits",
              o.payment_expires_at AS "paymentExpiresAt", o.created_at AS "createdAt", o.updated_at AS "updatedAt",
              o.cancelled_at AS "cancelledAt"
         FROM ticketug.order o
         LEFT JOIN ticketug.user_profile p ON p.id = o.user_profile_id
         LEFT JOIN auth.users u ON u.id::text = p.auth_user_id
        WHERE o.public_id = $1`, [publicId])
    const order = orderResult.rows[0]
    if (!order) return null

    const [items, paymentResult, attempts, tickets, issuance] = await Promise.all([
      pool.query<NonNullable<PlatformOrderDetail>['items'][number]>(
        `SELECT oi.ticket_name_snapshot AS "ticketTypeName", oi.quantity, oi.unit_price_minor_units AS "unitPriceMinorUnits",
                oi.line_total_minor_units AS "lineTotalMinorUnits", e.title AS "eventTitle", e.public_id AS "eventPublicId"
           FROM ticketug.order_item oi
           JOIN ticketug.ticket_type tt ON tt.id = oi.ticket_type_id
           JOIN ticketug.event e ON e.id = tt.event_id
          WHERE oi.order_id = $1 ORDER BY oi.created_at`, [order.id]),
      pool.query<NonNullable<NonNullable<PlatformOrderDetail>['payment']>>(
        `SELECT public_id AS "publicId", provider, status, amount_minor_units AS "amountMinorUnits",
                provider_customer_reference AS "providerCustomerReference",
                successful_provider_reference AS "successfulProviderReference",
                failure_code AS "failureCode", failure_message AS "failureMessage",
                created_at AS "createdAt", succeeded_at AS "succeededAt", failed_at AS "failedAt"
           FROM ticketug.payment WHERE order_id = $1`, [order.id]),
      pool.query<NonNullable<PlatformOrderDetail>['attempts'][number]>(
        `SELECT pa.public_id AS "publicId", pa.provider, pa.status, pa.provider_attempt_reference AS "providerAttemptReference",
                pa.amount_minor_units AS "amountMinorUnits", pa.initiated_at AS "initiatedAt",
                pa.completed_at AS "completedAt", pa.failure_code AS "failureCode"
           FROM ticketug.payment_attempt pa JOIN ticketug.payment p ON p.id = pa.payment_id
          WHERE p.order_id = $1 ORDER BY pa.initiated_at DESC`, [order.id]),
      pool.query<NonNullable<PlatformOrderDetail>['tickets'][number]>(
        `SELECT t.public_id AS "publicId", t.attendee_name AS "attendeeName", t.status, t.unit_number AS "unitNumber",
                t.ticket_type_name_snapshot AS "ticketTypeName", t.issued_at AS "issuedAt", t.checked_in_at AS "checkedInAt"
           FROM ticketug.ticket t WHERE t.order_id = $1 ORDER BY t.unit_number`, [order.id]),
      pool.query<NonNullable<PlatformOrderDetail>['issuance'][number]>(
        `SELECT tie.status, tie.provider_reference AS "providerReference", tie.ticket_count AS "ticketCount",
                tie.error_code AS "errorCode", tie.created_at AS "createdAt", tie.completed_at AS "completedAt"
           FROM ticketug.ticket_issuance_event tie JOIN ticketug.order o ON o.id = tie.order_id
          WHERE o.public_id = $1 ORDER BY tie.created_at DESC`, [publicId]),
    ])

    return { order, items: items.rows, payment: paymentResult.rows[0] ?? null, attempts: attempts.rows, tickets: tickets.rows, issuance: issuance.rows }
  } catch (error) {
    logServerError('platform:order-detail', error)
    return null
  }
}

/* ── Payments & webhooks ───────────────────────────────────────────────── */

export const PAYMENT_STATUSES = ['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED'] as const
export const WEBHOOK_STATUSES = ['RECEIVED', 'PROCESSED', 'DUPLICATE', 'REJECTED', 'FAILED'] as const

export type PlatformPaymentRow = {
  publicId: string
  provider: string
  status: string
  amountMinorUnits: string
  currency: string
  orderNumber: string
  orderPublicId: string
  orderPaymentState: string
  attemptCount: number
  successfulProviderReference: string | null
  updatedAt: string
}

export async function listPlatformPayments(filters: { status?: string; page?: number }): Promise<{ rows: PlatformPaymentRow[]; total: number } | null> {
  const status = PAYMENT_STATUSES.find((candidate) => candidate === filters.status) ?? null
  try {
    const [rows, count] = await Promise.all([
      pool.query<PlatformPaymentRow>(
        `SELECT p.public_id AS "publicId", p.provider, p.status, p.amount_minor_units AS "amountMinorUnits", p.currency,
                o.order_number AS "orderNumber", o.public_id AS "orderPublicId", o.payment_state AS "orderPaymentState",
                (SELECT COUNT(*)::int FROM ticketug.payment_attempt pa WHERE pa.payment_id = p.id) AS "attemptCount",
                p.successful_provider_reference AS "successfulProviderReference", p.updated_at AS "updatedAt"
           FROM ticketug.payment p JOIN ticketug.order o ON o.id = p.order_id
          WHERE ($1::text IS NULL OR p.status = $1)
          ORDER BY p.updated_at DESC
          LIMIT $2 OFFSET $3`,
        [status, PAGE_SIZE, (Math.max(1, filters.page ?? 1) - 1) * PAGE_SIZE]),
      pool.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total FROM ticketug.payment WHERE ($1::text IS NULL OR status = $1)`, [status]),
    ])
    return { rows: rows.rows, total: count.rows[0]?.total ?? 0 }
  } catch (error) {
    logServerError('platform:payments-list', error)
    return null
  }
}

export type PlatformWebhookRow = {
  id: string
  provider: string
  providerEventId: string
  eventType: string
  receivedAt: string
  signatureVerified: boolean
  processingStatus: string
  processedAt: string | null
  providerReference: string | null
  failureMessage: string | null
}

export async function listPlatformWebhooks(filters: { status?: string; page?: number }): Promise<{ rows: PlatformWebhookRow[]; total: number } | null> {
  const status = WEBHOOK_STATUSES.find((candidate) => candidate === filters.status) ?? null
  try {
    const [rows, count] = await Promise.all([
      pool.query<PlatformWebhookRow>(
        `SELECT id, provider, provider_event_id AS "providerEventId", event_type AS "eventType",
                received_at AS "receivedAt", signature_verified AS "signatureVerified",
                processing_status AS "processingStatus", processed_at AS "processedAt",
                provider_reference AS "providerReference", failure_message AS "failureMessage"
           FROM ticketug.webhook_event
          WHERE ($1::text IS NULL OR processing_status = $1)
          ORDER BY received_at DESC
          LIMIT $2 OFFSET $3`,
        [status, PAGE_SIZE, (Math.max(1, filters.page ?? 1) - 1) * PAGE_SIZE]),
      pool.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total FROM ticketug.webhook_event WHERE ($1::text IS NULL OR processing_status = $1)`, [status]),
    ])
    return { rows: rows.rows, total: count.rows[0]?.total ?? 0 }
  } catch (error) {
    logServerError('platform:webhooks-list', error)
    return null
  }
}

/* ── Tickets ───────────────────────────────────────────────────────────── */

export const TICKET_STATUSES = ['ISSUED', 'CHECKED_IN', 'CANCELLED', 'REFUNDED', 'VOID'] as const

export type PlatformTicketRow = {
  publicId: string
  attendeeName: string
  attendeeEmail: string
  status: string
  ticketTypeName: string
  eventTitle: string
  eventPublicId: string
  orderNumber: string
  orderPublicId: string
  issuedAt: string
  checkedInAt: string | null
}

export async function listPlatformTickets(filters: { q?: string; status?: string; page?: number }): Promise<{ rows: PlatformTicketRow[]; total: number } | null> {
  const term = like(filters.q?.trim() ?? '')
  const status = TICKET_STATUSES.find((candidate) => candidate === filters.status) ?? null
  const where = [`($1::text = '' OR t.public_id ILIKE $1 OR t.attendee_name ILIKE $1 OR t.attendee_email ILIKE $1 OR o.order_number ILIKE $1)`,
    `($2::text IS NULL OR t.status = $2)`]
  try {
    const [rows, count] = await Promise.all([
      pool.query<PlatformTicketRow>(
        `SELECT t.public_id AS "publicId", t.attendee_name AS "attendeeName", t.attendee_email AS "attendeeEmail",
                t.status, t.ticket_type_name_snapshot AS "ticketTypeName", t.event_title_snapshot AS "eventTitle",
                e.public_id AS "eventPublicId", o.order_number AS "orderNumber", o.public_id AS "orderPublicId",
                t.issued_at AS "issuedAt", t.checked_in_at AS "checkedInAt"
           FROM ticketug.ticket t
           JOIN ticketug.order o ON o.id = t.order_id
           JOIN ticketug.event e ON e.id = t.event_id
          WHERE ${where.join(' AND ')}
          ORDER BY t.issued_at DESC
          LIMIT $3 OFFSET $4`,
        [term, status, PAGE_SIZE, (Math.max(1, filters.page ?? 1) - 1) * PAGE_SIZE]),
      pool.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total
           FROM ticketug.ticket t JOIN ticketug.order o ON o.id = t.order_id
          WHERE ${where.join(' AND ')}`, [term, status]),
    ])
    return { rows: rows.rows, total: count.rows[0]?.total ?? 0 }
  } catch (error) {
    logServerError('platform:tickets-list', error)
    return null
  }
}

/* ── Check-ins ─────────────────────────────────────────────────────────── */

export type CheckInEventSummary = {
  eventId: string
  eventPublicId: string
  eventTitle: string
  organizerName: string
  startsAt: string
  ticketsIssued: number
  checkedIn: number
  lastCheckInAt: string | null
}

export type CheckInScan = { ticketPublicId: string; eventTitle: string; scannerName: string; checkedInAt: string }
export type CheckInScanner = { profileId: string; scannerName: string; scans: number; lastScanAt: string | null }

export async function loadCheckInOverview(): Promise<{ perEvent: CheckInEventSummary[]; recent: CheckInScan[]; scanners: CheckInScanner[] } | null> {
  try {
    const [perEvent, recent, scanners] = await Promise.all([
      pool.query<CheckInEventSummary>(
        `SELECT e.id AS "eventId", e.public_id AS "eventPublicId", e.title AS "eventTitle",
                org.name AS "organizerName", e.starts_at AS "startsAt",
                (SELECT COUNT(*)::int FROM ticketug.ticket t WHERE t.event_id = e.id) AS "ticketsIssued",
                (SELECT COUNT(*)::int FROM ticketug.check_in c WHERE c.event_id = e.id) AS "checkedIn",
                (SELECT MAX(c.checked_in_at) FROM ticketug.check_in c WHERE c.event_id = e.id) AS "lastCheckInAt"
           FROM ticketug.event e JOIN ticketug.organizer org ON org.id = e.organizer_id
          WHERE EXISTS (SELECT 1 FROM ticketug.check_in c WHERE c.event_id = e.id)
          ORDER BY "lastCheckInAt" DESC NULLS LAST LIMIT 15`),
      pool.query<CheckInScan>(
        `SELECT t.public_id AS "ticketPublicId", e.title AS "eventTitle", p.display_name AS "scannerName",
                c.checked_in_at AS "checkedInAt"
           FROM ticketug.check_in c
           JOIN ticketug.ticket t ON t.id = c.ticket_id
           JOIN ticketug.event e ON e.id = c.event_id
           LEFT JOIN ticketug.user_profile p ON p.id = c.scanner_profile_id
          ORDER BY c.checked_in_at DESC LIMIT 15`),
      pool.query<CheckInScanner>(
        `SELECT p.id AS "profileId", COALESCE(NULLIF(p.display_name, ''), u.email) AS "scannerName",
                COUNT(*)::int AS scans, MAX(c.checked_in_at) AS "lastScanAt"
           FROM ticketug.check_in c
           JOIN ticketug.user_profile p ON p.id = c.scanner_profile_id
           LEFT JOIN auth.users u ON u.id::text = p.auth_user_id
          GROUP BY p.id, p.display_name, u.email
          ORDER BY scans DESC LIMIT 10`),
    ])
    return { perEvent: perEvent.rows, recent: recent.rows, scanners: scanners.rows }
  } catch (error) {
    logServerError('platform:check-ins', error)
    return null
  }
}

/* ── Audit stream ──────────────────────────────────────────────────────── */

export type PlatformAuditRow = {
  id: string
  eventType: string
  createdAt: string
  actorName: string | null
  actorEmail: string | null
  actorProfileId: string | null
}

export async function listPlatformAudit(filters: { eventType?: string; page?: number }): Promise<{ rows: PlatformAuditRow[]; total: number; knownTypes: string[] } | null> {
  const eventType = filters.eventType?.trim() ?? ''
  try {
    const [rows, count, types] = await Promise.all([
      pool.query<PlatformAuditRow>(
        `SELECT se.id, se.event_type AS "eventType", se.created_at AS "createdAt",
                p.display_name AS "actorName", u.email AS "actorEmail", p.id AS "actorProfileId"
           FROM ticketug.security_event se
           LEFT JOIN ticketug.user_profile p ON p.id = se.user_profile_id
           LEFT JOIN auth.users u ON u.id::text = p.auth_user_id
          WHERE ($1::text = '' OR se.event_type = $1)
          ORDER BY se.created_at DESC
          LIMIT $2 OFFSET $3`,
        [eventType, PAGE_SIZE, (Math.max(1, filters.page ?? 1) - 1) * PAGE_SIZE]),
      pool.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total FROM ticketug.security_event WHERE ($1::text = '' OR event_type = $1)`, [eventType]),
      pool.query<{ event_type: string }>(
        `SELECT DISTINCT event_type FROM ticketug.security_event ORDER BY event_type`),
    ])
    return { rows: rows.rows, total: count.rows[0]?.total ?? 0, knownTypes: types.rows.map((row) => row.event_type) }
  } catch (error) {
    logServerError('platform:audit-list', error)
    return null
  }
}

/* ── System status ─────────────────────────────────────────────────────── */

export type SystemStatus = {
  database: { reachable: boolean; latencyMs: number | null; serverTime: string | null }
  auth: { configured: boolean }
  payment: { selectedProvider: 'nylonpay' | 'test' | null; nylonpayConfigured: boolean; webhookSecretConfigured: boolean }
  cron: { secretConfigured: boolean }
  siteUrlConfigured: boolean
}

export async function loadSystemStatus(): Promise<SystemStatus> {
  let database = { reachable: false, latencyMs: null as number | null, serverTime: null as string | null }
  const startedAt = Date.now()
  try {
    const result = await pool.query<{ now: string }>('SELECT now()::text AS now')
    database = { reachable: true, latencyMs: Date.now() - startedAt, serverTime: result.rows[0]?.now ?? null }
  } catch (error) {
    logServerError('platform:system-status', error)
  }

  const nylonpayConfigured = Boolean(process.env.NYLONPAY_API_KEY && process.env.NYLONPAY_API_SECRET)
  const selected = process.env.PAYMENT_PROVIDER?.trim()

  return {
    database,
    auth: { configured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) },
    payment: {
      selectedProvider: selected === 'nylonpay' ? 'nylonpay' : selected === 'test' && process.env.NODE_ENV !== 'production' ? 'test' : null,
      nylonpayConfigured,
      webhookSecretConfigured: Boolean(process.env.NYLONPAY_WEBHOOK_SECRET),
    },
    cron: { secretConfigured: Boolean(process.env.CRON_SECRET) },
    siteUrlConfigured: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
  }
}

/** Orders the expiry sweep would target right now (deployment wiring signal). */
export async function countExpirableOrders(): Promise<number | null> {
  try {
    const result = await pool.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM ticketug.order
       WHERE payment_state = 'AWAITING_PAYMENT'
         AND payment_expires_at IS NOT NULL AND payment_expires_at <= now()`)
    return result.rows[0]?.total ?? 0
  } catch (error) {
    logServerError('platform:expirable-count', error)
    return null
  }
}
