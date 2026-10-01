import { describe, expect, it } from 'vitest'
import { canManageMemberRole, canManageOrganizer } from './organizer-authorization'
import type { TicketUGContext } from './request-context'

const context: TicketUGContext = {
  authUserId: 'auth-1',
  profileId: 'profile-1',
  roles: ['ATTENDEE', 'ORGANIZER_OWNER'],
  organizerMemberships: [{ organizerId: 'org-1', role: 'ORGANIZER_OWNER', status: 'ACTIVE' }],
}

describe('TicketUG authorization', () => {
  it('allows an active owner to manage only their organizer', () => {
    expect(canManageOrganizer(context, 'org-1')).toBe(true)
    expect(canManageOrganizer(context, 'org-2')).toBe(false)
  })

  it('denies inactive memberships', () => {
    expect(canManageOrganizer({ ...context, organizerMemberships: [{ organizerId: 'org-1', role: 'ORGANIZER_OWNER', status: 'SUSPENDED' }] }, 'org-1')).toBe(false)
  })

  it('keeps manager role changes below owner authority', () => {
    expect(canManageMemberRole('ORGANIZER_MANAGER', 'EVENT_STAFF')).toBe(true)
    expect(canManageMemberRole('ORGANIZER_MANAGER', 'ORGANIZER_MANAGER')).toBe(false)
    expect(canManageMemberRole('ORGANIZER_OWNER', 'ORGANIZER_MANAGER')).toBe(true)
  })
})
