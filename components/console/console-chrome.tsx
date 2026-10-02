'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import {
  Activity,
  BookOpen,
  Building2,
  CalendarRange,
  CreditCard,
  KeyRound,
  Layers,
  LayoutDashboard,
  Menu,
  Plug,
  ReceiptText,
  ScanLine,
  ScrollText,
  Settings,
  Ticket,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { SignOutButton } from '@/components/sign-out-button'

export type ConsoleIconName =
  | 'dashboard' | 'events' | 'orders' | 'payments' | 'tickets' | 'scan'
  | 'organizers' | 'users' | 'audit' | 'system' | 'api' | 'docs'
  | 'team' | 'settings' | 'key' | 'workspaces'

export type ConsoleNavItem = { href: string; label: string; icon: ConsoleIconName }
export type ConsoleNavSection = { label?: string; items: ConsoleNavItem[] }

const ICONS: Record<ConsoleIconName, LucideIcon> = {
  dashboard: LayoutDashboard, events: CalendarRange, orders: ReceiptText, payments: CreditCard,
  tickets: Ticket, scan: ScanLine, organizers: Building2, users: Users, audit: ScrollText,
  system: Activity, api: Plug, docs: BookOpen, team: Users, settings: Settings, key: KeyRound,
  workspaces: Layers,
}

/**
 * The operations-console shell: persistent grouped sidebar + sticky top bar,
 * collapsing to an off-canvas drawer below 960px. Server children pass
 * through untouched — data surfaces stay server-rendered.
 */
export function ConsoleChrome({ nav, contextLabel, contextHref, sideTag, roleLabel, children }: {
  nav: ConsoleNavSection[]
  contextLabel: string
  contextHref?: string
  sideTag?: string
  roleLabel?: string
  children: ReactNode
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const rootHref = nav[0]?.items[0]?.href
  const isActive = (item: ConsoleNavItem) =>
    item.href === rootHref ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)

  const context = contextHref
    ? <Link href={contextHref} className="console-topbar-context"><strong>{contextLabel}</strong></Link>
    : <span className="console-topbar-context"><strong>{contextLabel}</strong></span>

  return (
    <div className="console">
      <aside className="console-sidebar" data-open={open} aria-label="Console navigation">
        <Link href="/" className="brand-mark"><span className="brand-dot" aria-hidden="true" />Ticket Uganda</Link>
        {sideTag && <p className="console-side-tag">{sideTag}</p>}
        <nav>
          {nav.map((section, index) => (
            <div className="console-nav-group" key={section.label ?? `group-${index}`}>
              {section.label && <p className="console-nav-label">{section.label}</p>}
              {section.items.map((item) => {
                const Icon = ICONS[item.icon]
                return (
                  <Link
                    key={`${section.label ?? 'root'}:${item.label}:${item.href}`}
                    href={item.href}
                    className="console-nav-item"
                    aria-current={isActive(item) ? 'page' : undefined}
                    title={item.label}
                    onClick={() => setOpen(false)}
                  >
                    {Icon && <Icon size={15} strokeWidth={2.2} aria-hidden="true" />}
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>
      </aside>

      <div className="console-main">
        <header className="console-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <button type="button" className="console-menu-button" aria-expanded={open} aria-label={open ? 'Close navigation' : 'Open navigation'} onClick={() => setOpen((value) => !value)}>
              <Menu size={17} strokeWidth={2.2} aria-hidden="true" />
            </button>
            {context}
          </div>
          <div className="console-topbar-side">
            {roleLabel && <span className="console-role">{roleLabel}</span>}
            <SignOutButton />
          </div>
        </header>
        <main className="console-content" id="console-main">
          {children}
        </main>
      </div>
    </div>
  )
}
