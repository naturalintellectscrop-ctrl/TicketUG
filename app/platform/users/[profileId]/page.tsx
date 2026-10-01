import Link from 'next/link'
import { notFound } from 'next/navigation'
import { StatusPill, stateTone } from '@/components/platform/ui'
import { loadPlatformUserDetail } from '@/lib/platform/queries'
import { formatDateTime, formatMoney, labelOf, ORDER_PAYMENT_STATE_LABELS, TICKET_STATUS_LABELS } from '@/lib/platform/format'

export const dynamic = 'force-dynamic'

/** One identity, end to end: auth account, platform roles, workspace
 * memberships, staff assignments, purchases, held tickets, scanner activity
 * and recorded security events. Read-only by design — the platform's only
 * role-granting tool is the audited provisioning script, not a web form. */
export default async function PlatformUserDetailPage({ params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await params
  const detail = await loadPlatformUserDetail(profileId)
  if (!detail) notFound()
  const { profile, platformRoles, memberships, staffAssignments, orders, tickets, checkIns, audit } = detail

  return (
    <main className="platform-shell">
      <p><Link href="/platform/users" className="text-link">← All users</Link></p>
      <header className="section-heading">
        <div>
          <p className="eyebrow">Identity profile · {profile.id.slice(0, 8)}…</p>
          <h1>{profile.displayName || profile.email || 'Unnamed profile'}</h1>
          <p className="lede">{profile.email ?? 'No auth identity linked'}{profile.emailConfirmed ? '' : ' · email not confirmed'}</p>
        </div>
      </header>

      <section className="platform-section">
        <div className="admin-columns">
          <article className="surface stack">
            <p className="eyebrow">Account</p>
            <dl className="def-list">
              <div><dt>Auth account created</dt><dd>{formatDateTime(profile.authCreatedAt)}</dd></div>
              <div><dt>Profile created</dt><dd>{formatDateTime(profile.createdAt)}</dd></div>
              <div><dt>Last sign-in</dt><dd>{profile.lastSignInAt ? formatDateTime(profile.lastSignInAt) : 'never'}</dd></div>
              <div><dt>Profile phone</dt><dd>{profile.phone ?? '—'}</dd></div>
              <div><dt>Delivery contact</dt><dd>{profile.deliveryEmail ?? profile.deliveryPhone ?? '—'}</dd></div>
            </dl>
          </article>
          <article className="surface stack">
            <p className="eyebrow">Platform roles</p>
            {platformRoles.length === 0 ? <p className="muted">No platform roles — an ordinary identity.</p> : platformRoles.map((role) => (
              <div className="row-between" key={role.role}><StatusPill tone="brand">{role.role}</StatusPill><span className="muted">granted {formatDateTime(role.grantedAt)}</span></div>
            ))}
            <p className="muted">Roles are granted only through the audited provisioning script; every grant writes a security event.</p>
          </article>
        </div>
      </section>

      <section className="platform-section">
        <div className="section-heading"><div><p className="eyebrow">Access</p><h2>Workspaces &amp; assignments</h2></div></div>
        <div className="admin-columns">
          <article className="surface stack">
            <p className="eyebrow">Organizer memberships</p>
            {memberships.length === 0 ? <p className="muted">None.</p> : memberships.map((membership) => (
              <div className="row-between" key={membership.organizerId + membership.role}>
                <span><Link href={`/platform/organizers/${membership.organizerId}`}>{membership.organizerName}</Link><span className="table-cell-sub">{membership.role.replace('ORGANIZER_', '')} · since {formatDateTime(membership.since)}</span></span>
                <StatusPill tone={membership.status === 'ACTIVE' ? 'ok' : 'warn'}>{membership.status}</StatusPill>
              </div>
            ))}
          </article>
          <article className="surface stack">
            <p className="eyebrow">Event staff assignments</p>
            {staffAssignments.length === 0 ? <p className="muted">None.</p> : staffAssignments.map((assignment, index) => (
              <div className="row-between" key={`${assignment.eventId}-${index}`}>
                <span><Link href={`/platform/events/${assignment.eventId}`}>{assignment.eventTitle}</Link>{assignment.gateName && <span className="table-cell-sub">Gate: {assignment.gateName}</span>}</span>
                <StatusPill tone={assignment.status === 'ACTIVE' ? 'ok' : 'info'}>{assignment.status}</StatusPill>
              </div>
            ))}
          </article>
        </div>
      </section>

      <section className="platform-section">
        <div className="section-heading"><div><p className="eyebrow">Commerce</p><h2>Orders &amp; tickets</h2></div></div>
        <div className="admin-columns">
          <article className="surface stack">
            <p className="eyebrow">Orders placed</p>
            {orders.length === 0 ? <p className="muted">No orders.</p> : orders.map((order) => (
              <div className="row-between" key={order.publicId}>
                <span><Link href={`/platform/orders/${order.publicId}`}>{order.orderNumber}</Link><span className="table-cell-sub">{formatDateTime(order.createdAt)}</span></span>
                <span><strong>{formatMoney(Number(order.totalMinorUnits))}</strong> <StatusPill tone={stateTone(order.paymentState)}>{labelOf(ORDER_PAYMENT_STATE_LABELS, order.paymentState)}</StatusPill></span>
              </div>
            ))}
          </article>
          <article className="surface stack">
            <p className="eyebrow">Tickets held</p>
            {tickets.length === 0 ? <p className="muted">No tickets.</p> : tickets.map((ticket) => (
              <div className="row-between" key={ticket.publicId}>
                <span>{ticket.eventTitle}<span className="table-cell-sub">issued {formatDateTime(ticket.issuedAt)}</span></span>
                <StatusPill tone={stateTone(ticket.status)}>{labelOf(TICKET_STATUS_LABELS, ticket.status)}</StatusPill>
              </div>
            ))}
          </article>
        </div>
      </section>

      <section className="platform-section">
        <div className="section-heading"><div><p className="eyebrow">Activity</p><h2>Scanner history &amp; security events</h2></div></div>
        <div className="admin-columns">
          <article className="surface stack">
            <p className="eyebrow">Check-ins performed</p>
            {checkIns.length === 0 ? <p className="muted">This identity has never scanned at a gate.</p> : checkIns.map((checkIn, index) => (
              <div className="row-between" key={index}><span>{checkIn.eventTitle}</span><span className="muted">{formatDateTime(checkIn.checkedInAt)}</span></div>
            ))}
          </article>
          <article className="surface stack">
            <p className="eyebrow">Recorded security events</p>
            {audit.length === 0 ? <p className="muted">No security events reference this profile.</p> : audit.map((event, index) => (
              <div className="row-between" key={index}><StatusPill tone="info">{event.eventType}</StatusPill><span className="muted">{formatDateTime(event.createdAt)}</span></div>
            ))}
          </article>
        </div>
      </section>
    </main>
  )
}
