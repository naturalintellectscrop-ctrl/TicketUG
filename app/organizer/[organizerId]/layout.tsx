import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { ConsoleChrome, type ConsoleNavSection } from '@/components/console/console-chrome'
import { pool } from '@/lib/db'
import { getTicketUGContext } from '@/lib/request-context'
import { logServerError } from '@/lib/server/errors'

export const metadata: Metadata = {
  title: 'Organizer console — Ticket Uganda',
  description: 'Manage your Ticket Uganda organizer workspace.',
  robots: { index: false, follow: false },
}

const ROLE_LABELS: Record<string, string> = {
  ORGANIZER_OWNER: 'Owner',
  ORGANIZER_MANAGER: 'Manager',
  EVENT_STAFF: 'Event staff',
}

/**
 * The gate for the whole organizer workspace area, evaluated server-side on
 * every request: no session → sign-in; a session without an ACTIVE membership
 * in THIS workspace → the workspaces hub. The layout only establishes the
 * workspace context and shell — per-page authorization (owner/manager-only
 * checks inside pages) stays exactly where it was, untouched.
 */
export default async function OrganizerLayout({ children, params }: { children: ReactNode; params: Promise<{ organizerId: string }> }) {
  const { organizerId } = await params
  const context = await getTicketUGContext()
  if (!context) redirect('/sign-in')

  let workspace: { id: string; name: string; slug: string; role: string } | null = null
  try {
    const result = await pool.query<{ id: string; name: string; slug: string; role: string }>(
      `SELECT o.id, o.name, o.slug, m.role
         FROM ticketug.organizer o
         JOIN ticketug.organizer_member m ON m.organizer_id = o.id
        WHERE o.id = $1 AND m.user_profile_id = $2 AND m.status = 'ACTIVE'`,
      [organizerId, context.profileId],
    )
    workspace = result.rows[0] ?? null
  } catch (error) {
    // Cannot verify membership → no access. Honest denial beats rendering a
    // workspace surface on an unverifiable claim.
    logServerError('layout:organizer-workspace', error)
  }
  if (!workspace) redirect('/organizer')

  const nav: ConsoleNavSection[] = [
    { items: [{ href: `/organizer/${organizerId}/events`, label: 'Events', icon: 'events' }] },
    {
      label: 'Workspace',
      items: [
        { href: `/organizer/${organizerId}/members`, label: 'Team', icon: 'team' },
        { href: `/organizer/${organizerId}/settings`, label: 'Settings', icon: 'settings' },
        { href: `/organizer/${organizerId}/api`, label: 'API & Webhooks', icon: 'key' },
      ],
    },
  ]

  return (
    <ConsoleChrome
      nav={nav}
      contextLabel={workspace.name}
      contextHref={`/organizer/${organizerId}/events`}
      sideTag={`/${workspace.slug}`}
      roleLabel={ROLE_LABELS[workspace.role] ?? workspace.role}
    >
      {children}
    </ConsoleChrome>
  )
}
