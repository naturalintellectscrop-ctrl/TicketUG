import { z } from 'zod'
import { pool } from './db'
import type { TicketUGContext } from './request-context'

export const organizerRenameInput = z.object({
  name: z.string().trim().min(2).max(120),
})

/**
 * Rename a workspace. Owner-only: the workspace name is the organizer's brand
 * across events, tickets, and public pages — a step above day-to-day manager
 * work. The slug is deliberately immutable (public URLs and long-lived
 * references depend on it), and no security_event is written: the event_type
 * column's CHECK constraint is unknown beyond the proven MEMBERSHIP_CHANGED,
 * and inventing a new value could fail at runtime (same caution as membership
 * status flags). The organizer table has no proven updated_at column, so the
 * update touches only the name.
 */
export async function renameOrganizer(context: TicketUGContext, organizerId: string, name: string) {
  const actor = context.organizerMemberships.find((membership) => membership.organizerId === organizerId)
  if (!actor || actor.role !== 'ORGANIZER_OWNER') throw new Error('FORBIDDEN')
  const result = await pool.query(
    `UPDATE ticketug.organizer SET name = $1 WHERE id = $2 RETURNING id, name, slug`,
    [name, organizerId],
  )
  if (!result.rows[0]) throw new Error('ORGANIZER_NOT_FOUND')
  return result.rows[0]
}
