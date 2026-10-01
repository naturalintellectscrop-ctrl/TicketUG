import Link from 'next/link'
import type { ReactNode } from 'react'
import { getTicketUGContext } from '@/lib/request-context'
import { SignOutButton } from './sign-out-button'

/**
 * Shared session-aware site header.
 *
 * - Always: the brand mark links home, and explicit Home / Events / Contact
 *   links stay reachable — a signed-in user is never left without a way back
 *   to the main page.
 * - Signed out: a Sign in link (honouring `nextPath` for post-auth return) and
 *   a Get started CTA, so account checkout is discoverable from every page.
 * - Signed in: Organizer workspace link (when the session holds any active
 *   membership), Control center (platform roles only — the owner reaches it
 *   from the same header as everyone else, no separate admin URL to type),
 *   sign out, and a My orders CTA.
 * - `children` renders page-local nav links (e.g. landing anchors) before the
 *   session affordances.
 */
export async function SiteHeader({ nextPath, children }: { nextPath?: string; children?: ReactNode }) {
  // Public pages must degrade gracefully: if the session/DB lookup fails, render
  // the anonymous header instead of failing the whole page.
  const context = await getTicketUGContext().catch(() => null)
  const isOrganizer = Boolean(context?.organizerMemberships.some((membership) => membership.status === 'ACTIVE'))
  const isPlatform = Boolean(context?.roles.some((role) => ['PLATFORM_SUPPORT', 'PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(role)))
  const signInHref = nextPath ? `/sign-in?next=${encodeURIComponent(nextPath)}` : '/sign-in'
  const signUpHref = nextPath ? `/sign-up?next=${encodeURIComponent(nextPath)}` : '/sign-up'

  return (
    <header className="site-header page-reveal">
      <Link href="/" className="brand-mark" aria-label="Ticket Uganda home"><span className="brand-dot" />Ticket Uganda</Link>
      <nav className="site-nav" aria-label="Primary navigation">
        {children}
        <Link href="/" className="nav-always nav-home">Home</Link>
        <Link href="/events" className="nav-always">Events</Link>
        <Link href="/contact" className="nav-always">Contact</Link>
        {context ? (
          <>
            {isOrganizer && <Link href="/organizer" className="nav-always">Organizer</Link>}
            {isPlatform && <Link href="/account/control-center" className="nav-always">Control center</Link>}
            <SignOutButton />
            <Link href="/account" className="nav-cta">My orders</Link>
          </>
        ) : (
          <>
            <Link href={signInHref} className="nav-always">Sign in</Link>
            <Link href={signUpHref} className="nav-cta">Get started</Link>
          </>
        )}
      </nav>
    </header>
  )
}
