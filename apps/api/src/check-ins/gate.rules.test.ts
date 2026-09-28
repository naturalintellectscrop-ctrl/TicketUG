import { describe, expect, it } from 'vitest'
import { assignmentGrantsScanning, gateAllowsTicketType } from './gate.rules.js'

describe('assignmentGrantsScanning', () => {
  it('grants scanning for the legacy event-wide assignment (no gate)', () => {
    expect(assignmentGrantsScanning({ gateId: null, gateActive: null })).toBe(true)
  })

  it('grants scanning while the assigned gate is active', () => {
    expect(assignmentGrantsScanning({ gateId: 'g-1', gateActive: true })).toBe(true)
  })

  it('refuses scanning when the assigned gate is disabled (fail-closed)', () => {
    expect(assignmentGrantsScanning({ gateId: 'g-1', gateActive: false })).toBe(false)
  })

  it('refuses scanning when the assigned gate row is missing', () => {
    expect(assignmentGrantsScanning({ gateId: 'g-1', gateActive: null })).toBe(false)
  })
})

describe('gateAllowsTicketType (check-in regression matrix, directive §15)', () => {
  it('checks a ticket in when its type is permitted at the scanner gate (correct gate)', () => {
    expect(gateAllowsTicketType('main-gate', ['main-gate'])).toEqual({ allowed: true })
  })

  it('accepts a multi-gate ticket type at every permitted gate (VIP at Main + VIP)', () => {
    expect(gateAllowsTicketType('main-gate', ['main-gate', 'vip-gate'])).toEqual({ allowed: true })
    expect(gateAllowsTicketType('vip-gate', ['main-gate', 'vip-gate'])).toEqual({ allowed: true })
  })

  it('rejects a valid ticket at the wrong gate with a clear reason', () => {
    expect(gateAllowsTicketType('vvip-gate', ['main-gate', 'vip-gate'])).toEqual({ allowed: false, outcome: 'GATE_NOT_PERMITTED' })
  })

  it('rejects an unmapped ticket type at any gate once gates exist (fail-closed)', () => {
    expect(gateAllowsTicketType('main-gate', [])).toEqual({ allowed: false, outcome: 'GATE_NOT_PERMITTED' })
  })

  it('never gate-filters event-wide scanners (legacy behavior preserved)', () => {
    expect(gateAllowsTicketType(null, [])).toEqual({ allowed: true })
    expect(gateAllowsTicketType(null, ['vip-gate'])).toEqual({ allowed: true })
  })
})
