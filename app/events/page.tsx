import Link from 'next/link'
import type { Metadata } from 'next'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { EventCard } from '@/components/event-card'
import { EventCarousel } from '@/components/event-carousel'
import { EventsFilterBar } from '@/components/events-filter-bar'
import { listPublicEvents } from '@/lib/public-events'
import { logServerError } from '@/lib/server/errors'
import {
  categoryByKey,
  normalizeSortKey,
  normalizeWhenKey,
  resolveWhenRange,
  EVENT_WHEN_OPTIONS,
  EVENT_SORT_OPTIONS,
} from '@/lib/event-categories'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Events in Uganda — find concerts, festivals, parties & more',
  description: 'Browse upcoming events in Uganda — concerts, music nights, food markets, sports, conferences, church gatherings and parties. Filter by date and category, then buy tickets with mobile money on Ticket Uganda.',
  alternates: { canonical: '/events' }
}

type SearchParams = { q?: string; page?: string; category?: string; when?: string; sort?: string }

export default async function EventsIndexPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { q, page, category, when, sort } = await searchParams
  const search = q?.trim() ?? ''
  const activeCategory = categoryByKey(category) ?? null
  const whenKey = normalizeWhenKey(when)
  const sortKey = normalizeSortKey(sort)
  const whenRange = resolveWhenRange(whenKey)

  // The active filter state as a query string — reused for the header return
  // path, the search form's hidden fields, and pagination links.
  const filterParams = new URLSearchParams()
  if (search) filterParams.set('q', search)
  if (activeCategory) filterParams.set('category', activeCategory.key)
  if (whenKey !== 'any') filterParams.set('when', whenKey)
  if (sortKey !== 'trending') filterParams.set('sort', sortKey)
  const filterQuery = filterParams.toString()
  const currentHref = filterQuery ? `/events?${filterQuery}` : '/events'
  const pageHref = (target: number) => {
    const params = new URLSearchParams(filterParams.toString())
    if (target > 1) params.set('page', String(target))
    const queryString = params.toString()
    return queryString ? `/events?${queryString}` : '/events'
  }

  const filterContext = [
    search ? `matching “${search}”` : null,
    activeCategory ? activeCategory.label.toLowerCase() : null,
    whenKey !== 'any' ? EVENT_WHEN_OPTIONS.find((option) => option.key === whenKey)?.label.toLowerCase() : null,
    sortKey !== 'trending' ? EVENT_SORT_OPTIONS.find((option) => option.key === sortKey)?.label.toLowerCase() : null,
  ].filter(Boolean) as string[]

  let result: Awaited<ReturnType<typeof listPublicEvents>> | null = null
  let failed = false
  try {
    result = await listPublicEvents({
      search: search || null,
      keywords: activeCategory?.keywords ?? null,
      startsFrom: whenRange.from,
      startsTo: whenRange.to,
      sort: sortKey,
      page: page ? Number(page) : 1,
    })
  } catch (error) {
    logServerError('page:events', error)
    failed = true
  }

  return (
    <main className="events-index">
      <SiteHeader nextPath={currentHref} />
      <div className="page-shell">
        <p className="eyebrow">Discover</p>
        <h1>Events in Uganda</h1>
        <p className="lede">Every event below is published and listed by its organizer. Filter by category, pick your dates, and check out in minutes.</p>
        <form className="events-toolbar" role="search" action="/events">
          <label htmlFor="events-q" className="sr-only">Search events</label>
          <input id="events-q" type="search" name="q" defaultValue={search} placeholder="Search events…" maxLength={120} />
          {activeCategory && <input type="hidden" name="category" value={activeCategory.key} />}
          {whenKey !== 'any' && <input type="hidden" name="when" value={whenKey} />}
          {sortKey !== 'trending' && <input type="hidden" name="sort" value={sortKey} />}
          <button type="submit" className="button button-primary"><Search size={16} strokeWidth={2.4} aria-hidden /> Search</button>
          {(search || activeCategory || whenKey !== 'any') && (
            <Link href="/events" className="button button-quiet">Clear</Link>
          )}
        </form>
        <EventsFilterBar activeCategory={activeCategory?.key ?? null} when={whenKey} sort={sortKey} query={search} />
        {failed && (
          <section className="surface events-empty" role="alert">
            <p><strong>Event listings are temporarily unavailable.</strong> Please try again in a moment.</p>
          </section>
        )}
        {!failed && result && result.events.length === 0 && (
          <section className="surface events-empty">
            {search || activeCategory || whenKey !== 'any' ? (
              <>
                <p><strong>No events match {filterContext.length ? `your filters` : 'that search'}.</strong></p>
                <p className="muted">Try a different category or date window, or browse everything that is currently listed.</p>
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
            {result.page === 1 && <EventCarousel events={result.events.slice(0, 5)} />}
            <p className="muted events-count">
              {result.total} {result.total === 1 ? 'event' : 'events'}
              {filterContext.length > 0 ? ` — ${filterContext.join(', ')}` : ''}
            </p>
            <div className="event-card-grid">{result.events.map((event) => <EventCard key={event.publicId} event={event} />)}</div>
            {(result.page > 1 || result.page < result.pageCount) && (
              <nav className="row pagination" aria-label="Event pages">
                {result.page > 1
                  ? <Link className="button button-quiet" href={pageHref(result.page - 1)}><ChevronLeft size={16} strokeWidth={2.4} aria-hidden /> Previous</Link>
                  : <span />}
                <span className="muted">Page {result.page} of {result.pageCount}</span>
                {result.page < result.pageCount
                  ? <Link className="button button-quiet" href={pageHref(result.page + 1)}>Next <ChevronRight size={16} strokeWidth={2.4} aria-hidden /></Link>
                  : <span />}
              </nav>
            )}
          </>
        )}
      </div>
    </main>
  )
}
