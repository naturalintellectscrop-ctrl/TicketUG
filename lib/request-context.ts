import { getSupabaseServerClient } from './supabase/server'
import { pool } from './db'

export type TicketUGRole =
  | 'ATTENDEE'
  | 'ORGANIZER_OWNER'
  | 'ORGANIZER_MANAGER'
  | 'EVENT_STAFF'
  | 'PLATFORM_SUPPORT'
  | 'PLATFORM_ADMIN'
  | 'SUPER_ADMIN'

const TICKET_UG_ROLES: ReadonlySet<string> = new Set<TicketUGRole>([
  'ATTENDEE', 'ORGANIZER_OWNER', 'ORGANIZER_MANAGER', 'EVENT_STAFF',
  'PLATFORM_SUPPORT', 'PLATFORM_ADMIN', 'SUPER_ADMIN',
])

// Runtime guard for DB-sourced role strings: a ticketug.organizer_member.role
// or ticketug.platform_role.role value that is not in the union is DROPPED
// (never widened into an authorization input). Authorization lists are checked
// against these union values, so an unknown DB role must never pass as one.
export function isTicketUGRole(value: unknown): value is TicketUGRole {
  return typeof value === 'string' && TICKET_UG_ROLES.has(value)
}

export type TicketUGContext = {
  authUserId: string
  /** Session email when the auth user has one; optional so hand-built fixtures stay valid. */
  authEmail?: string | null
  profileId: string
  roles: TicketUGRole[]
  organizerMemberships: Array<{ organizerId: string; role: TicketUGRole; status: string }>
}

export async function getTicketUGContext(): Promise<TicketUGContext | null> {
  const supabase = await getSupabaseServerClient()
  // getUser() validates the session with Supabase Auth (refreshing it
  // server-side when expired) — the raw cookie is never trusted unvalidated.
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } }
  const authUserId = data.user?.id
  if (!authUserId) return null

  const client = await pool.connect()
  try {
    const profileResult = await client.query(
      `SELECT id FROM ticketug.user_profile WHERE auth_user_id = $1 LIMIT 1`,
      [authUserId],
    )
    if (!profileResult.rows[0]) return null

    const [memberships, platformRoleRows] = await Promise.all([
      client.query(
        `SELECT organizer_id, role, status FROM ticketug.organizer_member WHERE user_profile_id = $1 AND status = 'ACTIVE'`,
        [profileResult.rows[0].id],
      ),
      client.query(`SELECT role FROM ticketug.platform_role WHERE user_profile_id = $1`, [profileResult.rows[0].id]),
    ])

    const membershipRoles = memberships.rows
      .map((row) => row.role)
      .filter(isTicketUGRole)
    const platformRoles = platformRoleRows.rows
      .map((row) => row.role)
      .filter(isTicketUGRole)
    const roles = Array.from(new Set<TicketUGRole>(['ATTENDEE', ...membershipRoles, ...platformRoles]))

    return {
      authUserId,
      authEmail: data.user?.email ?? null,
      profileId: profileResult.rows[0].id,
      roles,
      organizerMemberships: memberships.rows
        .filter((row) => isTicketUGRole(row.role))
        .map((row) => ({
          organizerId: row.organizer_id,
          role: row.role,
          status: row.status,
        })),
    }
  } finally {
    client.release()
  }
}

export async function requireTicketUGContext() {
  const context = await getTicketUGContext()
  if (!context) throw new Error('UNAUTHENTICATED')
  return context
}
