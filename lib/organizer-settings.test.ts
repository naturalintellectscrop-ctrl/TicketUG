import { describe, expect, it } from 'vitest'
import { organizerRenameInput } from './organizer-settings'

describe('organizer rename input', () => {
  it('accepts and trims valid workspace names', () => {
    expect(organizerRenameInput.safeParse({ name: '  Kampala Night Market  ' }).success).toBe(true)
    expect(organizerRenameInput.safeParse({ name: 'Ab' }).success).toBe(true)
    expect(organizerRenameInput.safeParse({ name: 'x'.repeat(120) }).success).toBe(true)
  })

  it('rejects names that are too short, too long, or missing', () => {
    expect(organizerRenameInput.safeParse({ name: 'A' }).success).toBe(false)
    expect(organizerRenameInput.safeParse({ name: 'x'.repeat(121) }).success).toBe(false)
    expect(organizerRenameInput.safeParse({ name: '   ' }).success).toBe(false)
    expect(organizerRenameInput.safeParse({}).success).toBe(false)
    expect(organizerRenameInput.safeParse({ name: 42 }).success).toBe(false)
  })
})
