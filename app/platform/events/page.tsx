import Link from 'next/link'
import { PageHeader } from '@/components/console/page-head'
import { Pagination, StatusPill, UnavailablePanel, stateTone } from '@/components/platform/ui'
import { EVENT_LIFECYCLE_STATES, listPlatformEvents } from '@/lib/platform/queries'
import { buildFilterQuery, clampPage, formatDateTime, labelOf, LIFECYCLE_LABELS } from '@/lib/platform/format'
import { PAGE_SIZE } from '@/lib/platform/queries'

export const dynamic = 'force-dynamic'

type SearchParams = { q?: string; lifecycle?: string; publication?: string; page?: string }

/** Platform-wide event explorer. Filters are validated against the real
 * lifecycle/publication CHECK values — anything else is treated as unset. */
export default async function PlatformEventsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const q = params.q?.trim() ?? ''
  const page = clampPage(Number(params.page) || 1, Number.MAX_SAFE_INTEGER, PAGE_SIZE)
  const result = await listPlatformEvents({ q, lifecycle: params.lifecycle, publication: params.publication, page })
  const baseHref = '/platform/events' + buildFilterQuery({ q, lifecycle: params.lifecycle, publication: params.publication })

  return (
    <>
      <PageHeader
        crumb="Operations"
        title="Events"
        lede="Every event on the platform with its publication and lifecycle state. Lifecycle changes belong to the owning organizer through the state machine — this view investigates, it does not override."
      />

      <form className="filter-bar" method="get" action="/platform/events" role="search">
        <label>Search<input type="search" name="q" defaultValue={q} placeholder="Title, slug, public id, organizer" maxLength={120} /></label>
        <label>Lifecycle
          <select name="lifecycle" defaultValue={params.lifecycle ?? ''}>
            <option value="">All states</option>
            {EVENT_LIFECYCLE_STATES.map((state) => <option key={state} value={state}>{labelOf(LIFECYCLE_LABELS, state)}</option>)}
          </select>
        </label>
        <label>Visibility
          <select name="publication" defaultValue={params.publication ?? ''}>
            <option value="">All</option>
            <option value="PUBLIC">Public</option>
            <option value="PRIVATE">Private</option>
          </select>
        </label>
        <button className="button button-dark" type="submit">Filter</button>
        {result && <span className="filter-count">{result.total.toLocaleString('en-UG')} events</span>}
      </form>

      {result === null ? (
        <UnavailablePanel what="The event list" />
      ) : result.rows.length === 0 ? (
        <p className="muted empty-state">No events match these filters.</p>
      ) : (
        <>
          <div className="platform-scroll">
            <table className="platform-table">
              <thead><tr><th scope="col">Event</th><th scope="col">Organizer</th><th scope="col">Visibility</th><th scope="col">Lifecycle</th><th scope="col">Starts</th><th scope="col" className="num">Types</th><th scope="col" className="num">Tickets</th></tr></thead>
              <tbody>
                {result.rows.map((event) => (
                  <tr key={event.id}>
                    <td><Link href={`/platform/events/${event.publicId}`}>{event.title}</Link><span className="table-cell-sub">{event.publicId} · {event.venueName ?? 'no venue'}</span></td>
                    <td><Link href={`/platform/organizers/${event.organizerId}`}>{event.organizerName}</Link></td>
                    <td><StatusPill tone={event.publicationState === 'PUBLIC' ? 'ok' : 'info'}>{event.publicationState === 'PUBLIC' ? 'Public' : 'Private'}</StatusPill></td>
                    <td><StatusPill tone={stateTone(event.lifecycleState)}>{labelOf(LIFECYCLE_LABELS, event.lifecycleState)}</StatusPill></td>
                    <td>{formatDateTime(event.startsAt)}</td>
                    <td className="num">{event.ticketTypeCount}</td>
                    <td className="num">{event.ticketsIssued.toLocaleString('en-UG')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={result.total} baseHref={baseHref} />
        </>
      )}
    </>
  )
}
