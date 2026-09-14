import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getAuthSession } from '@/lib/auth'
import { pool } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function OrganizerOrdersPage({ params }: { params: Promise<{ organizerId: string; eventId: string }> }) {
  const session = await getAuthSession()
  if (!session?.user) redirect('/sign-in')
  const { organizerId, eventId } = await params
  const access = await pool.query<{ id: string }>('SELECT e.id FROM ticketug.event e WHERE e.id=$1 AND e.organizer_id=$2 AND EXISTS (SELECT 1 FROM ticketug.organizer_member m JOIN ticketug.user_profile p ON p.id=m.user_profile_id WHERE m.organizer_id=$2 AND p.auth_user_id=$3 AND m.status=\'ACTIVE\' AND m.role IN (\'ORGANIZER_OWNER\',\'ORGANIZER_MANAGER\'))', [eventId, organizerId, session.user.id])
  if (!access.rows[0]) notFound()
  const orders = (await pool.query<{ public_id: string; order_number: string; purchaser_name: string; purchaser_email: string; status: string; total_minor_units: string; currency: string; created_at: string }>('SELECT DISTINCT o.public_id, o.order_number, o.purchaser_name, o.purchaser_email, o.status, o.total_minor_units, o.currency, o.created_at FROM ticketug.order o JOIN ticketug.order_item oi ON oi.order_id=o.id JOIN ticketug.ticket_type t ON t.id=oi.ticket_type_id WHERE t.event_id=$1 ORDER BY o.created_at DESC', [eventId])).rows
  return <main className="auth-page stack"><Link href={`/organizer/${organizerId}/events/${eventId}`}>Event</Link><p className="eyebrow">Order operations</p><h1>Event orders</h1>{orders.length ? orders.map((order) => <Link className="surface row-between" key={order.public_id} href={`/organizer/${organizerId}/events/${eventId}/orders/${order.public_id}`}><div><h2>{order.order_number}</h2><p>{order.purchaser_name} · {order.purchaser_email}</p><p>{new Date(order.created_at).toLocaleString('en-UG')}</p></div><div><strong>{Number(order.total_minor_units).toLocaleString('en-UG')} {order.currency}</strong><p>{order.status}</p></div></Link>) : <section className="surface"><p>No orders yet.</p></section>}</main>
}
