import Link from 'next/link'
import { SiteHeader } from '@/components/site-header'
import { EventCard } from '@/components/event-card'
import { listPublicEvents } from '@/lib/public-events'

export const dynamic = 'force-dynamic'

type SearchParams = { q?: string; page?: string }

export default async function EventsIndexPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { q, page } = await searchParams
  const search = q?.trim() ?? ''
  let result: Awaited<ReturnType<typeof listPublicEvents>> | null = null
  let failed = false
  try {
    result = await listPublicEvents({ search: search || null, page: page ? Number(page) : 1 })
  } catch {
    failed = true
  }
  const pageHref = (target: number) => `/events?page=${target}${search ? `&q=${encodeURIComponent(search)}` : ''}`
  return (
    <main className="events-index">
      <SiteHeader nextPath={search ? `/events?q=${encodeURIComponent(search)}` : '/events'} />
      <div className="page-shell">
        <p className="eyebrow">Discover</p>
        <h1>Events in Uganda</h1>
        <p className="lede">Every event below is published and listed by its organizer. Find your night, check availability, and check out in minutes.</p>
        <form className="events-toolbar" role="search" action="/events">
          <label htmlFor="events-q" className="sr-only">Search events</label>
          <input id="events-q" type="search" name="q" defaultValue={search} placeholder="Search events…" maxLength={120} />
          <button type="submit" className="button button-primary">Search</button>
          {search && <Link href="/events" className="button button-quiet">Clear</Link>}
        </form>
        {failed && (
          <section className="surface events-empty" role="alert">
            <p><strong>Event listings are temporarily unavailable.</strong> Please try again in a moment.</p>
          </section>
        )}
        {!failed && result && result.events.length === 0 && (
          <section className="surface events-empty">
            {search ? (
              <>
                <p><strong>No events match “{search}”.</strong></p>
                <p className="muted">Try a shorter search, or browse everything that is currently listed.</p>
                <Link className="button button-quiet" href="/events">Browse all events</Link>
              </>
            ) : (
              <>
                <p><strong>No upcoming events are available right now.</strong></p>
                <p className="muted">Organizers publish events here the moment they go on sale — check back soon.</p>
              </>
            )}
          </section>
        )}
        {!failed && result && result.events.length > 0 && (
          <>
            <p className="muted events-count">{result.total} {result.total === 1 ? 'event' : 'events'}{search ? ` matching “${search}”` : ''}</p>
            <div className="event-card-grid">{result.events.map((event) => <EventCard key={event.publicId} event={event} />)}</div>
            {(result.page > 1 || result.page < result.pageCount) && (
              <nav className="row pagination" aria-label="Event pages">
                {result.page > 1 ? <Link className="button button-quiet" href={pageHref(result.page - 1)}>← Previous</Link> : <span />}
                <span className="muted">Page {result.page} of {result.pageCount}</span>
                {result.page < result.pageCount ? <Link className="button button-quiet" href={pageHref(result.page + 1)}>Next →</Link> : <span />}
              </nav>
            )}
          </>
        )}
      </div>
    </main>
  )
}
