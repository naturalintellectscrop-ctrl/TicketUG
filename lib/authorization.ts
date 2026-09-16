export const ROLES = [
  'ATTENDEE',
  'ORGANIZER_OWNER',
  'ORGANIZER_MANAGER',
  'EVENT_STAFF',
  'PLATFORM_SUPPORT',
  'PLATFORM_ADMIN',
  'SUPER_ADMIN',
] as const

export type Role = (typeof ROLES)[number]
export type MembershipStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REMOVED'

const platformRank: Record<Role, number> = {
  ATTENDEE: 0,
  ORGANIZER_OWNER: 0,
  ORGANIZER_MANAGER: 0,
  EVENT_STAFF: 0,
  PLATFORM_SUPPORT: 1,
  PLATFORM_ADMIN: 2,
  SUPER_ADMIN: 3,
}

export function hasRole(roles: readonly Role[], required: Role) {
  return roles.includes(required) || roles.some((role) => platformRank[role] >= platformRank[required] && platformRank[required] > 0)
}

export function canManageOrganizer(role: Role) {
  return role === 'ORGANIZER_OWNER' || role === 'ORGANIZER_MANAGER'
}

export function canAccessOwnResource(actorProfileId: string, resourceOwnerId: string) {
  return actorProfileId === resourceOwnerId
}

export function canAccessOrganization(organizerId: string, memberships: readonly { organizerId: string; role: Role; status: MembershipStatus }[], requiredRole?: Role) {
  const membership = memberships.find((item) => item.organizerId === organizerId && item.status === 'ACTIVE')
  if (!membership) return false
  return !requiredRole || membership.role === requiredRole || (requiredRole === 'ORGANIZER_MANAGER' && membership.role === 'ORGANIZER_OWNER')
}
