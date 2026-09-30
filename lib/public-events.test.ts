import { describe, expect, it } from 'vitest'
import { resolveWhenRange } from './event-categories'
import { buildPublicEventListQuery, escapeLikePattern, mapPublicEventRow, resolveListParams, summarizeEventAvailability, type PublicEventCardRow } from './public-events'

describe('resolveListParams', () => {
  it('defaults to page 1 with pageSize 12, no search, no filters and trending sort', () => {
    expect(resolveListParams({})).toEqual({ search: null, keywords: [], startsFrom: null, startsTo: null, sort: 'trending', page: 1, pageSize: 12, offset: 0 })
  })

  it('clamps invalid, zero and negative pages back to page 1', () => {
    expect(resolveListParams({ page: 0 }).page).toBe(1)
    expect(resolveListParams({ page: -3 }).page).toBe(1)
    expect(resolveListParams({ page: Number.NaN }).page).toBe(1)
  })

  it('computes the deterministic offset for later pages', () => {
    expect(resolveListParams({ page: 3, pageSize: 12 }).offset).toBe(24)
  })

  it('carries sanitized keywords, date bounds and a validated sort key', () => {
    const from = new Date('2026-10-09T00:00:00Z')
    const to = new Date('2026-10-12T00:00:00Z')
    const resolved = resolveListParams({ keywords: [' sports ', 'SPORTS', ''], startsFrom: from, startsTo: to, sort: 'newest' })
    expect(resolved.keywords).toEqual(['sports'])
    expect(resolved.startsFrom).toBe(from)
    expect(resolved.startsTo).toBe(to)
    expect(resolved.sort).toBe('newest')
  })

  it('ignores invalid dates and unknown sort keys instead of throwing', () => {
    const resolved = resolveListParams({ startsFrom: new Date('not-a-date'), startsTo: 42 as unknown as Date, sort: 'cheap' as 'trending' })
    expect(resolved.startsFrom).toBe(null)
    expect(resolved.startsTo).toBe(null)
    expect(resolved.sort).toBe('trending')
  })

  it('caps pageSize inside the 1..48 band and trims search input', () => {
    expect(resolveListParams({ pageSize: 100 }).pageSize).toBe(48)
    expect(resolveListParams({ pageSize: 0 }).pageSize).toBe(12)
    expect(resolveListParams({ search: '  Kampala nights  ' }).search).toBe('Kampala nights')
    expect(resolveListParams({ search: '   ' }).search).toBe(null)
    expect(resolveListParams({ search: 'x'.repeat(500) }).search).toHaveLength(120)
  })
})

describe('escapeLikePattern', () => {
  it('escapes LIKE wildcards and escape characters before interpolation', () => {
    expect(escapeLikePattern('100%_live\\night')).toBe('100\\%\\_live\\\\night')
  })
})

describe('summarizeEventAvailability (mirrors public detail-page semantics)', () => {
  it('labels cancelled events without a checkout CTA', () => {
    expect(summarizeEventAvailability({ lifecycleState: 'CANCELLED', hasTicketTypes: true, ticketsRemaining: 5, anyOnSale: true, anyUpcomingSale: false })).toEqual({ label: 'Cancelled', cta: false })
  })

  it('labels events without ticket types as details-only', () => {
    expect(summarizeEventAvailability({ lifecycleState: 'SALES_OPEN', hasTicketTypes: false, ticketsRemaining: 0, anyOnSale: false, anyUpcomingSale: false })).toEqual({ label: 'Ticket details coming soon', cta: false })
  })

  it('shows sales-opening-soon for published events with future sale windows', () => {
    expect(summarizeEventAvailability({ lifecycleState: 'PUBLISHED', hasTicketTypes: true, ticketsRemaining: 40, anyOnSale: false, anyUpcomingSale: true })).toEqual({ label: 'Sales opening soon', cta: false })
  })

  it('shows sales closed outside the SALES_OPEN lifecycle', () => {
    expect(summarizeEventAvailability({ lifecycleState: 'SALES_CLOSED', hasTicketTypes: true, ticketsRemaining: 10, anyOnSale: false, anyUpcomingSale: false })).toEqual({ label: 'Sales closed', cta: false })
  })

  it('shows sold out within SALES_OPEN even when types are on sale', () => {
    expect(summarizeEventAvailability({ lifecycleState: 'SALES_OPEN', hasTicketTypes: true, ticketsRemaining: 0, anyOnSale: true, anyUpcomingSale: false })).toEqual({ label: 'Sold out', cta: false })
  })

  it('offers the checkout CTA only for on-sale SALES_OPEN events with remaining capacity', () => {
    expect(summarizeEventAvailability({ lifecycleState: 'SALES_OPEN', hasTicketTypes: true, ticketsRemaining: 3, anyOnSale: true, anyUpcomingSale: false })).toEqual({ label: 'Tickets available', cta: true })
    expect(summarizeEventAvailability({ lifecycleState: 'SALES_OPEN', hasTicketTypes: true, ticketsRemaining: 3, anyOnSale: false, anyUpcomingSale: true })).toEqual({ label: 'Sales opening soon', cta: false })
    expect(summarizeEventAvailability({ lifecycleState: 'SALES_OPEN', hasTicketTypes: true, ticketsRemaining: 3, anyOnSale: false, anyUpcomingSale: false })).toEqual({ label: 'Sales closed', cta: false })
  })
})

