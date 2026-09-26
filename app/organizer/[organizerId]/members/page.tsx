import Link from 'next/link'
import { redirect } from 'next/navigation'
import { InvitationManager } from '@/components/invitation-manager'
import { RosterManager, type MemberRow } from '@/components/roster-manager'
import { pool } from '@/lib/db'
import { listInvitations } from '@/lib/invitations'
import { canManageOrganizer } from '@/lib/organizer-authorization'
import { getTicketUGContext } from '@/lib/request-context'

export default async function MembersPage({ params }: { params: Promise<{ organizerId: string }> }) {
  const context = await getTicketUGContext()
  if (!context) redirect('/sign-in')
  const { organizerId } = await params
  const membership = context.organizerMemberships.find((entry) => entry.organizerId === organizerId && entry.status === 'ACTIVE')
  if (!membership) redirect('/organizer')
  const organizer = await pool.query(`SELECT o.name FROM ticketug.organizer o WHERE o.id = $1`, [organizerId])
  if (!organizer.rows[0]) redirect('/organizer')
  const members = await pool.query(
    `SELECT om.id, om.user_profile_id, om.role, om.status, om.created_at, up.display_name FROM ticketug.organizer_member om JOIN ticketug.user_profile up ON up.id = om.user_profile_id WHERE om.organizer_id = $1 ORDER BY om.created_at`,
    [organizerId],
  )
  const roster: MemberRow[] = members.rows.map((member) => ({
    id: member.id,
    user_profile_id: member.user_profile_id,
    display_name: member.display_name,
    role: member.role,
    status: member.status,
    created_at: new Date(member.created_at).toISOString(),
  }))
  const canManage = canManageOrganizer(context, organizerId)
  const invitations = canManage ? await listInvitations(context, organizerId) : []
  return (
    <main className="page-shell">
      <p><Link href="/organizer" className="text-link">← Organizer workspaces</Link> · <Link href={`/organizer/${organizerId}/settings`} className="text-link">Workspace settings</Link></p>
      <p className="eyebrow">Team</p>
      <h1>{organizer.rows[0].name}</h1>
      <p className="lede">Everyone with access to this workspace, plus the invitations on their way in.</p>
      <div className="stack">
        <section className="surface stack" aria-label="Team members">
          <div className="row-between"><div><p className="eyebrow">Roster</p><h2>Members</h2></div><span className="muted">{roster.length} {roster.length === 1 ? 'member' : 'members'}</span></div>
          <RosterManager organizerId={organizerId} actorRole={membership.role} selfProfileId={context.profileId} initialMembers={roster} />
        </section>
        {canManage && <InvitationManager organizerId={organizerId} actorRole={membership.role} initialInvitations={invitations} />}
      </div>
    </main>
  )
}
