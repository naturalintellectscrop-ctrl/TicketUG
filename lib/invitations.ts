import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { z } from 'zod'
import { pool, withTransaction } from './db'
import { canManageMemberRole, canManageOrganizer } from './organizer-authorization'
import type { TicketUGContext, TicketUGRole } from './request-context'

export const invitationInput = z.object({
  email: z.string().email().max(320),
  role: z.enum(['ORGANIZER_MANAGER', 'EVENT_STAFF']),
})

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function createInvitation(context: TicketUGContext, organizerId: string, input: z.infer<typeof invitationInput>) {
  const actor = context.organizerMemberships.find((membership) => membership.organizerId === organizerId)
  if (!actor || !canManageOrganizer(context, organizerId) || !canManageMemberRole(actor.role, input.role as TicketUGRole)) throw new Error('FORBIDDEN')
  const rawToken = randomBytes(32).toString('base64url')
  const result = await pool.query(
    `INSERT INTO ticketug.organizer_invitation (id, organizer_id, invited_email, role, invited_by, token_hash, expires_at)
     VALUES ($1, $2, lower($3), $4, $5, $6, now() + interval '7 days')
     RETURNING id, expires_at`,
    [randomUUID(), organizerId, input.email, input.role, context.profileId, hashToken(rawToken)],
  )
  return { ...result.rows[0], token: rawToken }
}

export async function acceptInvitation(context: TicketUGContext, token: string) {
  return withTransaction(async (client) => {
    const invitation = await client.query(
      `SELECT id, organizer_id, role, expires_at, status FROM ticketug.organizer_invitation WHERE token_hash = $1 FOR UPDATE`,
      [hashToken(token)],
    )
    const row = invitation.rows[0]
    if (!row || row.status !== 'PENDING' || new Date(row.expires_at) <= new Date()) throw new Error('INVITATION_INVALID')
    await client.query(
      `INSERT INTO ticketug.organizer_member (id, organizer_id, user_profile_id, role, status, invited_by)
       VALUES ($1, $2, $3, $4, 'ACTIVE', (SELECT invited_by FROM ticketug.organizer_invitation WHERE id = $5))
       ON CONFLICT (organizer_id, user_profile_id) DO UPDATE SET role = EXCLUDED.role, status = 'ACTIVE', updated_at = now()`,
      [randomUUID(), row.organizer_id, context.profileId, row.role, row.id],
    )
    await client.query(`UPDATE ticketug.organizer_invitation SET status = 'ACCEPTED', accepted_at = now(), accepted_by = $1, updated_at = now() WHERE id = $2`, [context.profileId, row.id])
    return { organizerId: row.organizer_id, role: row.role }
  })
}
