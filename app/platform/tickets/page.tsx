import Link from 'next/link'
import { PageHeader } from '@/components/console/page-head'
import { Pagination, StatusPill, UnavailablePanel, stateTone } from '@/components/platform/ui'
import { listPlatformTickets, TICKET_STATUSES, PAGE_SIZE } from '@/lib/platform/queries'
import { buildFilterQuery, clampPage, formatDateTime, labelOf, TICKET_STATUS_LABELS } from '@/lib/platform/format'

export const dynamic = 'force-dynamic'

type SearchParams = { q?: string; status?: string; page?: string }

/** Platform-wide ticket investigation. Ticket credential and credential-hash
 * columns are intentionally never selected or rendered anywhere in this
 * console: the QR payload is the thing a gate scanner verifies, and showing
 * it here would turn the control center into a ticket forge. */
export default async function PlatformTicketsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const q = params.q?.trim() ?? ''
  const page = clampPage(Number(params.page) || 1, Number.MAX_SAFE_INTEGER, PAGE_SIZE)
  const result = await listPlatformTickets({ q, status: params.status, page })

  return (
    <>
      <PageHeader
        crumb="Operations"
        title="Tickets"
        lede="Every ticket with its order, event and entry state. QR payloads and credential hashes are never displayed in this console — validity is decided by the scanner against the registry, not by inspecting codes here."
      />

      <form className="filter-bar" method="get" action="/platform/tickets" role="search">
        <label>Search<input type="search" name="q" defaultValue={q} placeholder="Ticket id, attendee, order number" maxLength={120} /></label>
        <label>Status
          <select name="status" defaultValue={params.status ?? ''}>
            <option value="">All statuses</option>
            {TICKET_STATUSES.map((status) => <option key={status} value={status}>{labelOf(TICKET_STATUS_LABELS, status)}</option>)}
          </select>
        </label>
        <button className="button button-dark" type="submit">Filter</button>
        {result && <span className="filter-count">{result.total.toLocaleString('en-UG')} tickets</span>}
      </form>

      {result === null ? (
        <UnavailablePanel what="The ticket list" />
      ) : result.rows.length === 0 ? (
        <p className="muted empty-state">{q || params.status ? 'No tickets match these filters.' : 'No tickets have been issued yet.'}</p>
      ) : (
        <>
          <div className="platform-scroll">
            <table className="platform-table">
              <thead><tr><th scope="col">Ticket</th><th scope="col">Event</th><th scope="col">Attendee</th><th scope="col">Tier</th><th scope="col">Order</th><th scope="col">Status</th><th scope="col">Issued</th></tr></thead>
              <tbody>
                {result.rows.map((ticket) => (
                  <tr key={ticket.publicId}>
                    <td>{ticket.publicId}</td>
                    <td><Link href={`/platform/events/${ticket.eventPublicId}`}>{ticket.eventTitle}</Link></td>
                    <td>{ticket.attendeeName}<span className="table-cell-sub">{ticket.attendeeEmail}</span></td>
                    <td>{ticket.ticketTypeName}</td>
                    <td><Link href={`/platform/orders/${ticket.orderPublicId}`}>{ticket.orderNumber}</Link></td>
                    <td><StatusPill tone={stateTone(ticket.status)}>{labelOf(TICKET_STATUS_LABELS, ticket.status)}</StatusPill></td>
                    <td>{formatDateTime(ticket.issuedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={result.total} baseHref={`/platform/tickets${buildFilterQuery({ q, status: params.status })}`} />
        </>
      )}
    </>
  )
}
