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

/**
 * Pure acceptability decision shared by acceptance paths: the invitation must
 * exist, still be PENDING, and not be past its expiry. Throws the same
 * machine-readable errors the HTTP routes map to 400 responses.
 */
export function assertInvitationAcceptable(
  row: { status: string; expires_at: Date | string } | undefined,
  now: Date = new Date(),
) {
  if (!row || row.status !== 'PENDING') throw new Error('INVITATION_INVALID')
  if (new Date(row.expires_at) <= now) throw new Error('INVITATION_INVALID')
}

/**
 * Pure invited-email binding decision: invitations may only be consumed by the
 * account they were addressed to (case-insensitive, whitespace-tolerant).
 */
export function invitationEmailMatches(invitedEmail: string | null | undefined, userEmail: string | null | undefined) {
  const invited = invitedEmail?.trim().toLowerCase()
  const user = userEmail?.trim().toLowerCase()
  return Boolean(invited && user && invited === user)
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

export type InvitationListRow = {
  id: string
  invited_email: string
  role: string
  status: string
  expires_at: string
  accepted_at: string | null
  invitedByName: string | null
  expired: boolean
}

/** Owner/manager view of this organizer's invitations (most recent 50). */
export async function listInvitations(context: TicketUGContext, organizerId: string): Promise<InvitationListRow[]> {
  if (!canManageOrganizer(context, organizerId)) throw new Error('FORBIDDEN')
  const result = await pool.query(
    `SELECT i.id, i.invited_email, i.role, i.status, i.expires_at, i.accepted_at, up.display_name AS "invitedByName"
     FROM ticketug.organizer_invitation i
     LEFT JOIN ticketug.user_profile up ON up.id = i.invited_by
     WHERE i.organizer_id = $1
     ORDER BY i.expires_at DESC
     LIMIT 50`,
    [organizerId],
  )
  const now = Date.now()
  return result.rows.map((row) => ({ ...row, expired: row.status === 'PENDING' && new Date(row.expires_at).getTime() <= now }))
}

/**
 * Revoke a pending invitation.
 *
 * The organizer_invitation table lives outside the tracked migrations, so its
 * exact status CHECK constraint is unknown; revocation therefore expires the
 * invitation in place (expires_at = now()) instead of introducing a new status
 * value. Acceptance already rejects expired invitations, so the token dies
 * immediately and idempotently, with only columns proven to exist.
 */
export async function revokeInvitation(context: TicketUGContext, organizerId: string, invitationId: string) {
  const actor = context.organizerMemberships.find((membership) => membership.organizerId === organizerId)
  if (!actor || !canManageOrganizer(context, organizerId)) throw new Error('FORBIDDEN')
  const existing = await pool.query(
    `SELECT role FROM ticketug.organizer_invitation WHERE id = $1 AND organizer_id = $2`,
    [invitationId, organizerId],
  )
  const row = existing.rows[0]
  if (!row) throw new Error('INVITATION_INVALID')
  if (!canManageMemberRole(actor.role, row.role as TicketUGRole)) throw new Error('FORBIDDEN')
  const result = await pool.query(
    `UPDATE ticketug.organizer_invitation SET expires_at = now(), updated_at = now()
     WHERE id = $1 AND organizer_id = $2 AND status = 'PENDING' AND expires_at > now()`,
    [invitationId, organizerId],
  )
  if (!result.rowCount) throw new Error('INVITATION_INVALID')
  return { revoked: true as const }
}

export async function acceptInvitation(context: TicketUGContext, token: string, userEmail: string | null | undefined) {
  return withTransaction(async (client) => {
    const invitation = await client.query(
      `SELECT id, organizer_id, invited_email, role, expires_at, status FROM ticketug.organizer_invitation WHERE token_hash = $1 FOR UPDATE`,
      [hashToken(token)],
    )
    const row = invitation.rows[0]
    assertInvitationAcceptable(row)
    if (!invitationEmailMatches(row.invited_email, userEmail)) throw new Error('INVITATION_EMAIL_MISMATCH')
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
