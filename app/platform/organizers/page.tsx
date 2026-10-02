import Link from 'next/link'
import { PageHeader } from '@/components/console/page-head'
import { Pagination, UnavailablePanel } from '@/components/platform/ui'
import { listPlatformOrganizers, PAGE_SIZE } from '@/lib/platform/queries'
import { buildFilterQuery, clampPage, formatDate, formatMoney } from '@/lib/platform/format'

export const dynamic = 'force-dynamic'

type SearchParams = { q?: string; page?: string }

/** Platform-wide organizer list with real membership/event/sales aggregates.
 * Money is gross provider-collected on the workspace's events — pre-fee,
 * pre-settlement; those concepts don't exist in the schema and are never
 * implied here. */
export default async function PlatformOrganizersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const q = params.q?.trim() ?? ''
  const page = clampPage(Number(params.page) || 1, Number.MAX_SAFE_INTEGER, PAGE_SIZE)
  const result = await listPlatformOrganizers({ q, page })

  return (
    <>
      <PageHeader
        crumb="Directory"
        title="Organizers"
        lede="Every organizer workspace with its team, event, and sales footprint. Tenant isolation is untouched: this lists workspaces, it does not open one."
      />

      <form className="filter-bar" method="get" action="/platform/organizers" role="search">
        <label>Search<input type="search" name="q" defaultValue={q} placeholder="Workspace name or slug" maxLength={120} /></label>
        <button className="button button-dark" type="submit">Filter</button>
        {result && <span className="filter-count">{result.total.toLocaleString('en-UG')} organizers</span>}
      </form>

      {result === null ? (
        <UnavailablePanel what="The organizer list" />
      ) : result.rows.length === 0 ? (
        <p className="muted empty-state">{q ? 'No organizers match this search.' : 'No organizer workspaces exist yet.'}</p>
      ) : (
        <>
          <div className="platform-scroll">
            <table className="platform-table">
              <thead><tr><th scope="col">Workspace</th><th scope="col" className="num">Members</th><th scope="col" className="num">Events</th><th scope="col" className="num">Paid orders</th><th scope="col" className="num">Gross collected</th><th scope="col">Created</th></tr></thead>
              <tbody>
                {result.rows.map((organizer) => (
                  <tr key={organizer.id}>
                    <td><Link href={`/platform/organizers/${organizer.id}`}>{organizer.name}</Link><span className="table-cell-sub">/{organizer.slug}</span></td>
                    <td className="num">{organizer.memberCount}</td>
                    <td className="num">{organizer.eventCount.toLocaleString('en-UG')}{organizer.publicEvents > 0 && <span className="table-cell-sub">{organizer.publicEvents} public</span>}</td>
                    <td className="num">{organizer.paidOrders.toLocaleString('en-UG')}</td>
                    <td className="num">{formatMoney(Number(organizer.collectedMinor))}</td>
                    <td>{formatDate(organizer.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={result.total} baseHref={`/platform/organizers${buildFilterQuery({ q })}`} />
        </>
      )}
    </>
  )
}
