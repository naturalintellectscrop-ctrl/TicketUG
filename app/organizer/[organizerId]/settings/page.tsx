import Link from 'next/link'
import { redirect } from 'next/navigation'
import { WorkspaceRenameForm } from '@/components/workspace-rename-form'
import { pool } from '@/lib/db'
import { getTicketUGContext } from '@/lib/request-context'

export default async function OrganizerSettingsPage({ params }: { params: Promise<{ organizerId: string }> }) {
  const context = await getTicketUGContext()
  if (!context) redirect('/sign-in')
  const { organizerId } = await params
  const membership = context.organizerMemberships.find((entry) => entry.organizerId === organizerId && entry.status === 'ACTIVE')
  if (!membership) redirect('/organizer')
  const organizer = await pool.query(`SELECT o.id, o.name, o.slug, o.created_at FROM ticketug.organizer o WHERE o.id = $1`, [organizerId])
  if (!organizer.rows[0]) redirect('/organizer')
  const workspace = organizer.rows[0]
  const [members, events] = await Promise.all([
    pool.query(`SELECT count(*)::int AS total FROM ticketug.organizer_member WHERE organizer_id = $1 AND status = 'ACTIVE'`, [organizerId]),
    pool.query(`SELECT count(*)::int AS total FROM ticketug.event WHERE organizer_id = $1`, [organizerId]),
  ])
  const isOwner = membership.role === 'ORGANIZER_OWNER'
  return (
    <main className="page-shell">
      <p><Link href={`/organizer/${organizerId}/members`} className="text-link">← Team</Link> · <Link href="/organizer" className="text-link">Organizer workspaces</Link></p>
      <p className="eyebrow">Workspace settings</p>
      <h1>{workspace.name}</h1>
      <p className="lede">The identity of this workspace across events, tickets, and public pages.</p>
      <div className="stack">
        <section className="surface stack" aria-label="Workspace details" style={{ marginTop: 0 }}>
          <div className="row-between"><div><p className="eyebrow">Overview</p><h2>Details</h2></div></div>
          <div className="settings-meta">
            <div className="settings-meta-row"><span>Workspace name</span><strong>{workspace.name}</strong></div>
            <div className="settings-meta-row"><span>Slug (permanent)</span><code className="slug-chip">{workspace.slug}</code></div>
            <div className="settings-meta-row"><span>Created</span><span>{new Date(workspace.created_at).toLocaleDateString('en-UG', { dateStyle: 'medium' })}</span></div>
            <div className="settings-meta-row"><span>Active members</span><span>{members.rows[0].total}</span></div>
            <div className="settings-meta-row"><span>Events</span><span>{events.rows[0].total}</span></div>
          </div>
        </section>
        <section className="surface stack" aria-label="Rename workspace">
          <div className="row-between"><div><p className="eyebrow">Identity</p><h2>Rename workspace</h2></div></div>
          {isOwner ? (
            <>
              <p className="muted">The new name applies everywhere the workspace appears. The slug is permanent — public URLs keep working exactly as before.</p>
              <WorkspaceRenameForm organizerId={organizerId} initialName={workspace.name} />
            </>
          ) : (
            <p className="muted">Only the workspace owner can rename this workspace.</p>
          )}
        </section>
      </div>
    </main>
  )
}
