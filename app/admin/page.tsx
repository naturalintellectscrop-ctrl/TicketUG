import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTicketUGContext } from '@/lib/request-context'
import { pool } from '@/lib/db'

export const dynamic = 'force-dynamic'

type Metrics = { users: number; organizers: number; events: number; published: number; orders: number; tickets: number; checkIns: number }

const emptyMetrics: Metrics = { users: 0, organizers: 0, events: 0, published: 0, orders: 0, tickets: 0, checkIns: 0 }

async function loadMetrics(): Promise<Metrics> {
  try {
    const result = await pool.query<Metrics>(`SELECT
      (SELECT count(*)::int FROM ticketug.user_profile) AS users,
      (SELECT count(*)::int FROM ticketug.organizer) AS organizers,
      (SELECT count(*)::int FROM ticketug.event) AS events,
      (SELECT count(*)::int FROM ticketug.event WHERE publication_state='PUBLIC' AND lifecycle_state IN ('PUBLISHED','SALES_OPEN')) AS published,
      (SELECT count(*)::int FROM ticketug.order) AS orders,
      (SELECT count(*)::int FROM ticketug.ticket) AS tickets,
      (SELECT count(*)::int FROM ticketug.check_in) AS "checkIns"`)
    return result.rows[0] ?? emptyMetrics
  } catch {
    return emptyMetrics
  }
}

const cards: Array<[keyof Metrics, string, string]> = [
  ['users', 'Users', 'Identity profiles'],
  ['organizers', 'Organizers', 'Workspaces'],
  ['events', 'Events', 'All lifecycle states'],
  ['published', 'Published', 'Public and discoverable'],
  ['orders', 'Orders', 'Checkout activity'],
  ['tickets', 'Tickets', 'Issued credentials'],
  ['checkIns', 'Check-ins', 'Verified entry'],
]

export default async function AdminPage() {
  const context = await getTicketUGContext()
  if (!context) redirect('/sign-in')
  if (!context.roles.some((role) => ['PLATFORM_SUPPORT', 'PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(role))) redirect('/account')
  const metrics = await loadMetrics()
  const isSuperAdmin = context.roles.includes('SUPER_ADMIN')

  return <main className="page-shell">
    <header className="section-heading">
      <div><p className="eyebrow">TicketUG control center</p><h1>Platform overview</h1><p className="lede">A platform-wide view of real users, organizers, events, orders, tickets, and entry activity.</p></div>
      <div className="row-between"><span className="status-pill">{isSuperAdmin ? 'Super admin' : 'Platform support'}</span><Link href="/account">My account</Link></div>
    </header>
    <nav className="surface admin-nav" aria-label="Platform areas">
      <Link className="active" href="/admin">Overview</Link><span>Users</span><span>Organizers</span><span>Events</span><span>Orders</span><span>Tickets</span><span className="muted">Payments · unavailable</span>
    </nav>
    <section className="metric-grid" aria-label="Platform metrics">
      {cards.map(([key, label, description]) => <article className="surface metric-card" key={key}><p className="eyebrow">{label}</p><strong>{metrics[key].toLocaleString('en-UG')}</strong><p className="muted">{description}</p></article>)}
    </section>
    <section className="admin-columns">
      <article className="surface stack"><div><p className="eyebrow">Operational status</p><h2>What is available now</h2></div><div className="status-list"><p><span className="status-dot ready" /> Events and public discovery</p><p><span className="status-dot ready" /> Test payment and ticket issuance</p><p><span className="status-dot ready" /> QR validation and check-in</p><p><span className="status-dot planned" /> Live payments, refunds, settlements</p></div></article>
      <article className="surface stack"><div><p className="eyebrow">Governance</p><h2>Safe by role</h2></div><p className="muted">This control center is protected server-side. Organizer, attendee, and staff roles cannot access platform administration by changing a URL.</p><Link href="/scanner">Open operations scanner</Link></article>
    </section>
  </main>
}
