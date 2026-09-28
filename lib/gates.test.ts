import { describe, expect, it } from 'vitest'
import { diffGateTicketTypes, gateCreateSchema, gateTicketTypesSchema, gateUpdateSchema, staffAssignmentSchema } from './gates'

const uuid = '3f2504e0-4f89-11d3-9a0c-0305e82c3301'

describe('gateCreateSchema', () => {
  it('accepts a trimmed name within bounds and defaults the description', () => {
    expect(gateCreateSchema.parse({ name: '  VIP Gate  ' })).toEqual({ name: 'VIP Gate', description: '' })
    expect(gateCreateSchema.parse({ name: 'Main Gate', description: 'South entrance' })).toEqual({ name: 'Main Gate', description: 'South entrance' })
  })

  it('rejects blank and oversized names and oversized descriptions', () => {
    expect(gateCreateSchema.safeParse({ name: '   ' }).success).toBe(false)
    expect(gateCreateSchema.safeParse({ name: 'x'.repeat(121) }).success).toBe(false)
    expect(gateCreateSchema.safeParse({ name: 'Gate', description: 'x'.repeat(501) }).success).toBe(false)
    expect(gateCreateSchema.safeParse({}).success).toBe(false)
  })
})

describe('gateUpdateSchema', () => {
  it('accepts partial updates including the active flag', () => {
    expect(gateUpdateSchema.parse({ isActive: false })).toEqual({ isActive: false })
    expect(gateUpdateSchema.parse({ name: 'Renamed Gate', description: 'New note', isActive: true })).toEqual({ name: 'Renamed Gate', description: 'New note', isActive: true })
  })

  it('rejects unknown-shaped or invalid values', () => {
    expect(gateUpdateSchema.safeParse({ name: '' }).success).toBe(false)
    expect(gateUpdateSchema.safeParse({ isActive: 'yes' }).success).toBe(false)
  })
})

describe('gateTicketTypesSchema', () => {
  it('accepts a list of ticket-type uuids and rejects malformed entries', () => {
    expect(gateTicketTypesSchema.parse({ ticketTypeIds: [uuid] })).toEqual({ ticketTypeIds: [uuid] })
    expect(gateTicketTypesSchema.safeParse({ ticketTypeIds: ['nope'] }).success).toBe(false)
    expect(gateTicketTypesSchema.safeParse({ ticketTypeIds: Array.from({ length: 201 }, () => uuid) }).success).toBe(false)
  })
})

describe('staffAssignmentSchema', () => {
  it('keeps the legacy event-wide assignment when gateId is omitted or null', () => {
    expect(staffAssignmentSchema.parse({ userProfileId: uuid })).toEqual({ userProfileId: uuid })
    expect(staffAssignmentSchema.parse({ userProfileId: uuid, gateId: null })).toEqual({ userProfileId: uuid, gateId: null })
  })

  it('accepts an explicit gate scope and rejects non-uuid gates', () => {
    expect(staffAssignmentSchema.parse({ userProfileId: uuid, gateId: uuid }).gateId).toBe(uuid)
    expect(staffAssignmentSchema.safeParse({ userProfileId: uuid, gateId: 'gate' }).success).toBe(false)
  })
})

describe('diffGateTicketTypes (replace-set permissions)', () => {
  it('computes additions, removals and unchanged rows', () => {
    expect(diffGateTicketTypes(['a', 'b', 'c'], ['b', 'c', 'd'])).toEqual({ toAdd: ['d'], toRemove: ['a'] })
  })

  it('handles enabling from empty and clearing to empty', () => {
    expect(diffGateTicketTypes([], ['a', 'b'])).toEqual({ toAdd: ['a', 'b'], toRemove: [] })
    expect(diffGateTicketTypes(['a'], [])).toEqual({ toAdd: [], toRemove: ['a'] })
  })

  it('produces no delta for identical sets', () => {
    expect(diffGateTicketTypes(['a', 'b'], ['b', 'a'])).toEqual({ toAdd: [], toRemove: [] })
  })
})
