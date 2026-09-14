import { redirect } from 'next/navigation'
import { ProfileEditor } from '@/components/profile-editor'
import { getTicketUGContext } from '@/lib/request-context'
import { pool } from '@/lib/db'

export default async function ProfilePage() {
  const context = await getTicketUGContext()
  if (!context) redirect('/sign-in')
  const result = await pool.query(
    `SELECT up.display_name, up.phone, ap.delivery_email, ap.delivery_phone
       FROM ticketug.user_profile up
       LEFT JOIN ticketug.attendee_profile ap ON ap.user_profile_id = up.id
      WHERE up.id = $1`,
    [context.profileId],
  )
  return (
    <main className="page-shell">
      <p className="eyebrow">Account</p>
      <h1>Complete your TicketUG profile</h1>
      <p className="lede">Keep only the contact information needed for ticket delivery and support.</p>
      <ProfileEditor initial={result.rows[0] ?? { displayName: '' }} />
    </main>
  )
}
