import { describe, expect, it } from 'vitest'
import {
  EVENT_CATEGORIES,
  categoryByKey,
  categoryForSlug,
  categoryIndexForSlug,
  normalizeSortKey,
  normalizeWhenKey,
  resolveWhenRange,
  sanitizeKeywords,
} from './event-categories'

describe('EVENT_CATEGORIES taxonomy', () => {
  it('has a stable, unique set of keys', () => {
    const keys = EVENT_CATEGORIES.map((category) => category.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).toEqual([
      'concerts', 'music', 'nightlife', 'party', 'sports', 'family',
      'food', 'conferences', 'faith', 'culture', 'celebration',
    ])
  })

  it('every category carries a label, an icon component and usable keywords', () => {
    for (const category of EVENT_CATEGORIES) {
      expect(category.label.length).toBeGreaterThan(2)
      // Lucide icons surface as functions or forwardRef-style component objects
      // depending on the module build — both render as React components.
      expect(['function', 'object']).toContain(typeof category.icon)
      expect(category.icon).not.toBeNull()
      expect(category.keywords.length).toBeGreaterThan(0)
      expect(category.keywords.length).toBeLessThanOrEqual(16)
      for (const keyword of category.keywords) {
        expect(keyword.trim()).toBe(keyword)
        expect(keyword.length).toBeGreaterThan(1)
        expect(keyword.length).toBeLessThanOrEqual(60)
      }
    }
  })

  it('categoryByKey resolves exact keys and rejects unknowns', () => {
    expect(categoryByKey('sports')?.label).toBe('Sports')
    expect(categoryByKey('nope')).toBeUndefined()
    expect(categoryByKey(null)).toBeUndefined()
    expect(categoryByKey('')).toBeUndefined()
  })
})

describe('categoryForSlug (deterministic fallback covers)', () => {
  it('always returns a category within bounds and is stable per slug', () => {
    for (const slug of ['night-shift', 'waga-night-254', 'kampala-food-fest', 'x', 'a-very-long-slug-with- many-parts']) {
      const category = categoryForSlug(slug)
      expect(EVENT_CATEGORIES).toContain(category)
      expect(categoryForSlug(slug)).toBe(category)
      expect(EVENT_CATEGORIES[categoryIndexForSlug(slug)]).toBe(category)
    }
  })

  it('spreads sample slugs across several cover buckets (no single-vibe monoculture)', () => {
    const used = new Set<string>()
    for (let index = 0; index < 60; index += 1) {
      used.add(categoryForSlug(`event-slug-${index}`).key)
    }
    expect(used.size).toBeGreaterThanOrEqual(5)
  })
})

describe('normalizeWhenKey / normalizeSortKey (URL param safety)', () => {
  it('accepts known keys in any case and falls back to defaults', () => {
    expect(normalizeWhenKey('week')).toBe('week')
    expect(normalizeWhenKey('WEEKEND')).toBe('weekend')
    expect(normalizeWhenKey('tomorrow')).toBe('any')
    expect(normalizeWhenKey(null)).toBe('any')
    expect(normalizeSortKey('soonest')).toBe('soonest')
    expect(normalizeSortKey('cheap')).toBe('trending')
    expect(normalizeSortKey(undefined)).toBe('trending')
  })
})

describe('resolveWhenRange', () => {
  // Wednesday 2026-10-07, 15:30 UTC — a stable reference "now".
  const now = new Date('2026-10-07T15:30:00Z')

  it('returns open bounds for "any" and unknown keys', () => {
    expect(resolveWhenRange('any', now)).toEqual({ from: null, to: null })
    expect(resolveWhenRange('nonsense', now)).toEqual({ from: null, to: null })
  })

  it('bounds "today" to the UTC calendar day', () => {
    const range = resolveWhenRange('today', now)
    expect(range.from?.toISOString()).toBe('2026-10-07T00:00:00.000Z')
    expect(range.to?.toISOString()).toBe('2026-10-08T00:00:00.000Z')
  })

  it('bounds "week" to the next seven days including today', () => {
    const range = resolveWhenRange('week', now)
    expect(range.from?.toISOString()).toBe('2026-10-07T00:00:00.000Z')
    expect(range.to?.toISOString()).toBe('2026-10-14T00:00:00.000Z')
  })

  it('bounds "month" from today to the first day of the next month', () => {
    const range = resolveWhenRange('month', now)
    expect(range.from?.toISOString()).toBe('2026-10-07T00:00:00.000Z')
    expect(range.to?.toISOString()).toBe('2026-11-01T00:00:00.000Z')
  })

  it('targets the UPCOMING weekend from a mid-week day (Mon–Thu)', () => {
    const range = resolveWhenRange('weekend', now) // Wednesday
    expect(range.from?.toISOString()).toBe('2026-10-09T00:00:00.000Z') // Friday
    expect(range.to?.toISOString()).toBe('2026-10-12T00:00:00.000Z') // Monday
  })

  it('uses the IN-PROGRESS weekend from Friday through Sunday', () => {
    const saturday = new Date('2026-10-10T18:00:00Z')
    const range = resolveWhenRange('weekend', saturday)
    expect(range.from?.toISOString()).toBe('2026-10-09T00:00:00.000Z')
    expect(range.to?.toISOString()).toBe('2026-10-12T00:00:00.000Z')

    const sunday = new Date('2026-10-11T09:00:00Z')
    const sundayRange = resolveWhenRange('weekend', sunday)
    expect(sundayRange.from?.getUTCDay()).toBe(5)
    expect(sundayRange.to?.toISOString()).toBe('2026-10-12T00:00:00.000Z')
  })
})

describe('sanitizeKeywords', () => {
  it('trims, drops empties, dedupes case-insensitively and caps the list', () => {
    expect(sanitizeKeywords(['  dj ', 'DJ', '', 'afrobeats', 'x'.repeat(100)])).toEqual(['dj', 'afrobeats', 'x'.repeat(60)])
    expect(sanitizeKeywords([])).toEqual([])
    expect(sanitizeKeywords(null)).toEqual([])
    expect(sanitizeKeywords(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r'])).toHaveLength(16)
  })
})
