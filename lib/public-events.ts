import { pool } from './db'

// Single source of truth for public event visibility. The public detail page,
// the /events discovery index, and the landing-page listing all filter through
// this predicate — never define a second visibility rule elsewhere.
//
// Lifecycle note (rules now live in lib/rules/event-lifecycle.ts):
// CANCELLED/SUSPENDED events keep publication_state='PUBLIC' and discoverable=true
// by design, and the public detail page intentionally renders them with a status
// notice. The listing therefore shows the same events with their lifecycle label
// instead of inventing a stricter, contradictory discovery rule.
export const PUBLIC_EVENT_VISIBILITY_SQL = `e.publication_state = 'PUBLIC' AND e.discoverable = true`

export type PublicEventListParams = { search?: string | null; page?: number | null; pageSize?: number }

export type ResolvedListParams = { search: string | null; page: number; pageSize: number; offset: number }

export function resolveListParams(params: PublicEventListParams): ResolvedListParams {
  const rawSearch = typeof params.search === 'string' ? params.search.trim() : ''
  const search = rawSearch ? rawSearch.slice(0, 120) : null
  const parsedPage = Math.floor(Number(params.page ?? 1))
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.min(parsedPage, 10_000) : 1
  const parsedSize = Math.floor(Number(params.pageSize ?? 12))
  const pageSize = Number.isFinite(parsedSize) && parsedSize > 0 ? Math.min(parsedSize, 48) : 12
  return { search, page, pageSize, offset: (page - 1) * pageSize }
}

