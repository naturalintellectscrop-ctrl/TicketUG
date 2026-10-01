import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { SiteHeader } from '@/components/site-header'
import { PlatformNav } from '@/components/platform/platform-nav'
import { PLATFORM_ROLE_LABELS, requirePlatformContext } from '@/lib/platform/guard'

export const metadata: Metadata = {
  title: 'Platform control center — Ticket Uganda',
  description: 'Operational control center for the Ticket Uganda platform.',
  robots: { index: false, follow: false },
}

/**
 * The gate for the whole /platform area, evaluated server-side on every
 * request: no session → sign-in; a session without a platform role → their
 * own account home. Nothing below this layout renders for anyone else, and
 * the area is read-only end to end — investigation and monitoring only.
 */
export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const { role } = await requirePlatformContext()
  return (
    <>
      <SiteHeader />
      <PlatformNav roleLabel={PLATFORM_ROLE_LABELS[role]} />
      {children}
    </>
  )
}
