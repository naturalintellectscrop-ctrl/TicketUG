'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Control-center navigation. Client component only because the active state
 * needs the live pathname; every page it links to is server-rendered and
 * re-gated server-side on every request.
 */
const NAV_ITEMS = [
  { href: '/platform', label: 'Overview', exact: true },
  { href: '/platform/events', label: 'Events' },
  { href: '/platform/organizers', label: 'Organizers' },
  { href: '/platform/users', label: 'Users' },
  { href: '/platform/orders', label: 'Orders' },
  { href: '/platform/payments', label: 'Payments' },
  { href: '/platform/tickets', label: 'Tickets' },
  { href: '/platform/check-ins', label: 'Check-ins' },
  { href: '/platform/audit', label: 'Audit' },
  { href: '/platform/system', label: 'System' },
  { href: '/platform/docs', label: 'Docs' },
]

export function PlatformNav({ roleLabel }: { roleLabel: string }) {
  const pathname = usePathname()
  return (
    <nav className="platform-nav" aria-label="Platform control center">
      <div className="platform-nav-links">
        {NAV_ITEMS.map((item) => {
          const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined}>
              {item.label}
            </Link>
          )
        })}
      </div>
      <span className="platform-nav-role">{roleLabel}</span>
    </nav>
  )
}