export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`)
}

export type EventAvailability = { label: string; cta: boolean }

/**
 * Event-level availability label. Mirrors the public detail page semantics:
 * the checkout CTA only ever appears for SALES_OPEN events with remaining
 * capacity and at least one on-sale ticket type.
 */
export function summarizeEventAvailability(input: { lifecycleState: string; hasTicketTypes: boolean; ticketsRemaining: number; anyOnSale: boolean; anyUpcomingSale: boolean }): EventAvailability {
  if (input.lifecycleState === 'CANCELLED') return { label: 'Cancelled', cta: false }
  if (!input.hasTicketTypes) return { label: 'Ticket details coming soon', cta: false }
  if (input.lifecycleState !== 'SALES_OPEN') return { label: input.anyUpcomingSale ? 'Sales opening soon' : 'Sales closed', cta: false }
  if (input.ticketsRemaining <= 0) return { label: 'Sold out', cta: false }
  if (input.anyOnSale) return { label: 'Tickets available', cta: true }
  if (input.anyUpcomingSale) return { label: 'Sales opening soon', cta: false }
  return { label: 'Sales closed', cta: false }
}

export type PublicEventCard = {
  publicId: string
  slug: string
  title: string
  description: string
  startsAt: string
  endsAt: string
  timezone: string
  lifecycleState: string
  venueName: string | null
  venueCity: string | null
  imageUrl: string | null
  imageAlt: string | null
  ticketsRemaining: number
  hasTicketTypes: boolean
  minPriceMinorUnits: number | null
  currency: string | null
  availability: EventAvailability
}

export type PublicEventCardRow = {
  public_id: string
  slug: string
  title: string
  description: string
  starts_at: string
  ends_at: string
  timezone: string
  lifecycle_state: string
  venue_name: string | null
  venue_city: string | null
  media_url: string | null
  media_alt: string | null
  tickets_remaining: string | null
  ticket_type_count: string
  min_price_minor_units: string | null
  currency: string | null
  any_on_sale: boolean | null
  any_upcoming_sale: boolean | null
}

// Maps a raw list row to the public DTO. Internal fields (organizer_id,
// publication_state, internal ids, moderation data) are deliberately absent —
// the mapper defines exactly what may leave the server.
export function mapPublicEventRow(row: PublicEventCardRow): PublicEventCard {
  const hasTicketTypes = Number(row.ticket_type_count) > 0
  const ticketsRemaining = Number(row.tickets_remaining ?? 0)
  return {
    publicId: row.public_id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    timezone: row.timezone,
    lifecycleState: row.lifecycle_state,
    venueName: row.venue_name,
    venueCity: row.venue_city,
    imageUrl: row.media_url,
    imageAlt: row.media_alt || row.title,
    ticketsRemaining,
    hasTicketTypes,
    minPriceMinorUnits: row.min_price_minor_units === null ? null : Number(row.min_price_minor_units),
    currency: row.currency,
    availability: summarizeEventAvailability({
      lifecycleState: row.lifecycle_state,
      hasTicketTypes,
      ticketsRemaining,
      anyOnSale: row.any_on_sale === true,
      anyUpcomingSale: row.any_upcoming_sale === true,
    }),
  }
}

const LIST_SELECT = `SELECT e.public_id, e.slug, e.title, e.description, e.starts_at, e.ends_at, e.timezone, e.lifecycle_state,
         v.name AS venue_name, v.city AS venue_city,
         (SELECT em.url FROM ticketug.event_media em WHERE em.event_id = e.id AND em.media_type = 'IMAGE' ORDER BY em.sort_order, em.created_at LIMIT 1) AS media_url,
         (SELECT em.alt_text FROM ticketug.event_media em WHERE em.event_id = e.id AND em.media_type = 'IMAGE' ORDER BY em.sort_order, em.created_at LIMIT 1) AS media_alt,
         COALESCE(SUM(t.remaining_capacity) FILTER (WHERE t.active), 0) AS tickets_remaining,
         COUNT(t.id) FILTER (WHERE t.active) AS ticket_type_count,
         MIN(t.price_minor_units) FILTER (WHERE t.active) AS min_price_minor_units,
         (ARRAY_AGG(t.currency) FILTER (WHERE t.active))[1] AS currency,
         BOOL_OR(t.active AND (t.sale_starts_at IS NULL OR t.sale_starts_at <= now()) AND (t.sale_ends_at IS NULL OR t.sale_ends_at > now())) AS any_on_sale,
         BOOL_OR(t.active AND t.sale_starts_at IS NOT NULL AND t.sale_starts_at > now()) AS any_upcoming_sale,
         COUNT(*) OVER() AS total_count
    FROM ticketug.event e
    LEFT JOIN ticketug.venue v ON v.id = e.venue_id
    LEFT JOIN ticketug.ticket_type t ON t.event_id = e.id
   WHERE ${PUBLIC_EVENT_VISIBILITY_SQL}`

// Deterministic ordering: on-sale events first, then soonest start, then id as a
// stable tiebreaker. COUNT(*) OVER() feeds pagination-safe totals in one query.
export type PublicEventListResult = { events: PublicEventCard[]; total: number; page: number; pageSize: number; pageCount: number }

export async function listPublicEvents(params: PublicEventListParams = {}): Promise<PublicEventListResult> {
  const resolved = resolveListParams(params)
  const searchClause = resolved.search ? ' AND (e.title ILIKE $1 OR e.description ILIKE $1)' : ''
  const tail = ` GROUP BY e.id, v.name, v.city ORDER BY (e.lifecycle_state = 'SALES_OPEN') DESC, e.starts_at ASC, e.id ASC LIMIT $${resolved.search ? 2 : 1} OFFSET $${resolved.search ? 3 : 2}`
  const values = resolved.search
    ? [`%${escapeLikePattern(resolved.search)}%`, resolved.pageSize, resolved.offset]
    : [resolved.pageSize, resolved.offset]
  const result = await pool.query<PublicEventCardRow & { total_count: string }>(LIST_SELECT + searchClause + tail, values)
  const total = Number(result.rows[0]?.total_count ?? 0)
  return {
    events: result.rows.map(mapPublicEventRow),
    total,
    page: resolved.page,
    pageSize: resolved.pageSize,
    pageCount: Math.max(Math.ceil(total / resolved.pageSize), 1),
  }
}

// Landing-page listing: same architecture, first page only.
export async function getUpcomingPublicEvents(limit = 6): Promise<PublicEventCard[]> {
  const result = await listPublicEvents({ page: 1, pageSize: Math.min(Math.max(limit, 1), 48) })
  return result.events
}
