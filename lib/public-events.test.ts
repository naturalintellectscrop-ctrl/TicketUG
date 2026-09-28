import { describe, expect, it } from 'vitest'
import { escapeLikePattern, mapPublicEventRow, resolveListParams, summarizeEventAvailability, type PublicEventCardRow } from './public-events'

describe('resolveListParams', () => {
  it('defaults to page 1 with pageSize 12 and no search', () => {
    expect(resolveListParams({})).toEqual({ search: null, page: 1, pageSize: 12, offset: 0 })
  })

  it('clamps invalid, zero and negative pages back to page 1', () => {
    expect(resolveListParams({ page: 0 }).page).toBe(1)
    expect(resolveListParams({ page: -3 }).page).toBe(1)
    expect(resolveListParams({ page: Number.NaN }).page).toBe(1)
  })

  it('computes the deterministic offset for later pages', () => {
    expect(resolveListParams({ page: 3, pageSize: 12 })).toEqual({ search: null, page: 3, pageSize: 12, offset: 24 })
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
  })

  it('exposes only public-safe fields — organizer-private and internal columns never leak', () => {
    const card = mapPublicEventRow(baseRow) as unknown as Record<string, unknown>
    expect(Object.keys(card).sort()).toEqual([
      'availability', 'currency', 'description', 'endsAt', 'hasTicketTypes', 'imageAlt', 'imageUrl',
      'lifecycleState', 'minPriceMinorUnits', 'publicId', 'slug', 'startsAt', 'ticketsRemaining',
      'timezone', 'title', 'venueCity', 'venueName',
    ])
    expect(card).not.toHaveProperty('organizer_id')
    expect(card).not.toHaveProperty('publication_state')
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
