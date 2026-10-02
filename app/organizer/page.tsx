import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ConsoleChrome, type ConsoleNavSection } from '@/components/console/console-chrome'
import { PageHeader } from '@/components/console/page-head'
import { getTicketUGContext } from '@/lib/request-context'
import { pool } from '@/lib/db'
import { OrganizerOnboarding } from '@/components/organizer-onboarding'

const ROLE_LABELS: Record<string, string> = {
  ORGANIZER_OWNER: 'Owner',
  ORGANIZER_MANAGER: 'Manager',
  EVENT_STAFF: 'Event staff',
}

/**
 * The organizer workspaces hub — sits OUTSIDE the [organizerId] workspace
 * layout because it spans every workspace the member belongs to. It renders
 * the console shell directly, one nav entry per ACTIVE membership.
 */
export default async function OrganizerPage() {
  const context = await getTicketUGContext()
  if (!context) redirect('/sign-in')
  const result = await pool.query<{ id: string; name: string; slug: string; role: string }>(
    `SELECT o.id, o.name, o.slug, om.role FROM ticketug.organizer o JOIN ticketug.organizer_member om ON om.organizer_id = o.id WHERE om.user_profile_id = $1 AND om.status = 'ACTIVE' ORDER BY o.name`,
    [context.profileId],
  )

  const nav: ConsoleNavSection[] = []
  if (result.rows.length) {
    nav.push({
      items: result.rows.map((organizer) => ({
        href: `/organizer/${organizer.id}/events`,
        label: organizer.name,
        icon: 'workspaces' as const,
      })),
    })
  }
  nav.push({
    label: 'Account',
    items: [
      { href: '/account/tickets', label: 'My tickets', icon: 'tickets' },
      { href: '/account/orders', label: 'My orders', icon: 'orders' },
      { href: '/scanner', label: 'Scanner', icon: 'scan' },
    ],
  })

  return (
    <ConsoleChrome nav={nav} contextLabel="Your workspaces">
      <PageHeader
        crumb="Organizer"
        title="Workspaces"
        lede="Everything you organise lives here — the team behind it, the events you run, and the settings that shape its identity."
      />
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
        <section className="surface stack" aria-label="Create a workspace">
          <OrganizerOnboarding />
        </section>
      )}
    </ConsoleChrome>
  )
}
