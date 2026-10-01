/**
 * Platform control-center authorization gate.
 *
 * Every /platform page renders through the platform layout, which calls
 * requirePlatformContext() — the SAME server-side session + role resolution
 * used by every other protected surface (getTicketUGContext → Supabase Auth
 * session validated server-side, roles read from ticketug.platform_role).
 *
 * No session → sign-in. Session without a platform role → their own account
 * home (never a 404 that leaks the area's existence, never an error page).
 * The layout gate is defense in depth: pages that load data re-check through
 * the same context, and no /platform route performs mutations at all.
 */
import { redirect } from 'next/navigation'
import { getTicketUGContext, type TicketUGContext } from '@/lib/request-context'

export const PLATFORM_ROLES = ['PLATFORM_SUPPORT', 'PLATFORM_ADMIN', 'SUPER_ADMIN'] as const

export type PlatformRole = (typeof PLATFORM_ROLES)[number]

export const PLATFORM_ROLE_LABELS: Record<PlatformRole, string> = {
  SUPER_ADMIN: 'Super admin',
  PLATFORM_ADMIN: 'Platform admin',
  PLATFORM_SUPPORT: 'Platform support',
}

export function platformRoleOf(context: TicketUGContext): PlatformRole {
  // Highest privilege first — a profile holding several platform roles is
  // surfaced under the strongest one it holds.
  for (const role of ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'PLATFORM_SUPPORT'] as const) {
    if (context.roles.includes(role)) return role
  }
  throw new Error('platformRoleOf called without a platform role')
}

export async function requirePlatformContext(): Promise<{ context: TicketUGContext; role: PlatformRole }> {
  const context = await getTicketUGContext()
  if (!context) redirect('/sign-in')
  const role = PLATFORM_ROLES.find((candidate) => context.roles.includes(candidate))
  if (!role) redirect('/account')
  return { context, role }
}
