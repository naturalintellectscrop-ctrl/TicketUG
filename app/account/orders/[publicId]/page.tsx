import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getAuthSession } from '@/lib/auth'
import { pool } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function OrderDetailPage({ params }: { params: Promise<{ publicId: string }> }) {
  const session = await getAuthSession()
  if (!session?.user) redirect('/sign-in')
  const { publicId } = await params
  const result = await pool.query<{ id: string; order_number: string; status: string; purchaser_name: string; purchaser_email: string; total_minor_units: string; currency: string; created_at: string }>('SELECT o.id, o.order_number, o.status, o.purchaser_name, o.purchaser_email, o.total_minor_units, o.currency, o.created_at FROM ticketug.order o JOIN ticketug.user_profile p ON p.id=o.user_profile_id WHERE o.public_id=$1 AND p.auth_user_id=$2', [publicId, session.user.id])
  const order = result.rows[0]
  if (!order) notFound()
  const items = (await pool.query<{ ticket_name_snapshot: string; quantity: number; unit_price_minor_units: string; line_total_minor_units: string }>('SELECT ticket_name_snapshot, quantity, unit_price_minor_units, line_total_minor_units FROM ticketug.order_item WHERE order_id=$1 ORDER BY created_at', [order.id])).rows
  return <main className="auth-page stack"><Link href="/account/orders">Orders</Link><p className="eyebrow">{order.order_number}</p><h1>Order details</h1><section className="surface"><p>Status: {order.status}</p><p>Purchaser: {order.purchaser_name} · {order.purchaser_email}</p><p>Created: {new Date(order.created_at).toLocaleString('en-UG')}</p></section>{items.map((item) => <section className="surface row-between" key={item.ticket_name_snapshot}><div><h2>{item.ticket_name_snapshot}</h2><p>{item.quantity} × {Number(item.unit_price_minor_units).toLocaleString('en-UG')} {order.currency}</p></div><strong>{Number(item.line_total_minor_units).toLocaleString('en-UG')} {order.currency}</strong></section>)}<section className="surface row-between"><strong>Total</strong><strong>{Number(order.total_minor_units).toLocaleString('en-UG')} {order.currency}</strong></section></main>
}
