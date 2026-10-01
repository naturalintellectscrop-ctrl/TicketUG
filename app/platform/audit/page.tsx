import Link from 'next/link'
import { Pagination, StatusPill, UnavailablePanel } from '@/components/platform/ui'
import { listPlatformAudit, PAGE_SIZE } from '@/lib/platform/queries'
import { buildFilterQuery, clampPage, formatDateTime } from '@/lib/platform/format'

export const dynamic = 'force-dynamic'

type SearchParams = { type?: string; page?: string }

/** The authoritative security_event stream. Only what the application actually
 * wrote appears here — the stream is never reconstructed from UI activity.
 * The type filter is populated from the distinct values that really exist. */
export default async function PlatformAuditPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const type = params.type?.trim() ?? ''
  const page = clampPage(Number(params.page) || 1, Number.MAX_SAFE_INTEGER, PAGE_SIZE)
  const result = await listPlatformAudit({ eventType: type, page })

  return (
    <main className="platform-shell">
      <header className="section-heading">
        <div>
          <p className="eyebrow">Who did what</p>
          <h1>Audit stream</h1>
          <p className="lede">Security events as recorded by the application: role grants, membership changes and the like. Today the stream is deliberately small — it is a real record, not a reconstruction, and it grows as flows write to it.</p>
        </div>
      </header>

      <form className="filter-bar" method="get" action="/platform/audit" role="search">
        <label>Event type
          <select name="type" defaultValue={type}>
            <option value="">All types</option>
            {result?.knownTypes.map((known) => <option key={known} value={known}>{known}</option>)}
          </select>
        </label>
        <button className="button button-dark" type="submit">Filter</button>
        {result && <span className="filter-count">{result.total.toLocaleString('en-UG')} events</span>}
      </form>

      {result === null ? (
        <UnavailablePanel what="The audit stream" />
      ) : result.rows.length === 0 ? (
        <p className="muted empty-state">{type ? 'No events of this type exist.' : 'No security events have been recorded yet.'}</p>
      ) : (
        <>
          <div className="platform-scroll">
            <table className="platform-table">
              <thead><tr><th scope="col">Event</th><th scope="col">Actor</th><th scope="col">When</th></tr></thead>
              <tbody>
                {result.rows.map((event) => (
                  <tr key={event.id}>
                    <td><StatusPill tone="brand">{event.eventType}</StatusPill></td>
                    <td>
                      {event.actorProfileId
                        ? <Link href={`/platform/users/${event.actorProfileId}`}>{event.actorName || event.actorEmail || 'Profile'}</Link>
                        : <span className="muted">system</span>}
                      <span className="table-cell-sub">{event.actorEmail ?? 'no auth identity'}</span>
                    </td>
                    <td>{formatDateTime(event.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={result.total} baseHref={`/platform/audit${buildFilterQuery({ type })}`} />
        </>
      )}
    </main>
  )
}
