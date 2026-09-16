export type ApiRole = 'ATTENDEE' | 'ORGANIZER_OWNER' | 'ORGANIZER_MANAGER' | 'EVENT_STAFF' | 'PLATFORM_SUPPORT' | 'PLATFORM_ADMIN' | 'SUPER_ADMIN'
export type ApiUser = { authUserId: string; profileId: string; roles: ApiRole[]; organizerMemberships: Array<{ organizerId: string; role: ApiRole; status: string }> }
export const API_USER = Symbol('API_USER')
