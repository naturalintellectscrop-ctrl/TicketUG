import { describe, expect, it } from 'vitest'
import { isValidWorkspaceSlug, slugifyWorkspaceName } from './slug'

describe('slugifyWorkspaceName', () => {
  it('lowercases and hyphenates a normal organizer name', () => {
    expect(slugifyWorkspaceName('Kampala Night Market')).toBe('kampala-night-market')
  })

  it('folds diacritics to ascii', () => {
    expect(slugifyWorkspaceName('Café Lumière Nights')).toBe('cafe-lumiere-nights')
  })

  it('collapses punctuation and whitespace runs into single hyphens', () => {
    expect(slugifyWorkspaceName('  A & B!! Events  ')).toBe('a-b-events')
  })

  it('keeps digits', () => {
    expect(slugifyWorkspaceName('Back 2 Back Live')).toBe('back-2-back-live')
  })

  it('returns an empty string for names with no alphanumerics', () => {
    expect(slugifyWorkspaceName('!!! --- ???')).toBe('')
  })

  it('caps at 80 characters without a trailing hyphen', () => {
    const long = slugifyWorkspaceName('K'.repeat(79) + ' End of the very long organizer name')
    expect(long.length).toBeLessThanOrEqual(80)
    expect(long.endsWith('-')).toBe(false)
    expect(long.startsWith('k')).toBe(true)
  })

  it('is idempotent on its own output', () => {
    const once = slugifyWorkspaceName('Nyege Nyege Festival 2026')
    expect(slugifyWorkspaceName(once)).toBe(once)
  })
})

describe('isValidWorkspaceSlug', () => {
  it('accepts the API schema examples', () => {
    expect(isValidWorkspaceSlug('kampala-night-market')).toBe(true)
    expect(isValidWorkspaceSlug('back2back')).toBe(true)
    expect(isValidWorkspaceSlug('a-b-c')).toBe(true)
  })

  it('applies the 3-character minimum to total length, not per segment (matches the API schema)', () => {
    expect(isValidWorkspaceSlug('ab')).toBe(false)
    expect(isValidWorkspaceSlug('a-b')).toBe(true)
  })

  it('rejects uppercase, spaces, leading/trailing/double hyphens', () => {
    expect(isValidWorkspaceSlug('Kampala')).toBe(false)
    expect(isValidWorkspaceSlug('has space')).toBe(false)
    expect(isValidWorkspaceSlug('-leading')).toBe(false)
    expect(isValidWorkspaceSlug('trailing-')).toBe(false)
    expect(isValidWorkspaceSlug('double--hyphen')).toBe(false)
  })

  it('rejects empty and over-long slugs', () => {
    expect(isValidWorkspaceSlug('')).toBe(false)
    expect(isValidWorkspaceSlug('a'.repeat(81))).toBe(false)
    expect(isValidWorkspaceSlug('a'.repeat(80))).toBe(true)
  })
})
