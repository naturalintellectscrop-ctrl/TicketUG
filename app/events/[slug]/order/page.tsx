import { notFound } from 'next/navigation'
import { pool } from '@/lib/db'
import { OrderForm } from './order-form'

export const dynamic = 'force-dynamic'

export default async function PublicOrderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const event = (await pool.query<{ id: string; title: string }>('SELECT id, title FROM ticketug.event WHERE slug=$1 AND publication_state=\'PUBLIC\' AND discoverable=true', [slug])).rows[0]
  if (!event) notFound()
  const tickets = (await pool.query<{ public_id: string; name: string; price_minor_units: string; currency: string; remaining_capacity: number }>('SELECT public_id, name, price_minor_units, currency, remaining_capacity FROM ticketug.ticket_type WHERE event_id=$1 AND active=true ORDER BY sort_order, created_at', [event.id])).rows
  return <main className="auth-page"><p className="eyebrow">Order request</p><h1>{event.title}</h1><p className="lede">Create an order now. Payment will be added in a later phase.</p><OrderForm tickets={tickets} /></main>
}
