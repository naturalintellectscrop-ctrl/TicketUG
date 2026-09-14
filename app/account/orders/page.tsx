import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getAuthSession } from '@/lib/auth'
import { pool } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function OrdersPage() {
  const session = await getAuthSession()
  if (!session?.user) redirect('/sign-in')
  const profile = await pool.query<{ id: string }>('SELECT id FROM ticketug.user_profile WHERE auth_user_id=$1 LIMIT 1', [session.user.id])
  const orders = profile.rows[0] ? (await pool.query<{ public_id: string; order_number: string; status: string; total_minor_units: string; currency: string; created_at: string }>('SELECT public_id, order_number, status, total_minor_units, currency, created_at FROM ticketug.order WHERE user_profile_id=$1 ORDER BY created_at DESC', [profile.rows[0].id])).rows : []
  return <main className="auth-page stack"><Link href="/account">Account</Link><p className="eyebrow">Purchase history</p><h1>Your orders</h1>{orders.length ? orders.map((order) => <Link className="surface row-between" key={order.public_id} href={`/account/orders/${order.public_id}`}><div><h2>{order.order_number}</h2><p>{new Date(order.created_at).toLocaleString('en-UG')}</p></div><div><strong>{Number(order.total_minor_units).toLocaleString('en-UG')} {order.currency}</strong><p>{order.status}</p></div></Link>) : <section className="surface"><p>No orders yet.</p></section>}</main>
}
