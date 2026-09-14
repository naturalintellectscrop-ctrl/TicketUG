import { redirect } from 'next/navigation'
import { getAuthSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function AccountPage() {
  const session = await getAuthSession()
  if (!session?.user) redirect('/sign-in')
  return <main className="auth-page"><p className="eyebrow">Authenticated attendee</p><h1>Welcome, {session.user.name || session.user.email}</h1><p>Your TicketUG identity is active. Account features will be added in a later phase.</p></main>
}
