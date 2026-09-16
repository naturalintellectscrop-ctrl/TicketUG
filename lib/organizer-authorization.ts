import type { TicketUGContext, TicketUGRole } from './request-context'

const managementRoles: TicketUGRole[] = ['ORGANIZER_OWNER', 'ORGANIZER_MANAGER']

export function getMembership(context: TicketUGContext, organizerId: string) {
  return context.organizerMemberships.find((membership) => membership.organizerId === organizerId)
}

export function canManageOrganizer(context: TicketUGContext, organizerId: string) {
  const membership = getMembership(context, organizerId)
  return Boolean(membership && membership.status === 'ACTIVE' && managementRoles.includes(membership.role))
}

export function canManageMemberRole(actor: TicketUGRole, target: TicketUGRole) {
  if (actor === 'ORGANIZER_OWNER') return target !== 'ORGANIZER_OWNER'
  if (actor === 'ORGANIZER_MANAGER') return target === 'EVENT_STAFF'
  return false
}
