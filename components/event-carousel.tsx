'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, Star, UserRound } from 'lucide-react'
import type { PublicEventCard } from '@/lib/public-events'
import { categoryForSlug } from '@/lib/event-categories'

/**
 * Featured-event hero carousel for the discovery page (ticketdaddy-style:
 * big picture slides, FEATURED + date pills, title, venue line, Get Tickets
 * CTA, prev/next arrows with an "n / m" counter). TicketUG's own festive
 * palette — organizer-supplied art first, deterministic category-gradient
 * fallback covers when an event ships without a picture.
 *
 * Auto-advances every 6.5s; pauses on hover/focus so users can read and click.
 */
export function EventCarousel({ events }: { events: PublicEventCard[] }) {
  const count = events.length
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  // Filter changes can shrink the event set — clamp instead of showing a blank slide.
  const current = count > 0 ? Math.min(index, count - 1) : 0

  useEffect(() => {
    if (paused || count < 2) return
    const timer = setInterval(() => setIndex((value) => (value + 1) % count), 6500)
    return () => clearInterval(timer)
  }, [paused, count])

  if (count === 0) return null
  const go = (target: number) => setIndex(((target % count) + count) % count)

  return (
    <section
      className="featured-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured events"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="fc-window">
        <div className="fc-track" style={{ transform: `translateX(-${current * 100}%)` }}>
          {events.map((event, slide) => {
            const category = categoryForSlug(event.slug)
            const CategoryIcon = category.icon
            const active = slide === current
            const when = new Date(event.startsAt)
              .toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: event.timezone })
              .toUpperCase()
            const venue = event.venueName ? `${event.venueName}${event.venueCity ? `, ${event.venueCity}` : ''}` : null
            const price = event.minPriceMinorUnits !== null
              ? `From ${event.minPriceMinorUnits.toLocaleString('en-UG')} ${event.currency ?? 'UGX'}`
              : null
            return (
              <div
                key={event.publicId}
                className="fc-slide"
                role="group"
                aria-roledescription="slide"
                aria-label={`${slide + 1} of ${count}: ${event.title}`}
                aria-hidden={active ? undefined : 'true'}
              >
                <Link
                  href={`/events/${event.slug}`}
                  className="fc-slide-link"
                  tabIndex={active ? 0 : -1}
                  aria-label={`${event.title} — view event details`}
                >
                  <div className="fc-media" aria-hidden="true">
                    {event.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- organizer-supplied remote media URLs; plain img avoids remote-host allowlisting
                      <img src={event.imageUrl} alt="" loading={slide === 0 ? 'eager' : 'lazy'} />
                    ) : (
                      <span className="event-fallback fc-fallback" data-category={category.key}>
                        <span className="fallback-icon"><CategoryIcon strokeWidth={1.2} /></span>
                        <span className="fallback-word">TicketUG</span>
                      </span>
                    )}
                  </div>
                  <span className="fc-scrim" aria-hidden="true" />
                  <div className="fc-content">
                    <div className="fc-badges">
                      <span className="fc-badge fc-badge-featured"><Star size={12} strokeWidth={2.6} aria-hidden /> Featured</span>
                      <span className="fc-badge"><CalendarDays size={13} strokeWidth={2.2} aria-hidden /> {when}</span>
                      {event.lifecycleState === 'CANCELLED' && <span className="fc-badge fc-badge-cancelled">Cancelled</span>}
                    </div>
                    <h2 className="fc-title">{event.title}</h2>
                    <p className="fc-meta">
                      {event.organizerName && <span><UserRound size={14} strokeWidth={2.2} aria-hidden /> {event.organizerName}</span>}
                      {venue && <span><MapPin size={14} strokeWidth={2.2} aria-hidden /> {venue}</span>}
                    </p>
                    <div className="fc-actions">
                      <span className={event.availability.cta ? 'button button-primary' : 'button button-quiet'}>
                        {event.availability.cta ? 'Get tickets' : 'View details'}
                      </span>
                      {price && <strong className="fc-price">{price}</strong>}
                    </div>
                  </div>
                </Link>
              </div>
            )
          })}
        </div>
      </div>
      {count > 1 && (
        <div className="fc-controls">
          <span className="fc-count" aria-hidden="true">{current + 1} / {count}</span>
          <button type="button" className="fc-arrow" onClick={() => go(current - 1)} aria-label="Previous featured event">
            <ChevronLeft size={19} strokeWidth={2.4} />
          </button>
          <button type="button" className="fc-arrow" onClick={() => go(current + 1)} aria-label="Next featured event">
            <ChevronRight size={19} strokeWidth={2.4} />
          </button>
        </div>
      )}
      <p className="sr-only" aria-live="polite">Featured event {current + 1} of {count}: {events[current]?.title}</p>
    </section>
  )
}
