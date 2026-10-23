import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PageHeader, SectionHead } from '@/components/console/page-head'
import { StatusPill, UnavailablePanel, stateTone } from '@/components/platform/ui'
import { getTicketUGContext } from '@/lib/request-context'
import { canManageOrganizer } from '@/lib/organizer-authorization'
import { loadOrdersByState, loadSalesByEvent } from '@/lib/organizer-reports'
import { formatDateTime, formatMoney, labelOf, LIFECYCLE_LABELS, ORDER_PAYMENT_STATE_LABELS } from '@/lib/platform/format'

export const dynamic = 'force-dynamic'

const REPORT_CAP = 100

/**
 * Reports (spec §5.9) — real aggregates over the workspace's own data, with
 * CSV exports served by the same permission boundaries. Every money figure
 * is gross paid order value (provider-collected, pre-fee) — the schema has
 * no fee/settlement primitives, so nothing is labeled "net".
 */
export default async function OrganizerReportsPage({ params }: { params: Promise<{ organizerId: string }> }) {
  const { organizerId } = await params
  const context = await getTicketUGContext()
  if (!context) redirect('/sign-in')
  if (!canManageOrganizer(context, organizerId)) redirect(`/organizer/${organizerId}`)

  const [sales, states] = await Promise.all([
    loadSalesByEvent(organizerId, context.profileId, REPORT_CAP),
    loadOrdersByState(organizerId, context.profileId),
  ])

  const totals = sales
    ? sales.reduce((acc, row) => ({
        paidOrders: acc.paidOrders + row.paidOrders,
        gross: acc.gross + Number(row.grossPaidMinor),
        issued: acc.issued + row.ticketsIssued,
        checkedIn: acc.checkedIn + row.checkedIn,
        capacity: acc.capacity + Number(row.capacity),
        remaining: acc.remaining + Number(row.remaining),
      }), { paidOrders: 0, gross: 0, issued: 0, checkedIn: 0, capacity: 0, remaining: 0 })
    : null
  const paidState = states?.find((entry) => entry.state === 'PAID')

  return (
    <>
      <PageHeader
        crumb="Reports"
        title="Reports & exports"
        lede="Sales, inventory, and attendance across your events. Exports carry the same access checks as these pages."
      />

      {!sales || !states ? (
        <UnavailablePanel what="Your reports" />
      ) : (
        <>
          <section aria-label="Sales by event">
            <SectionHead
              title="Sales by event"
              note={`${totals ? `${totals.paidOrders.toLocaleString('en-UG')} paid orders · gross ${totals.gross.toLocaleString('en-UG')} UGX` : ''}${sales.length >= REPORT_CAP ? ' · showing first 100 events' : ''}`}
            />
            {sales.length === 0 ? (
              <section className="surface stack">
                <h2>Nothing to report yet</h2>
                <p className="muted">Create an event and its sales will appear here. <Link href={`/organizer/${organizerId}/events/new`}>Create event</Link></p>
              </section>
            ) : (
              <>
                <div className="platform-scroll">
                  <table className="platform-table">
                    <thead>
                      <tr>
                        <th scope="col">Event</th>
                        <th scope="col">Lifecycle</th>
                        <th scope="col">Paid orders</th>
                        <th scope="col">Gross paid (pre-fee)</th>
                        <th scope="col">Tickets issued</th>
                        <th scope="col">Checked in</th>
                        <th scope="col">Inventory left</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sales.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <Link href={`/organizer/${organizerId}/events/${row.id}`}>{row.title}</Link>
                            <span className="table-cell-sub">{formatDateTime(row.starts_at)}</span>
                          </td>
                          <td><StatusPill tone={stateTone(row.lifecycle_state)}>{labelOf(LIFECYCLE_LABELS, row.lifecycle_state)}</StatusPill></td>
                          <td>{row.paidOrders.toLocaleString('en-UG')}</td>
                          <td>{formatMoney(Number(row.grossPaidMinor))}</td>
                          <td>{row.ticketsIssued.toLocaleString('en-UG')}</td>
                          <td>{row.checkedIn.toLocaleString('en-UG')}</td>
                          <td>{Number(row.remaining).toLocaleString('en-UG')} of {Number(row.capacity).toLocaleString('en-UG')}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td><strong>Totals</strong></td>
                        <td />
                        <td><strong>{totals!.paidOrders.toLocaleString('en-UG')}</strong></td>
                        <td><strong>{formatMoney(totals!.gross)}</strong></td>
                        <td><strong>{totals!.issued.toLocaleString('en-UG')}</strong></td>
                        <td><strong>{totals!.checkedIn.toLocaleString('en-UG')}</strong></td>
                        <td><strong>{totals!.remaining.toLocaleString('en-UG')} of {totals!.capacity.toLocaleString('en-UG')}</strong></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p className="muted" style={{ margin: '8px 0 0' }}>Gross figures are provider-collected values on paid orders, before any platform fees — the ledger does not model fees or settlements yet, so no &ldquo;net&rdquo; is claimed.</p>
              </>
            )}
            <div className="row" style={{ marginTop: 14 }}>
              <a className="button button-dark" href={`/api/organizers/${organizerId}/reports/export?type=sales-by-event`}>Export sales CSV</a>
            </div>
          </section>

          <section className="console-section" aria-label="Orders by payment state">
            <SectionHead title="Orders by payment state" note={`${paidState?.count ?? 0} paid orders in total`} />
            <div className="platform-scroll">
              <table className="platform-table">
                <thead><tr><th scope="col">Payment state</th><th scope="col">Orders</th><th scope="col">Order value</th></tr></thead>
                <tbody>
                  {states.map((entry) => (
                    <tr key={entry.state}>
                      <td><StatusPill tone={stateTone(entry.state)}>{labelOf(ORDER_PAYMENT_STATE_LABELS, entry.state)}</StatusPill></td>
                      <td>{entry.count.toLocaleString('en-UG')}</td>
                      <td>{formatMoney(entry.totalMinorUnits)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="row" style={{ marginTop: 14 }}>
              <a className="button button-dark" href={`/api/organizers/${organizerId}/reports/export?type=orders-by-state`}>Export order-states CSV</a>
            </div>
          </section>

          <p className="muted" style={{ marginTop: 18 }}>Exports are capped at 5,000 rows; a truncated export announces itself via the <code>x-report-truncated</code> header and the runtime log. Cells beginning with <code>= + - @</code> are apostrophe-escaped so spreadsheets cannot execute them as formulas.</p>

        </>
      )}
    </>
  )
}
