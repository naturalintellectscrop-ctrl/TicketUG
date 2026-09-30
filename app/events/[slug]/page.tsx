import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SiteHeader } from '@/components/site-header'
import { pool } from '@/lib/db'
import { categoryForSlug } from '@/lib/event-categories'
import { SITE_NAME, SITE_URL } from '@/lib/site'

export const dynamic = 'force-dynamic'

type PublicEventRow = { public_id: string; slug: string; title: string; description: string; timezone: string; starts_at: string; ends_at: string; lifecycle_state: string; organizer_name: string | null; venue_name: string | null; venue_city: string | null; media: Array<{ url: string; altText: string; mediaType: string }> }
type TicketRow = { public_id: string; name: string; description: string; price_minor_units: string; currency: string; remaining_capacity: number; sale_starts_at: string | null; sale_ends_at: string | null; active: boolean }

async function loadPublicEvent(slug: string): Promise<{ event: PublicEventRow; tickets: TicketRow[] } | null> {
  try {
    const result = await pool.query<PublicEventRow>('SELECT e.public_id, e.slug, e.title, e.description, e.timezone, e.starts_at, e.ends_at, e.lifecycle_state, o.name AS organizer_name, v.name AS venue_name, v.city AS venue_city, COALESCE(json_agg(json_build_object(\'url\',em.url,\'altText\',em.alt_text,\'mediaType\',em.media_type) ORDER BY em.sort_order) FILTER (WHERE em.id IS NOT NULL), \'[]\') AS media FROM ticketug.event e LEFT JOIN ticketug.organizer o ON o.id=e.organizer_id LEFT JOIN ticketug.venue v ON v.id=e.venue_id LEFT JOIN ticketug.event_media em ON em.event_id=e.id WHERE e.slug=$1 AND e.publication_state=\'PUBLIC\' AND e.discoverable=true GROUP BY e.id,o.name,v.name,v.city', [slug])
    const found = result.rows[0]
    if (!found) return null
    const ticketResult = await pool.query<TicketRow>('SELECT t.public_id, t.name, t.description, t.price_minor_units, t.currency, t.remaining_capacity, t.sale_starts_at, t.sale_ends_at, t.active FROM ticketug.ticket_type t JOIN ticketug.event e ON e.id=t.event_id WHERE e.slug=$1 AND e.publication_state=\'PUBLIC\' AND e.discoverable=true AND t.active=true ORDER BY t.sort_order, t.created_at', [slug])
    return { event: found, tickets: ticketResult.rows }
  } catch {
    return null
  }
}

// SEO: every public event page is its own search entry point ("events in
// Kampala this weekend", the event name, the venue…). The description falls
// back to the site-wide pitch when an organizer left theirs blank.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const loaded = await loadPublicEvent(slug).catch(() => null)
  if (!loaded) return { title: 'Event not found' }
  const { event } = loaded
  const when = new Date(event.starts_at).toLocaleString('en-UG', { dateStyle: 'full', timeStyle: 'short', timeZone: event.timezone })
  const where = event.venue_name ? `${event.venue_name}${event.venue_city ? `, ${event.venue_city}` : ''}` : 'Uganda'
  const title = `${event.title} — ${when}`
  const description = event.description?.trim()
    ? `${event.description.slice(0, 155)}`
    : `${event.title} in ${where} — ${when}. Get tickets on ${SITE_NAME} with mobile money and secure QR entry.`
  const hero = event.media.find((media) => media.mediaType === 'IMAGE')
  return {
    title,
    description,
    alternates: { canonical: `/events/${event.slug}` },
    openGraph: {
      type: 'website',
      title,
      description,
      url: `${SITE_URL}/events/${event.slug}`,
      images: hero ? [{ url: hero.url }] : undefined
    }
  }
}

