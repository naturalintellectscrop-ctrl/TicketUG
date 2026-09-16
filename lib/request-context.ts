import { cookies } from 'next/headers'
import { auth } from './auth'
import { pool } from './db'

export type TicketUGRole =
  | 'ATTENDEE'
  | 'ORGANIZER_OWNER'
  | 'ORGANIZER_MANAGER'
  | 'EVENT_STAFF'
  | 'PLATFORM_SUPPORT'
  | 'PLATFORM_ADMIN'
  | 'SUPER_ADMIN'

export type TicketUGContext = {
  authUserId: string
  profileId: string
  roles: TicketUGRole[]
  organizerMemberships: Array<{ organizerId: string; role: TicketUGRole; status: string }>
}

export async function getTicketUGContext(): Promise<TicketUGContext | null> {
  const cookieHeader = (await cookies()).toString()
  const session = await auth.getSession({ fetchOptions: { headers: { cookie: cookieHeader } } })
  const authUserId = session?.data?.user?.id
  if (!authUserId) return null

  const client = await pool.connect()
  try {
    const profileResult = await client.query(
      `SELECT id FROM ticketug.user_profile WHERE auth_user_id = $1 LIMIT 1`,
      [authUserId],
    )
    if (!profileResult.rows[0]) return null

    const [memberships, platformRoles] = await Promise.all([
      client.query(
        `SELECT organizer_id, role, status FROM ticketug.organizer_member WHERE user_profile_id = $1 AND status = 'ACTIVE'`,
        [profileResult.rows[0].id],
      ),
      client.query(`SELECT role FROM ticketug.platform_role WHERE user_profile_id = $1`, [profileResult.rows[0].id]),
    ])

    const membershipRoles = memberships.rows.map((row) => row.role as TicketUGRole)
    const roles = Array.from(new Set<TicketUGRole>(['ATTENDEE', ...membershipRoles, ...platformRoles.rows.map((row) => row.role)]))

    return {
      authUserId,
      profileId: profileResult.rows[0].id,
      roles,
      organizerMemberships: memberships.rows.map((row) => ({
        organizerId: row.organizer_id,
        role: row.role as TicketUGRole,
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
