import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { withTransaction } from './db'
import { canManageMemberRole } from './organizer-authorization'
import type { TicketUGContext, TicketUGRole } from './request-context'

export const memberRoleInput = z.object({
  role: z.enum(['ORGANIZER_MANAGER', 'EVENT_STAFF']),
})

/**
 * Pure removal decision. Managers and staff may leave the workspace on their
 * own; owners cannot — ownership transfer does not exist yet, so an owner seat
 * can never walk out the door and orphan the workspace. Acting on someone
 * else always flows through the shared authority ladder.
 */
export function assertMemberRemoval(actorRole: TicketUGRole, targetRole: TicketUGRole, options: { self: boolean }) {
  if (options.self) {
    if (actorRole === 'ORGANIZER_OWNER') throw new Error('OWNER_CANNOT_LEAVE')
    return
  }
  if (!canManageMemberRole(actorRole, targetRole)) throw new Error('FORBIDDEN')
}

/**
 * Pure role-change decision: the actor needs authority over both the target's
 * current role and the granted role. Nobody can raise a member above their own
 * level, self role-changes are inherently rejected by the ladder (a role never
 * manages itself), and owner seats stay untouchable.
 */
export function assertMemberRoleChange(actorRole: TicketUGRole, targetRole: TicketUGRole, nextRole: TicketUGRole) {
  if (!canManageMemberRole(actorRole, targetRole) || !canManageMemberRole(actorRole, nextRole)) throw new Error('FORBIDDEN')
}

type MemberRow = { id: string; user_profile_id: string; role: string; status: string }

async function loadMemberForUpdate(
  client: Parameters<Parameters<typeof withTransaction>[0]>[0],
  organizerId: string,
  memberId: string,
): Promise<MemberRow> {
  const result = await client.query(
    `SELECT id, user_profile_id, role, status FROM ticketug.organizer_member WHERE id = $1 AND organizer_id = $2 FOR UPDATE`,
    [memberId, organizerId],
  )
  const row: MemberRow | undefined = result.rows[0]
  if (!row || row.status !== 'ACTIVE') throw new Error('MEMBER_NOT_FOUND')
  return row
}

/**
 * Guard against orphaning a workspace without an active owner. Unreachable
 * through the pure decisions above (owner seats are untouchable), kept as
 * defense-in-depth for any future caller that relaxes the authority ladder.
 */
async function assertNotLastOwner(
  client: Parameters<Parameters<typeof withTransaction>[0]>[0],
  organizerId: string,
  memberId: string,
) {
  const result = await client.query(
    `SELECT count(*)::int AS owners FROM ticketug.organizer_member
      WHERE organizer_id = $1 AND role = 'ORGANIZER_OWNER' AND status = 'ACTIVE' AND id <> $2`,
    [organizerId, memberId],
  )
  if (!result.rows[0]?.owners) throw new Error('LAST_OWNER')
}

async function recordMembershipChange(
  client: Parameters<Parameters<typeof withTransaction>[0]>[0],
  userProfileId: string,
) {
  await client.query(`INSERT INTO ticketug.security_event (id, user_profile_id, event_type) VALUES ($1, $2, 'MEMBERSHIP_CHANGED')`, [
    randomUUID(),
    userProfileId,
  ])
}

/**
 * Remove a team member (or let a non-owner member remove themselves).
 *
 * Removal DELETEs the row instead of writing a status flag: the
 * organizer_member DDL lives outside the tracked migrations, so the exact
 * status CHECK constraint is unknown — the same caution that keeps invitation
 * revocation from introducing new status values. Access disappears
 * immediately because the session context only loads ACTIVE memberships, and
 * re-invitation restores membership through the proven upsert path.
 */
export async function removeMember(context: TicketUGContext, organizerId: string, memberId: string) {
  return withTransaction(async (client) => {
    const actor = context.organizerMemberships.find((membership) => membership.organizerId === organizerId)
    if (!actor) throw new Error('FORBIDDEN')
    const member = await loadMemberForUpdate(client, organizerId, memberId)
    assertMemberRemoval(actor.role, member.role as TicketUGRole, { self: member.user_profile_id === context.profileId })
    if (member.role === 'ORGANIZER_OWNER') await assertNotLastOwner(client, organizerId, memberId)
    await client.query(`DELETE FROM ticketug.organizer_member WHERE id = $1 AND organizer_id = $2`, [memberId, organizerId])
    await recordMembershipChange(client, member.user_profile_id)
    return { removed: true as const }
  })
}

export async function changeMemberRole(context: TicketUGContext, organizerId: string, memberId: string, nextRole: TicketUGRole) {
  return withTransaction(async (client) => {
    const actor = context.organizerMemberships.find((membership) => membership.organizerId === organizerId)
    if (!actor) throw new Error('FORBIDDEN')
    const member = await loadMemberForUpdate(client, organizerId, memberId)
    assertMemberRoleChange(actor.role, member.role as TicketUGRole, nextRole)
    if (member.role === 'ORGANIZER_OWNER') await assertNotLastOwner(client, organizerId, memberId)
    if (member.role !== nextRole) {
      await client.query(
        `UPDATE ticketug.organizer_member SET role = $1, updated_at = now() WHERE id = $2 AND organizer_id = $3 AND status = 'ACTIVE'`,
        [nextRole, memberId, organizerId],
      )
      await recordMembershipChange(client, member.user_profile_id)
    }
    return { member: { id: member.id, user_profile_id: member.user_profile_id, role: nextRole, status: member.status } }
  })
}

// Membership writes always ride with a MEMBERSHIP_CHANGED security event so the
// audit trail matches the create-organizer precedent in app/api/organizers/route.ts.
