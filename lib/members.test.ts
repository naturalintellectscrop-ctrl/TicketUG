import { describe, expect, it } from 'vitest'
import { assertMemberRemoval, assertMemberRoleChange, assertOwnershipTransfer } from './members'

const OWNER = 'ORGANIZER_OWNER'
const MANAGER = 'ORGANIZER_MANAGER'
const STAFF = 'EVENT_STAFF'

describe('member removal authority', () => {
  it('lets owners and managers remove members within their authority', () => {
    expect(() => assertMemberRemoval(OWNER, MANAGER, { self: false })).not.toThrow()
    expect(() => assertMemberRemoval(OWNER, STAFF, { self: false })).not.toThrow()
    expect(() => assertMemberRemoval(MANAGER, STAFF, { self: false })).not.toThrow()
  })

  it('rejects authority escalations and owner-seat interference', () => {
    expect(() => assertMemberRemoval(OWNER, OWNER, { self: false })).toThrow('FORBIDDEN')
    expect(() => assertMemberRemoval(MANAGER, MANAGER, { self: false })).toThrow('FORBIDDEN')
    expect(() => assertMemberRemoval(MANAGER, OWNER, { self: false })).toThrow('FORBIDDEN')
    expect(() => assertMemberRemoval(STAFF, STAFF, { self: false })).toThrow('FORBIDDEN')
    expect(() => assertMemberRemoval(STAFF, MANAGER, { self: false })).toThrow('FORBIDDEN')
    expect(() => assertMemberRemoval(STAFF, OWNER, { self: false })).toThrow('FORBIDDEN')
  })

  it('lets non-owner members leave on their own but never owners', () => {
    expect(() => assertMemberRemoval(MANAGER, MANAGER, { self: true })).not.toThrow()
    expect(() => assertMemberRemoval(STAFF, STAFF, { self: true })).not.toThrow()
    expect(() => assertMemberRemoval(OWNER, OWNER, { self: true })).toThrow('OWNER_CANNOT_LEAVE')
  })
})

describe('member role-change authority', () => {
  it('lets owners move members between manager and staff', () => {
    expect(() => assertMemberRoleChange(OWNER, MANAGER, STAFF)).not.toThrow()
    expect(() => assertMemberRoleChange(OWNER, STAFF, MANAGER)).not.toThrow()
  })

  it('never lets anyone grant above their own authority or touch owner seats', () => {
    expect(() => assertMemberRoleChange(MANAGER, STAFF, MANAGER)).toThrow('FORBIDDEN')
    expect(() => assertMemberRoleChange(MANAGER, OWNER, STAFF)).toThrow('FORBIDDEN')
    expect(() => assertMemberRoleChange(OWNER, OWNER, STAFF)).toThrow('FORBIDDEN')
    expect(() => assertMemberRoleChange(STAFF, STAFF, STAFF)).toThrow('FORBIDDEN')
  })

  it('rejects self role-changes through the ladder (a role never manages itself)', () => {
    expect(() => assertMemberRoleChange(OWNER, OWNER, STAFF)).toThrow('FORBIDDEN')
    expect(() => assertMemberRoleChange(MANAGER, MANAGER, STAFF)).toThrow('FORBIDDEN')
    expect(() => assertMemberRoleChange(STAFF, STAFF, MANAGER)).toThrow('FORBIDDEN')
  })
})

describe('ownership transfer authority', () => {
  it('lets owners hand the seat to any active member', () => {
    expect(() => assertOwnershipTransfer(OWNER, MANAGER, { self: false, targetOwnsAnotherOrganizer: false })).not.toThrow()
    expect(() => assertOwnershipTransfer(OWNER, STAFF, { self: false, targetOwnsAnotherOrganizer: false })).not.toThrow()
  })

  it('rejects non-owners, self-transfers, and recipients who already own a workspace', () => {
    expect(() => assertOwnershipTransfer(MANAGER, MANAGER, { self: false, targetOwnsAnotherOrganizer: false })).toThrow('FORBIDDEN')
    expect(() => assertOwnershipTransfer(STAFF, MANAGER, { self: false, targetOwnsAnotherOrganizer: false })).toThrow('FORBIDDEN')
    expect(() => assertOwnershipTransfer(OWNER, MANAGER, { self: true, targetOwnsAnotherOrganizer: false })).toThrow('FORBIDDEN')
    expect(() => assertOwnershipTransfer(OWNER, MANAGER, { self: false, targetOwnsAnotherOrganizer: true })).toThrow('TARGET_OWNS_ORGANIZER')
  })

  it('allows handing the seat to an existing co-owner (the actor simply steps down)', () => {
    expect(() => assertOwnershipTransfer(OWNER, OWNER, { self: false, targetOwnsAnotherOrganizer: false })).not.toThrow()
  })
})
