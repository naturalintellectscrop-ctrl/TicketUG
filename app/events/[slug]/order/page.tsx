import { notFound } from 'next/navigation'
import Link from 'next/link'
import { pool } from '@/lib/db'
import { getTicketUGContext } from '@/lib/request-context'
import { getAuthSession } from '@/lib/auth'
import { OrderForm } from './order-form'
import { AccountOrderForm } from '@/components/account-order-form'

export const dynamic = 'force-dynamic'

export default async function PublicOrderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const event = (await pool.query<{ id: string; title: string }>('SELECT id, title FROM ticketug.event WHERE slug=$1 AND publication_state=\'PUBLIC\' AND discoverable=true', [slug])).rows[0]
  if (!event) notFound()
  const tickets = (await pool.query<{ public_id: string; name: string; price_minor_units: string; currency: string; remaining_capacity: number }>('SELECT public_id, name, price_minor_units, currency, remaining_capacity FROM ticketug.ticket_type WHERE event_id=$1 AND active=true ORDER BY sort_order, created_at', [event.id])).rows
  const context = await getTicketUGContext()
  if (context) {
    const session = await getAuthSession()
    return <main className="auth-page">
      <p className="eyebrow">Order request</p>
      <h1>{event.title}</h1>
      <p className="lede">Create an order now. Payment will be added in a later phase.</p>
      <section className="surface stack" aria-label="Signed-in checkout">
        <div className="row-between"><span className="muted">Ordering as</span><strong>{session?.user?.name || session?.user?.email}</strong></div>
        <p className="muted">This order attaches to your TicketUG account — you will find it under <Link className="text-link" href="/account/orders">My orders</Link> with live payment status, no access key required.</p>
      </section>
      <AccountOrderForm tickets={tickets} buyer={{ name: session?.user?.name ?? '', email: session?.user?.email ?? '' }} />
    </main>
  }
  return <main className="auth-page">
    <p className="eyebrow">Order request</p>
    <h1>{event.title}</h1>
    <p className="lede">Create an order now. Payment will be added in a later phase.</p>
    <section className="surface stack" aria-label="Account option">
      <div className="row-between"><span className="muted">Have an account?</span><Link className="button button-quiet" href={`/sign-in?next=${encodeURIComponent(`/events/${slug}/order`)}`}>Sign in</Link></div>
      <p className="muted">Signed-in buyers keep orders on their profile with saved tickets — no order link to look after.</p>
    </section>
    <OrderForm tickets={tickets} />
  </main>
}
