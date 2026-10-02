import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageHeader, SectionHead } from '@/components/console/page-head'
import { StatusPill, stateTone } from '@/components/platform/ui'
import { loadPlatformOrganizerDetail } from '@/lib/platform/queries'
import { formatDateTime, labelOf, LIFECYCLE_LABELS } from '@/lib/platform/format'

export const dynamic = 'force-dynamic'

const MEMBER_ROLE_LABELS: Record<string, string> = {
  ORGANIZER_OWNER: 'Owner',
  ORGANIZER_MANAGER: 'Manager',
  ORGANIZER_STAFF: 'Staff',
}

/** One workspace, platform-side: identity, team, invitations, events, venues.
 * No organizer-scoped mutation exists here — team and event operations remain
 * behind the workspace's own authorization. */
export default async function PlatformOrganizerDetailPage({ params }: { params: Promise<{ organizerId: string }> }) {
  const { organizerId } = await params
  const detail = await loadPlatformOrganizerDetail(organizerId)
  if (!detail) notFound()
  const { organizer, members, invitations, events, venues } = detail

  return (
    <>
      <PageHeader
        crumb="Organizers"
        title={organizer.name}
        lede={`/${organizer.slug} · Created ${formatDateTime(organizer.createdAt)}${organizer.createdByEmail ? ` by ${organizer.createdByEmail}` : ''}`}
        actions={
          <>
            <Link className="button button-quiet" href="/platform/organizers">All organizers</Link>
            <Link className="button button-dark" href={`/platform/events?q=${encodeURIComponent(organizer.name)}`}>Events</Link>
          </>
        }
      />

      <section className="console-section" aria-label="Team members" style={{ marginTop: 0 }}>
        <SectionHead title="Members" note="Team" />
        {members.length === 0 ? <p className="muted empty-state">No members — an empty workspace.</p> : (
          <div className="platform-scroll">
            <table className="platform-table">
              <thead><tr><th scope="col">Member</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Since</th></tr></thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.profileId}>
                    <td><Link href={`/platform/users/${member.profileId}`}>{member.displayName || member.email || 'Unnamed profile'}</Link><span className="table-cell-sub">{member.email ?? 'no auth email'}</span></td>
                    <td>{labelOf(MEMBER_ROLE_LABELS, member.role)}</td>
                    <td><StatusPill tone={member.status === 'ACTIVE' ? 'ok' : 'warn'}>{member.status}</StatusPill></td>
                    <td>{formatDateTime(member.since)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="console-section" aria-label="Recent invitations">
        <SectionHead title="Recent invitations" note="Access" />
        {invitations.length === 0 ? <p className="muted empty-state">No invitations sent from this workspace.</p> : (
          <div className="platform-scroll">
            <table className="platform-table">
              <thead><tr><th scope="col">Email</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Expires</th><th scope="col">Sent</th></tr></thead>
              <tbody>
                {invitations.map((invitation) => (
                  <tr key={invitation.id}>
                    <td>{invitation.invitedEmail}</td>
                    <td>{labelOf(MEMBER_ROLE_LABELS, invitation.role)}</td>
                    <td><StatusPill tone={invitation.status === 'ACCEPTED' ? 'ok' : invitation.status === 'PENDING' ? 'info' : 'warn'}>{invitation.status}</StatusPill></td>
                    <td>{formatDateTime(invitation.expiresAt)}</td>
                    <td>{formatDateTime(invitation.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="console-section" aria-label="Workspace events">
        <SectionHead title="Events" note="Programme" />
        {events.length === 0 ? <p className="muted empty-state">This workspace has not created events yet.</p> : (
          <div className="platform-scroll">
            <table className="platform-table">
              <thead><tr><th scope="col">Event</th><th scope="col">Visibility</th><th scope="col">Lifecycle</th><th scope="col" className="num">Tickets</th><th scope="col">Starts</th></tr></thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.publicId}>
                    <td><Link href={`/platform/events/${event.publicId}`}>{event.title}</Link></td>
                    <td><StatusPill tone={event.publicationState === 'PUBLIC' ? 'ok' : 'info'}>{event.publicationState === 'PUBLIC' ? 'Public' : 'Private'}</StatusPill></td>
                    <td><StatusPill tone={stateTone(event.lifecycleState)}>{labelOf(LIFECYCLE_LABELS, event.lifecycleState)}</StatusPill></td>
                    <td className="num">{event.ticketsIssued.toLocaleString('en-UG')}</td>
                    <td>{formatDateTime(event.startsAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="console-section" aria-label="Saved venues">
        <SectionHead title="Venues" note="Places" />
        {venues.length === 0 ? <p className="muted empty-state">No venues saved.</p> : (
          <div className="platform-scroll">
            <table className="platform-table">
              <thead><tr><th scope="col">Venue</th><th scope="col">City</th><th scope="col" className="num">Events held</th></tr></thead>
              <tbody>
                {venues.map((venue) => (
                  <tr key={venue.id}>
                    <td>{venue.name}</td>
                    <td>{venue.city ?? '—'}</td>
                    <td className="num">{venue.eventCount.toLocaleString('en-UG')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
