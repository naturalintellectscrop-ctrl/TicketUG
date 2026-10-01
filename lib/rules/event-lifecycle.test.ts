import { describe, expect, it } from 'vitest'
import { canTransition } from './event-lifecycle'

// The transition map here must stay in lockstep with the adjacency table
// encoded inside ticketug.transition_event_lifecycle (migration 012) — the
// route check is a fast-fail mirror of the database's authoritative copy.
describe('event lifecycle', () => {
  it('allows the canonical forward flow', () => {
    expect(canTransition('DRAFT', 'PUBLISHED')).toBe(true)
    expect(canTransition('PUBLISHED', 'SALES_OPEN')).toBe(true)
    expect(canTransition('SALES_OPEN', 'SALES_CLOSED')).toBe(true)
    expect(canTransition('SALES_CLOSED', 'EVENT_LIVE')).toBe(true)
    expect(canTransition('EVENT_LIVE', 'COMPLETED')).toBe(true)
  })
  it('rejects skipping states and reopening archived events', () => {
    expect(canTransition('DRAFT', 'SALES_OPEN')).toBe(false)
    expect(canTransition('ARCHIVED', 'PUBLISHED')).toBe(false)
  })
  it('keeps terminal states terminal', () => {
    expect(canTransition('COMPLETED', 'COMPLETED')).toBe(false)
    expect(canTransition('CANCELLED', 'PUBLISHED')).toBe(false)
    expect(canTransition('ARCHIVED', 'ARCHIVED')).toBe(false)
  })
})
