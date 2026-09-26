import Link from 'next/link'
import { redirect } from 'next/navigation'
import { InvitationManager } from '@/components/invitation-manager'
import { pool } from '@/lib/db'
import { listInvitations } from '@/lib/invitations'
import { canManageOrganizer } from '@/lib/organizer-authorization'
import { getTicketUGContext } from '@/lib/request-context'

const ROLE_LABELS: Record<string, string> = {
  ORGANIZER_OWNER: 'Owner',
  ORGANIZER_MANAGER: 'Manager',
  EVENT_STAFF: 'Event staff',
}

export default async function MembersPage({ params }: { params: Promise<{ organizerId: string }> }) {
  const context = await getTicketUGContext()
  if (!context) redirect('/sign-in')
  const { organizerId } = await params
  const membership = context.organizerMemberships.find((entry) => entry.organizerId === organizerId && entry.status === 'ACTIVE')
  if (!membership) redirect('/organizer')
  const organizer = await pool.query(`SELECT o.name FROM ticketug.organizer o WHERE o.id = $1`, [organizerId])
  if (!organizer.rows[0]) redirect('/organizer')
  const members = await pool.query(
    `SELECT om.id, om.role, om.status, om.created_at, up.display_name FROM ticketug.organizer_member om JOIN ticketug.user_profile up ON up.id = om.user_profile_id WHERE om.organizer_id = $1 ORDER BY om.created_at`,
    [organizerId],
  )
  const canManage = canManageOrganizer(context, organizerId)
  const invitations = canManage ? await listInvitations(context, organizerId) : []
  return (
    <main className="page-shell">
      <p><Link href="/organizer" className="text-link">← Organizer workspaces</Link></p>
      <p className="eyebrow">Team</p>
      <h1>{organizer.rows[0].name}</h1>
      <p className="lede">Everyone with access to this workspace, plus the invitations on their way in.</p>
      <div className="stack">
        <section className="surface stack" aria-label="Team members">
          <div className="row-between"><div><p className="eyebrow">Roster</p><h2>Members</h2></div><span className="muted">{members.rows.length} active workspace{members.rows.length === 1 ? '' : 's'}</span></div>
          <div className="invite-rows">
            {members.rows.map((member) => (
              <article className="invite-row" key={member.id}>
                <div>
                  <span className="invite-email">{member.display_name ?? 'Unnamed member'}</span>
                  <span className="invite-meta">{ROLE_LABELS[member.role] ?? member.role} · joined {new Date(member.created_at).toLocaleDateString('en-UG', { dateStyle: 'medium' })}</span>
                </div>
                <span className="status-pill" data-status={member.status}>{member.status === 'ACTIVE' ? 'Active' : member.status}</span>
              </article>
            ))}
          </div>
        </section>
        {canManage && <InvitationManager organizerId={organizerId} actorRole={membership.role} initialInvitations={invitations} />}
        {!canManage && <p className="muted">Only owners and managers can invite or manage team members.</p>}
      </div>
    </main>
  )
}
