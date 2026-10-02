import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { PageHeader } from '@/components/console/page-head'
import { StatusPill, UnavailablePanel, stateTone } from '@/components/platform/ui'
import { getAuthSession } from '@/lib/auth'
import { pool } from '@/lib/db'
import { logServerError } from '@/lib/server/errors'
import { labelOf, ORDER_PAYMENT_STATE_LABELS } from '@/lib/platform/format'

export const dynamic = 'force-dynamic'

const LIST_LIMIT = 200

type OrderRow = { public_id: string; order_number: string; purchaser_name: string; purchaser_email: string; status: string; total_minor_units: string; currency: string; created_at: string }

export default async function OrganizerOrdersPage({ params }: { params: Promise<{ organizerId: string; eventId: string }> }) {
  const session = await getAuthSession()
  if (!session?.user) redirect('/sign-in')
  const { organizerId, eventId } = await params
  const access = await pool.query<{ id: string }>('SELECT e.id FROM ticketug.event e WHERE e.id=$1 AND e.organizer_id=$2 AND EXISTS (SELECT 1 FROM ticketug.organizer_member m JOIN ticketug.user_profile p ON p.id=m.user_profile_id WHERE m.organizer_id=$2 AND p.auth_user_id=$3 AND m.status=\'ACTIVE\' AND m.role IN (\'ORGANIZER_OWNER\',\'ORGANIZER_MANAGER\'))', [eventId, organizerId, session.user.id])
  if (!access.rows[0]) notFound()

  // The list and its total share one try block: a database failure must render
  // "unavailable", never a misleading "No orders yet" empty state. The event
  // join can duplicate an order across its items, hence COUNT(DISTINCT o.id).
  let rows: OrderRow[] = []
  let total = 0
  let unavailable = false
  try {
    const [list, count] = await Promise.all([
      pool.query<OrderRow>('SELECT DISTINCT o.public_id, o.order_number, o.purchaser_name, o.purchaser_email, o.status, o.total_minor_units, o.currency, o.created_at FROM ticketug.order o JOIN ticketug.order_item oi ON oi.order_id=o.id JOIN ticketug.ticket_type t ON t.id=oi.ticket_type_id WHERE t.event_id=$1 ORDER BY o.created_at DESC LIMIT 200', [eventId]),
      pool.query<{ total: number }>('SELECT COUNT(DISTINCT o.id)::int AS total FROM ticketug.order o JOIN ticketug.order_item oi ON oi.order_id=o.id JOIN ticketug.ticket_type t ON t.id=oi.ticket_type_id WHERE t.event_id=$1', [eventId]),
    ])
    rows = list.rows
    total = count.rows[0].total
  } catch (error) {
    logServerError('page:organizer-event-orders', error)
    unavailable = true
  }

  return (
    <>
      <PageHeader
        crumb="Orders"
        title="Event orders"
        lede="Every order containing a ticket for this event, newest first."
      />

      {unavailable ? (
        <UnavailablePanel what="Event orders" />
      ) : rows.length ? (
        <>
          {total > LIST_LIMIT && (
            <p className="filter-count" style={{ marginBottom: 10 }}>{total.toLocaleString('en-UG')} orders · showing latest {LIST_LIMIT}</p>
          )}
          <div className="platform-scroll">
            <table className="platform-table">
              <thead><tr><th scope="col">Order</th><th scope="col">Purchaser</th><th scope="col">State</th><th scope="col" className="num">Total</th><th scope="col">Placed</th></tr></thead>
              <tbody>
                {rows.map((order) => (
                  <tr key={order.public_id}>
                    <td><Link href={`/organizer/${organizerId}/events/${eventId}/orders/${order.public_id}`}>{order.order_number}</Link></td>
                    <td>{order.purchaser_name || '—'}<span className="table-cell-sub">{order.purchaser_email}</span></td>
                    <td><StatusPill tone={stateTone(order.status)}>{labelOf(ORDER_PAYMENT_STATE_LABELS, order.status)}</StatusPill></td>
                    <td className="num">{Number(order.total_minor_units).toLocaleString('en-UG')} {order.currency}</td>
                    <td>{new Date(order.created_at).toLocaleString('en-UG')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <section className="surface">
          <p>No orders yet.</p>
        </section>
      )}
    </>
  )
}
