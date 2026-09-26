import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTicketUGContext } from '@/lib/request-context'
import { pool } from '@/lib/db'
import { OrganizerOnboarding } from '@/components/organizer-onboarding'

const ROLE_LABELS: Record<string, string> = {
  ORGANIZER_OWNER: 'Owner',
  ORGANIZER_MANAGER: 'Manager',
  EVENT_STAFF: 'Event staff',
}

export default async function OrganizerPage() {
  const context = await getTicketUGContext()
  if (!context) redirect('/sign-in')
  const result = await pool.query(
    `SELECT o.id, o.name, o.slug, om.role FROM ticketug.organizer o JOIN ticketug.organizer_member om ON om.organizer_id = o.id WHERE om.user_profile_id = $1 AND om.status = 'ACTIVE' ORDER BY o.name`,
    [context.profileId],
  )

  return (
    <main className="page-shell">
      <p className="eyebrow">Organizer</p>
      <h1>Your workspaces</h1>
      <p className="lede">Everything you organise lives here — the team behind it, the events you run, and the settings that shape its identity.</p>
      {result.rows.length ? (
        <div className="stack">
          {result.rows.map((organizer) => (
            <article className="surface workspace-card" key={organizer.id}>
              <div className="row-between">
                <div>
                  <h2>{organizer.name}</h2>
                  <p className="workspace-meta"><code className="slug-chip">{organizer.slug}</code></p>
                </div>
                <span className="role-badge" data-role={organizer.role}>{ROLE_LABELS[organizer.role] ?? organizer.role}</span>
              </div>
              <div className="row workspace-links">
                <Link href={`/organizer/${organizer.id}/events`} className="button button-primary">Manage events</Link>
                <Link href={`/organizer/${organizer.id}/members`} className="button button-quiet">Manage team</Link>
                <Link href={`/organizer/${organizer.id}/settings`} className="button button-quiet">Workspace settings</Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <OrganizerOnboarding />
      )}
    </main>
  )
}
