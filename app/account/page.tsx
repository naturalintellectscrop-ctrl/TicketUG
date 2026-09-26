import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuthSession } from '@/lib/auth'
import { getTicketUGContext } from '@/lib/request-context'
import { SignOutButton } from '@/components/sign-out-button'

export const dynamic = 'force-dynamic'

export default async function AccountPage() {
  const session = await getAuthSession()
  if (!session?.user) redirect('/sign-in')
  const context = await getTicketUGContext()
  const organizer = context?.organizerMemberships.find((membership) => ['ORGANIZER_OWNER', 'ORGANIZER_MANAGER'].includes(membership.role))
  const canUsePlatform = context?.roles.some((role) => ['PLATFORM_SUPPORT', 'PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(role))
  const canScan = context?.roles.includes('EVENT_STAFF') || canUsePlatform
  return <main className="auth-page"><p className="eyebrow">Your TicketUG workspace</p><h1>Welcome, {session.user.name || session.user.email}</h1><p className="lede">Choose the workspace that matches your role. Access is checked again on every protected request.</p><div className="stack">{organizer && <Link className="surface" href={`/organizer/${organizer.organizerId}/events`}><strong>Organizer workspace</strong><p className="muted">Create events, ticket types, and public listings.</p></Link>}{canScan && <Link className="surface" href="/scanner"><strong>Event operations</strong><p className="muted">Validate tickets for assigned events.</p></Link>}{canUsePlatform && <Link className="surface" href="/admin"><strong>Platform control center</strong><p className="muted">Review platform-wide activity and operational status.</p></Link>}<Link className="surface" href="/account/tickets"><strong>My tickets</strong><p className="muted">View tickets issued to your attendee identity.</p></Link></div><div className="row"><SignOutButton /></div></main>
}
