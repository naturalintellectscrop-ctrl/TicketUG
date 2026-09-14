import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTicketUGContext } from '@/lib/request-context'
import { pool } from '@/lib/db'
import { OrganizerOnboarding } from '@/components/organizer-onboarding'

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
      <h1>Build your organizer workspace</h1>
      <p className="lede">Create a workspace now. Events and ticketing arrive in later phases.</p>
      {result.rows.length ? <div className="stack">{result.rows.map((organizer) => <article className="surface" key={organizer.id}><h2>{organizer.name}</h2><p>{organizer.role}</p><div className="row-between"><Link href={`/organizer/${organizer.id}/members`}>Manage team</Link><Link href={`/organizer/${organizer.id}/events`}>Manage events</Link></div></article>)}</div> : <OrganizerOnboarding />}
    </main>
  )
}
