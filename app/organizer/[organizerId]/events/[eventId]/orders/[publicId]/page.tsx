import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getAuthSession } from '@/lib/auth'
import { pool } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function OrganizerOrderDetailPage({ params }: { params: Promise<{ organizerId: string; eventId: string; publicId: string }> }) {
  const session = await getAuthSession()
  if (!session?.user) redirect('/sign-in')
  const { organizerId, eventId, publicId } = await params
  const result = await pool.query<{ id: string; order_number: string; purchaser_name: string; purchaser_email: string; status: string; total_minor_units: string; currency: string; created_at: string }>('SELECT DISTINCT o.id, o.order_number, o.purchaser_name, o.purchaser_email, o.status, o.total_minor_units, o.currency, o.created_at FROM ticketug.order o JOIN ticketug.order_item oi ON oi.order_id=o.id JOIN ticketug.ticket_type t ON t.id=oi.ticket_type_id JOIN ticketug.event e ON e.id=t.event_id JOIN ticketug.user_profile p ON p.auth_user_id=$4 WHERE o.public_id=$1 AND e.id=$2 AND e.organizer_id=$3 AND EXISTS (SELECT 1 FROM ticketug.organizer_member m WHERE m.organizer_id=$3 AND m.user_profile_id=p.id AND m.status=\'ACTIVE\' AND m.role IN (\'ORGANIZER_OWNER\',\'ORGANIZER_MANAGER\'))', [publicId, eventId, organizerId, session.user.id])
  const order = result.rows[0]
  if (!order) notFound()
  const items = (await pool.query<{ ticket_name_snapshot: string; quantity: number; unit_price_minor_units: string; line_total_minor_units: string }>('SELECT ticket_name_snapshot, quantity, unit_price_minor_units, line_total_minor_units FROM ticketug.order_item WHERE order_id=$1 ORDER BY created_at', [order.id])).rows
  return <main className="auth-page stack"><Link href={`/organizer/${organizerId}/events/${eventId}/orders`}>Event orders</Link><p className="eyebrow">{order.order_number}</p><h1>Order detail</h1><section className="surface"><p>Status: {order.status}</p><p>{order.purchaser_name} · {order.purchaser_email}</p><p>{new Date(order.created_at).toLocaleString('en-UG')}</p></section>{items.map((item) => <section className="surface row-between" key={item.ticket_name_snapshot}><div><h2>{item.ticket_name_snapshot}</h2><p>{item.quantity} × {Number(item.unit_price_minor_units).toLocaleString('en-UG')} {order.currency}</p></div><strong>{Number(item.line_total_minor_units).toLocaleString('en-UG')} {order.currency}</strong></section>)}<section className="surface row-between"><strong>Total</strong><strong>{Number(order.total_minor_units).toLocaleString('en-UG')} {order.currency}</strong></section></main>
}
