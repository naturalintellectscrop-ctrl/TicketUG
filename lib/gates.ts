import { z } from 'zod'

// Pure input rules for organizer gate management (Pair 1B). Transactional SQL
// lives in the route handlers; this module keeps the decisions testable and the
// authorization entirely on the existing canManageOrganizer ladder — no second
// authorization system.

export const gateCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).default(''),
})

export const gateUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).optional(),
  isActive: z.boolean().optional(),
})

export const gateTicketTypesSchema = z.object({
  ticketTypeIds: z.array(z.string().uuid()).max(200),
})

export const staffAssignmentSchema = z.object({
  userProfileId: z.string().uuid(),
  // Optional gate scope: null/omitted keeps the legacy event-wide assignment.
  gateId: z.string().uuid().nullable().optional(),
})

export type GateDiff = { toAdd: string[]; toRemove: string[] }

// Replace-set semantics for ticket-type ↔ gate permissions: compute the delta
// between the persisted rows and the requested set in one pure step so the
// transaction only applies the difference.
export function diffGateTicketTypes(current: readonly string[], next: readonly string[]): GateDiff {
  const currentSet = new Set(current)
  const nextSet = new Set(next)
  return {
    toAdd: next.filter((id) => !currentSet.has(id)),
    toRemove: current.filter((id) => !nextSet.has(id)),
  }
}
