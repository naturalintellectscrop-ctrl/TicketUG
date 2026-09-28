import Link from 'next/link'
import type { PublicEventCard } from '@/lib/public-events'

// Shared public event card — used by the /events discovery index and the
// landing-page "Upcoming events" section. Presentation only; all data comes
// from the shared discovery query in lib/public-events.ts.
export function EventCard({ event }: { event: PublicEventCard }) {
  const when = new Date(event.startsAt).toLocaleString('en-UG', { dateStyle: 'full', timeStyle: 'short', timeZone: event.timezone })
  const price = event.minPriceMinorUnits !== null ? `From ${event.minPriceMinorUnits.toLocaleString('en-UG')} ${event.currency ?? 'UGX'}` : null
  return (
    <article className="event-card surface">
      <Link href={`/events/${event.slug}`} className="event-card-link" aria-label={`${event.title} — view event details`}>
        <div className="event-card-media">
          {/* eslint-disable-next-line @next/next/no-img-element -- organizer-supplied remote media URLs; plain img avoids remote-host allowlisting */}
          {event.imageUrl ? <img src={event.imageUrl} alt={event.imageAlt ?? event.title} loading="lazy" /> : <span className="event-card-fallback" aria-hidden="true">TicketUG</span>}
          <span className={`availability-chip${event.availability.cta ? ' availability-open' : ''}${event.lifecycleState === 'CANCELLED' ? ' availability-cancelled' : ''}`}>{event.availability.label}</span>
        </div>
        <div className="event-card-body">
          <h3>{event.title}</h3>
          <div className="event-meta">
            <span>{when}</span>
            <span>{event.timezone}</span>
            {event.venueName && <span>{event.venueName}{event.venueCity ? `, ${event.venueCity}` : ''}</span>}
          </div>
          {event.description && <p className="event-card-desc">{event.description}</p>}
          <div className="row-between event-card-foot">
            {price ? <strong>{price}</strong> : <span />}
            <span className="text-link">{event.availability.cta ? 'Get tickets' : 'View details'} <span aria-hidden="true">↗</span></span>
          </div>
        </div>
      </Link>
    </article>
  )
}