const baseRow: PublicEventCardRow = {
  public_id: 'pub_1',
  slug: 'night-shift',
  title: 'Night Shift',
  description: 'A rooftop session.',
  starts_at: '2026-10-30T18:00:00Z',
  ends_at: '2026-10-31T02:00:00Z',
  timezone: 'Africa/Kampala',
  lifecycle_state: 'SALES_OPEN',
  organizer_name: 'Night Shift Collective',
  venue_name: 'Skyline Terrace',
  venue_city: 'Kampala',
  media_url: 'https://cdn.example/night.jpg',
  media_alt: '',
  tickets_remaining: '42',
  ticket_type_count: '2',
  min_price_minor_units: '20000',
  currency: 'UGX',
  any_on_sale: true,
  any_upcoming_sale: false,
}

describe('mapPublicEventRow', () => {
  it('maps the raw row to the public DTO with typed numbers and derived availability', () => {
    const card = mapPublicEventRow(baseRow)
    expect(card.publicId).toBe('pub_1')
    expect(card.ticketsRemaining).toBe(42)
    expect(card.minPriceMinorUnits).toBe(20000)
    expect(card.hasTicketTypes).toBe(true)
    expect(card.availability).toEqual({ label: 'Tickets available', cta: true })
    expect(card.imageAlt).toBe('Night Shift')
    expect(card.organizerName).toBe('Night Shift Collective')
  })

  it('exposes only public-safe fields — organizer-private and internal columns never leak', () => {
    const card = mapPublicEventRow(baseRow) as unknown as Record<string, unknown>
    expect(Object.keys(card).sort()).toEqual([
      'availability', 'currency', 'description', 'endsAt', 'hasTicketTypes', 'imageAlt', 'imageUrl',
      'lifecycleState', 'minPriceMinorUnits', 'organizerName', 'publicId', 'slug', 'startsAt', 'ticketsRemaining',
      'timezone', 'title', 'venueCity', 'venueName',
    ])
    expect(card).not.toHaveProperty('organizer_id')
    expect(card).not.toHaveProperty('publication_state')
  })

  it('maps a missing organizer name to null', () => {
    expect(mapPublicEventRow({ ...baseRow, organizer_name: null }).organizerName).toBe(null)
  })

  it('handles events with no ticket types and no media', () => {
    const card = mapPublicEventRow({ ...baseRow, ticket_type_count: '0', tickets_remaining: null, min_price_minor_units: null, currency: null, any_on_sale: null, any_upcoming_sale: null, media_url: null, media_alt: null })
    expect(card.hasTicketTypes).toBe(false)
    expect(card.ticketsRemaining).toBe(0)
    expect(card.minPriceMinorUnits).toBe(null)
    expect(card.imageUrl).toBe(null)
    expect(card.availability).toEqual({ label: 'Ticket details coming soon', cta: false })
  })
})

describe('buildPublicEventListQuery (discovery filter SQL)', () => {
  it('builds an unfiltered trending query with limit/offset as the final placeholders', () => {
    const { sql, values } = buildPublicEventListQuery(resolveListParams({}))
    expect(sql).toContain("e.publication_state = 'PUBLIC' AND e.discoverable = true")
    expect(sql).toContain('LEFT JOIN ticketug.organizer o ON o.id = e.organizer_id')
    expect(sql).toContain('GROUP BY e.id, o.name, v.name, v.city')
    expect(sql).toContain("ORDER BY (e.lifecycle_state = 'SALES_OPEN') DESC, e.starts_at ASC, e.id ASC LIMIT $1 OFFSET $2")
    expect(values).toEqual([12, 0])
  })

  it('combines search, category keywords, date window and sort with positional placeholders', () => {
    const resolved = resolveListParams({
      search: '100%_live',
      keywords: ['football', 'rugby'],
      startsFrom: new Date('2026-10-09T00:00:00Z'),
      startsTo: new Date('2026-10-12T00:00:00Z'),
      sort: 'soonest',
      page: 2,
    })
    const { sql, values } = buildPublicEventListQuery(resolved)
    expect(sql).toContain('(e.title ILIKE $1 OR e.description ILIKE $1)')
    expect(sql).toContain('(e.title ILIKE ANY($2) OR e.description ILIKE ANY($2))')
    expect(sql).toContain('e.starts_at >= $3')
    expect(sql).toContain('e.starts_at < $4')
    expect(sql).toContain('ORDER BY e.starts_at ASC, e.id ASC LIMIT $5 OFFSET $6')
    expect(values[0]).toBe('%100\\%\\_live%')
    expect(values[1]).toEqual(['%football%', '%rugby%'])
    expect(values[2]).toBe('2026-10-09T00:00:00.000Z')
    expect(values[3]).toBe('2026-10-12T00:00:00.000Z')
    expect(values[4]).toBe(12)
    expect(values[5]).toBe(12)
  })

  it('orders "Just announced" newest-first by creation time', () => {
    const { sql } = buildPublicEventListQuery(resolveListParams({ sort: 'newest' }))
    expect(sql).toContain('ORDER BY e.created_at DESC, e.starts_at ASC, e.id ASC')
  })

  it('escapes LIKE wildcards inside category keywords', () => {
    const { values } = buildPublicEventListQuery(resolveListParams({ keywords: ['100%_live'] }))
    expect(values[0]).toEqual(['%100\\%\\_live%'])
  })

  it('pairs with resolveWhenRange for the discovery date windows', () => {
    const range = resolveWhenRange('weekend', new Date('2026-10-07T15:30:00Z'))
    const { sql, values } = buildPublicEventListQuery(resolveListParams({ startsFrom: range.from, startsTo: range.to }))
    expect(sql).toContain('e.starts_at >= $1')
    expect(sql).toContain('e.starts_at < $2')
    expect(values[0]).toBe('2026-10-09T00:00:00.000Z')
    expect(values[1]).toBe('2026-10-12T00:00:00.000Z')
  })
})
