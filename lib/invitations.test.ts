import { describe, expect, it } from 'vitest'
import { assertInvitationAcceptable, invitationEmailMatches } from './invitations'

const future = new Date(Date.now() + 60 * 60 * 1000)
const past = new Date(Date.now() - 60 * 60 * 1000)

describe('invitation email binding', () => {
  it('matches case-insensitively and tolerates surrounding whitespace', () => {
    expect(invitationEmailMatches('Manager@Example.com ', '  manager@example.com')).toBe(true)
    expect(invitationEmailMatches('STAFF@ug.com', 'staff@ug.com')).toBe(true)
  })

  it('rejects a different address and refuses to bind without an email on either side', () => {
    expect(invitationEmailMatches('a@example.com', 'b@example.com')).toBe(false)
    expect(invitationEmailMatches('a@example.com', null)).toBe(false)
    expect(invitationEmailMatches('a@example.com', undefined)).toBe(false)
    expect(invitationEmailMatches(null, 'a@example.com')).toBe(false)
    expect(invitationEmailMatches('   ', 'a@example.com')).toBe(false)
  })
})

describe('invitation acceptability', () => {
  it('accepts a pending, unexpired invitation', () => {
    expect(() => assertInvitationAcceptable({ status: 'PENDING', expires_at: future })).not.toThrow()
  })

  it('rejects missing rows, non-pending statuses, and expired invitations', () => {
    expect(() => assertInvitationAcceptable(undefined)).toThrow('INVITATION_INVALID')
    expect(() => assertInvitationAcceptable({ status: 'ACCEPTED', expires_at: future })).toThrow('INVITATION_INVALID')
    expect(() => assertInvitationAcceptable({ status: 'PENDING', expires_at: past })).toThrow('INVITATION_INVALID')
    expect(() => assertInvitationAcceptable({ status: 'PENDING', expires_at: past }, new Date(past.getTime() + 1))).toThrow('INVITATION_INVALID')
  })

  it('treats the boundary instant as expired (expires_at <= now)', () => {
    const instant = new Date('2026-01-01T00:00:00.000Z')
    expect(() => assertInvitationAcceptable({ status: 'PENDING', expires_at: instant }, instant)).toThrow('INVITATION_INVALID')
  })
})
