// Pure gate-enforcement decisions for the check-in flow. Deliberately free of
// DB dependencies so the scanner module (lib/server/check-ins.ts), the
// behavioral harness and these unit tests execute the identical rules.
// Pair 6: the removed NestJS check-ins module previously duplicated this file.

export type GateScanDecision = { allowed: true } | { allowed: false; outcome: 'GATE_NOT_PERMITTED' }

/**
 * Does this staff assignment let its holder scan at all?
 *  - Event-wide assignment (gateId null) is the pre-gate behavior: yes.
 *  - A gate-scoped assignment grants scanning only while its gate exists and
 *    is ACTIVE. A disabled or deleted gate never grants scanning (fail-closed;
 *    deletion removes the assignment row entirely via ON DELETE CASCADE).
 */
export function assignmentGrantsScanning(assignment: { gateId: string | null; gateActive: boolean | null }): boolean {
  if (assignment.gateId === null) return true
  return assignment.gateActive === true
}

/**
 * Server-side gate authorization for one scan. The scanner's gate comes from
 * the authenticated staff member's assignment row — NEVER from the client.
 *  - Event-wide scanners (assignmentGateId null) are not gate-filtered.
 *  - Gate-scoped scanners may only check in tickets whose ticket type is
 *    explicitly permitted through that gate (active gates only). A ticket type
 *    with no gate permissions on an event that has active gates is rejected
 *    everywhere — fail-closed until the organizer completes the mapping.
 */
export function gateAllowsTicketType(assignmentGateId: string | null, permittedGateIds: readonly string[]): GateScanDecision {
  if (assignmentGateId === null) return { allowed: true }
  return permittedGateIds.includes(assignmentGateId) ? { allowed: true } : { allowed: false, outcome: 'GATE_NOT_PERMITTED' }
}
