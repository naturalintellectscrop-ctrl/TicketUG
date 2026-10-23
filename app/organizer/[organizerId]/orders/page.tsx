import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/console/page-head'
import { Pagination, StatusPill, UnavailablePanel, stateTone } from '@/components/platform/ui'
import { getTicketUGContext } from '@/lib/request-context'
import { canManageOrganizer } from '@/lib/organizer-authorization'
import { listWorkspaceOrders, WORKSPACE_ORDER_STATES } from '@/lib/organizer-reports'
import { buildFilterQuery, formatDateTime, formatMoney, labelOf, ORDER_PAYMENT_STATE_LABELS } from '@/lib/platform/format'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

/**
 * Workspace Orders (spec §5.4) — every order across all of this workspace's
 * events, searchable and paginated. Owner/manager only (buyer PII; the SQL
 * enforces the same gate independently). Row links reuse the existing
 * per-event order detail — the single detail surface, not a duplicate.
 */
export default async function OrganizerOrdersPage({ params, searchParams }: { params: Promise<{ organizerId: string }>; searchParams: Promise<{ q?: string; state?: string; page?: string }> }) {
  const { organizerId } = await params
  const { q, state, page } = await searchParams
  const context = await getTicketUGContext()
  if (!context) redirect('/sign-in')
  if (!canManageOrganizer(context, organizerId)) redirect(`/organizer/${organizerId}`)

  const currentPage = Number.isFinite(Number(page)) && Number(page) > 0 ? Math.floor(Number(page)) : 1
  const result = await listWorkspaceOrders(organizerId, context.profileId, { q, state, page: currentPage, pageSize: PAGE_SIZE })
  const filterQuery = buildFilterQuery({ q, state })

  return (
    <>
      <PageHeader
        crumb="Orders"
        title="Workspace orders"
        lede="Every order across your events — search by reference, buyer, or filter by payment state."
        actions={<Link className="button button-quiet" href={`/organizer/${organizerId}/reports`}>Reports & exports</Link>}
      />

      <form className="console-filter-row" method="get" action={`/organizer/${organizerId}/orders`} role="search" aria-label="Filter orders">
        <input type="search" name="q" defaultValue={q ?? ''} placeholder="Order number, reference, buyer name or email" aria-label="Search orders" />
        <select name="state" defaultValue={state ?? ''} aria-label="Payment state">
          <option value="">All states</option>
          {WORKSPACE_ORDER_STATES.map((candidate) => (
            <option key={candidate} value={candidate}>{labelOf(ORDER_PAYMENT_STATE_LABELS, candidate)}</option>
          ))}
        </select>
        <button type="submit" className="button button-dark">Apply</button>
        {(q || state) && <Link className="button button-quiet" href={`/organizer/${organizerId}/orders`}>Clear</Link>}
      </form>

      {!result ? (
        <UnavailablePanel what="Your workspace order list" />
      ) : result.rows.length === 0 ? (
        <section className="surface stack">
          <h2>{q || state ? 'No orders match these filters' : 'No orders yet'}</h2>
          <p className="muted">{q || state ? 'Try a different search term or payment state.' : 'Orders appear here the moment buyers start checking out.'}</p>
        </section>
      ) : (
        <>
          {result.total > PAGE_SIZE && (
            <p className="filter-count">{result.total.toLocaleString('en-UG')} orders · page {currentPage} of {Math.max(1, Math.ceil(result.total / PAGE_SIZE))}</p>
          )}
          <div className="platform-scroll">
            <table className="platform-table">
              <thead><tr><th scope="col">Order</th><th scope="col">Buyer</th><th scope="col">Event</th><th scope="col">State</th><th scope="col">Total</th><th scope="col">Placed</th></tr></thead>
              <tbody>
                {result.rows.map((order) => (
                  <tr key={order.id}>
                    <td>
                      {order.eventId
                        ? <Link href={`/organizer/${organizerId}/events/${order.eventId}/orders/${order.publicId}`}>{order.orderNumber}</Link>
                        : <span>{order.orderNumber}</span>}
                      <span className="table-cell-sub">{order.isGuest ? 'Guest checkout' : 'Account buyer'}</span>
                    </td>
                    <td>
                      {order.purchaserName || '—'}
                      <span className="table-cell-sub">{order.purchaserEmail}</span>
                    </td>
                    <td>{order.eventTitle ?? <span className="muted">—</span>}</td>
                    <td><StatusPill tone={stateTone(order.paymentState)}>{labelOf(ORDER_PAYMENT_STATE_LABELS, order.paymentState)}</StatusPill></td>
                    <td>{formatMoney(Number(order.totalMinorUnits), order.currency)}</td>
                    <td>{formatDateTime(order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={currentPage} pageSize={PAGE_SIZE} total={result.total} baseHref={`/organizer/${organizerId}/orders${filterQuery}`} />
        </>
      )}
    </>
  )
}
