import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuthSession } from '@/lib/auth'
import { pool } from '@/lib/db'

export const dynamic = 'force-dynamic'
export default async function TicketsPage() {
  const session = await getAuthSession(); if (!session?.user) redirect('/sign-in')
  const profile = await pool.query<{ id: string }>('SELECT id FROM ticketug.user_profile WHERE auth_user_id=$1 LIMIT 1', [session.user.id])
  const tickets = profile.rows[0] ? (await pool.query<{ public_id: string; event_title_snapshot: string; event_starts_at: string; venue_name_snapshot: string | null; ticket_type_name_snapshot: string; status: string }>('SELECT public_id,event_title_snapshot,event_starts_at,venue_name_snapshot,ticket_type_name_snapshot,status FROM ticketug.ticket WHERE owner_profile_id=$1 ORDER BY event_starts_at DESC', [profile.rows[0].id])).rows : []
  return <main className="auth-page stack"><Link href="/account">Account</Link><p className="eyebrow">Your admission credentials</p><h1>My tickets</h1>{tickets.length ? tickets.map((ticket) => <Link className="surface row-between" href={`/account/tickets/${ticket.public_id}`} key={ticket.public_id}><div><h2>{ticket.event_title_snapshot}</h2><p>{ticket.ticket_type_name_snapshot} · {new Date(ticket.event_starts_at).toLocaleString('en-UG')}</p><p>{ticket.venue_name_snapshot ?? 'Venue to be announced'}</p></div><strong>{ticket.status}</strong></Link>) : <section className="surface"><p>No tickets have been issued to this account yet.</p></section>}</main>
}
