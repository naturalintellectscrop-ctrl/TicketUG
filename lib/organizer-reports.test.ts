import { describe, expect, it } from 'vitest'
import { fillOrderStates, isOrderState } from './organizer-reports'

describe('isOrderState', () => {
  it('accepts exactly the CHECK-constrained payment states', () => {
    for (const state of ['AWAITING_PAYMENT', 'PAYMENT_PROCESSING', 'PAID', 'CANCELLED', 'EXPIRED']) {
      expect(isOrderState(state)).toBe(true)
    }
  })

  it('rejects anything else (filter values can never reach SQL unvalidated)', () => {
    expect(isOrderState('PAID; DROP TABLE x')).toBe(false)
    expect(isOrderState('paid')).toBe(false)
    expect(isOrderState('')).toBe(false)
    expect(isOrderState(null)).toBe(false)
    expect(isOrderState(undefined)).toBe(false)
  })
})

describe('fillOrderStates', () => {
  it('renders every known state in canonical order, zero-filled', () => {
    const result = fillOrderStates([
      { payment_state: 'PAID', order_count: 3, total_minor_units: '45000' },
      { payment_state: 'EXPIRED', order_count: 1, total_minor_units: '5000' },
    ])
    expect(result.map((entry) => entry.state)).toEqual(['AWAITING_PAYMENT', 'PAYMENT_PROCESSING', 'PAID', 'CANCELLED', 'EXPIRED'])
    expect(result.find((entry) => entry.state === 'PAID')).toMatchObject({ count: 3, totalMinorUnits: 45000 })
    expect(result.find((entry) => entry.state === 'CANCELLED')).toMatchObject({ count: 0, totalMinorUnits: 0 })
  })

  it('sums are numeric even when pg returns bigint strings', () => {
    const result = fillOrderStates([{ payment_state: 'PAID', order_count: 2, total_minor_units: '999999999999' }])
    expect(result[2].totalMinorUnits).toBe(999_999_999_999)
    expect(typeof result[2].totalMinorUnits).toBe('number')
  })

  it('handles an empty aggregate (no orders yet)', () => {
    const result = fillOrderStates([])
    expect(result).toHaveLength(5)
    expect(result.every((entry) => entry.count === 0 && entry.totalMinorUnits === 0)).toBe(true)
  })
})
