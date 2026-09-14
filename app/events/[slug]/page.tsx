import { notFound } from 'next/navigation'
import { pool } from '@/lib/db'

export default async function PublicEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  let event
  try {
    const result = await pool.query('SELECT e.public_id, e.slug, e.title, e.description, e.timezone, e.starts_at, e.ends_at, v.name AS venue_name, v.city AS venue_city, COALESCE(json_agg(json_build_object(\'url\',em.url,\'altText\',em.alt_text,\'mediaType\',em.media_type) ORDER BY em.sort_order) FILTER (WHERE em.id IS NOT NULL), \'[]\') AS media FROM ticketug.event e LEFT JOIN ticketug.venue v ON v.id=e.venue_id LEFT JOIN ticketug.event_media em ON em.event_id=e.id WHERE e.slug=$1 AND e.publication_state=\'PUBLIC\' AND e.discoverable=true GROUP BY e.id,v.name,v.city', [slug])
    event = result.rows[0]
  } catch {
    notFound()
  }
  if (!event) notFound()
  return <main className="public-event"><p className="eyebrow">TicketUG event</p><h1>{event.title}</h1><p className="eyebrow">Public event page</p><p className="lede">{event.description}</p><div className="event-meta"><span>{new Date(event.starts_at).toLocaleString('en-UG', { dateStyle: 'full', timeStyle: 'short', timeZone: event.timezone })}</span><span>{event.timezone}</span>{event.venue_name && <span>{event.venue_name}{event.venue_city ? `, ${event.venue_city}` : ''}</span>}</div><section className="surface future-ticketing"><h2>Ticketing coming next</h2><p>This event page is ready for ticket types and inventory in the next TicketUG phase.</p></section></main>
}
