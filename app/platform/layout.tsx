import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { ConsoleChrome, type ConsoleNavSection } from '@/components/console/console-chrome'
import { PLATFORM_ROLE_LABELS, requirePlatformContext } from '@/lib/platform/guard'

export const metadata: Metadata = {
  title: 'Platform control center — Ticket Uganda',
  description: 'Operational control center for the Ticket Uganda platform.',
  robots: { index: false, follow: false },
}

const PLATFORM_NAV: ConsoleNavSection[] = [
  { items: [{ href: '/platform', label: 'Overview', icon: 'dashboard' }] },
  {
    label: 'Operations',
    items: [
      { href: '/platform/events', label: 'Events', icon: 'events' },
      { href: '/platform/orders', label: 'Orders', icon: 'orders' },
      { href: '/platform/payments', label: 'Payments', icon: 'payments' },
      { href: '/platform/tickets', label: 'Tickets', icon: 'tickets' },
      { href: '/platform/check-ins', label: 'Check-ins', icon: 'scan' },
    ],
  },
  {
    label: 'Directory',
    items: [
      { href: '/platform/organizers', label: 'Organizers', icon: 'organizers' },
      { href: '/platform/users', label: 'Users', icon: 'users' },
    ],
  },
  {
    label: 'Platform',
    items: [
      { href: '/platform/audit', label: 'Audit', icon: 'audit' },
      { href: '/platform/system', label: 'System', icon: 'system' },
      { href: '/platform/api', label: 'API & Integrations', icon: 'api' },
    ],
  },
  { label: 'Resources', items: [{ href: '/platform/docs', label: 'Docs', icon: 'docs' }] },
]

/**
 * The gate for the whole /platform area, evaluated server-side on every
 * request: no session → sign-in; a session without a platform role → their
 * own account home. Nothing below this layout renders for anyone else, and
 * the area is read-only end to end — investigation and monitoring only.
 */
export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const { role } = await requirePlatformContext()
  return (
    <ConsoleChrome
      nav={PLATFORM_NAV}
      contextLabel="Control center"
      sideTag="Platform operations"
      roleLabel={PLATFORM_ROLE_LABELS[role]}
    >
      {children}
    </ConsoleChrome>
  )
}
