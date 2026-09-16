import { redirect } from 'next/navigation'
import { getTicketUGContext } from '@/lib/request-context'
import { pool } from '@/lib/db'

export default async function MembersPage({ params }: { params: Promise<{ organizerId: string }> }) {
  const context = await getTicketUGContext()
  if (!context) redirect('/sign-in')
  const { organizerId } = await params
  const organizer = await pool.query(`SELECT o.name FROM ticketug.organizer o JOIN ticketug.organizer_member om ON om.organizer_id = o.id WHERE o.id = $1 AND om.user_profile_id = $2 AND om.status = 'ACTIVE'`, [organizerId, context.profileId])
  if (!organizer.rows[0]) redirect('/organizer')
  const members = await pool.query(`SELECT up.display_name, om.role, om.status FROM ticketug.organizer_member om JOIN ticketug.user_profile up ON up.id = om.user_profile_id WHERE om.organizer_id = $1 ORDER BY om.created_at`, [organizerId])
  return <main className="page-shell"><p className="eyebrow">Team</p><h1>{organizer.rows[0].name}</h1><div className="stack">{members.rows.map((member) => <article className="surface" key={`${member.display_name}-${member.role}`}><strong>{member.display_name ?? 'Unnamed member'}</strong><span>{member.role} · {member.status}</span></article>)}</div></main>
}