export default async function PublicEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const loaded = await loadPublicEvent(slug)
  if (!loaded) notFound()
  const { event, tickets } = loaded
  const FallbackIcon = categoryForSlug(event.slug).icon
  const salesOpen = event.lifecycle_state === 'SALES_OPEN'
  const anyAvailable = tickets.some((ticket) => ticket.remaining_capacity > 0)
  const heroMedia = event.media.find((media) => media.mediaType === 'IMAGE')
  function availability(ticket: TicketRow) {
    if (event.lifecycle_state === 'CANCELLED') return 'Event cancelled'
    if (!salesOpen) return 'Sales closed'
    if (ticket.remaining_capacity <= 0) return 'Sold out'
    if (ticket.sale_starts_at && new Date() < new Date(ticket.sale_starts_at)) return `Sales open ${new Date(ticket.sale_starts_at).toLocaleString('en-UG')}`
    if (ticket.sale_ends_at && new Date() >= new Date(ticket.sale_ends_at)) return 'Sales closed'
    return 'Available'
  }
  // Structured data so the event can surface as a rich result (date, venue,
  // organizer, ticket offers) in search engines.
  const eventJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: event.description || undefined,
    startDate: new Date(event.starts_at).toISOString(),
    endDate: new Date(event.ends_at).toISOString(),
    eventStatus: event.lifecycle_state === 'CANCELLED' ? 'https://schema.org/EventCancelled' : 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    image: heroMedia ? [heroMedia.url] : undefined,
    location: event.venue_name
      ? { '@type': 'Place', name: event.venue_name, address: { '@type': 'PostalAddress', addressLocality: event.venue_city || undefined, addressCountry: 'UG' } }
      : undefined,
    organizer: event.organizer_name ? { '@type': 'Organization', name: event.organizer_name } : undefined,
    offers: tickets.length
      ? tickets.map((ticket) => ({
          '@type': 'Offer',
          name: ticket.name,
          price: Number(ticket.price_minor_units),
          priceCurrency: ticket.currency,
          availability: ticket.remaining_capacity > 0 ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
          url: `${SITE_URL}/events/${event.slug}/order`,
          validFrom: ticket.sale_starts_at ? new Date(ticket.sale_starts_at).toISOString() : undefined
        }))
      : undefined
  }
  return <main className="public-event"><SiteHeader nextPath={`/events/${slug}/order`} /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd) }} />{heroMedia ? <figure className="event-hero">
    {/* eslint-disable-next-line @next/next/no-img-element -- organizer-supplied remote media URLs; plain img avoids remote-host allowlisting */}
    <img src={heroMedia.url} alt={heroMedia.altText || event.title} />
  </figure> : <div className="event-hero event-hero-fallback" data-category={categoryForSlug(event.slug).key} aria-hidden="true"><span className="fallback-icon"><FallbackIcon strokeWidth={1.1} /></span><span className="fallback-word">Ticket Uganda</span></div>}<p className="eyebrow">Ticket Uganda event</p><h1>{event.title}</h1><p className="eyebrow">Public event page</p><p className="lede">{event.description}</p><div className="event-meta"><span>{new Date(event.starts_at).toLocaleString('en-UG', { dateStyle: 'full', timeStyle: 'short', timeZone: event.timezone })}</span><span>{event.timezone}</span>{event.organizer_name && <span>Organised by {event.organizer_name}</span>}{event.venue_name && <span>{event.venue_name}{event.venue_city ? `, ${event.venue_city}` : ''}</span>}</div>{salesOpen && anyAvailable && <div className="row"><Link className="button button-primary" href={`/events/${slug}/order`}>Get tickets</Link></div>}{event.lifecycle_state === 'CANCELLED' && <div className="surface"><p role="alert"><strong>This event has been cancelled.</strong> Contact the organizer about any tickets you already hold.</p></div>}<section className="stack"><div className="section-heading"><div><p className="eyebrow">Ticket types</p><h2>Choose your experience</h2></div></div>{tickets.length ? tickets.map((ticket) => <article className="surface" key={ticket.public_id}><div className="row-between"><div><h3>{ticket.name}</h3><p className="lede">{ticket.description}</p></div><strong>{Number(ticket.price_minor_units).toLocaleString('en-UG')} {ticket.currency}</strong></div><p>{availability(ticket)}</p></article>) : <div className="surface"><p>Ticket types will be announced soon.</p></div>}</section></main>
}
