import { describe, expect, it } from 'vitest'
import { EVENT_VIBES, vibeForSlug, vibeIndexForSlug, vibeByKey } from './event-vibes'

describe('event vibes taxonomy', () => {
  it('defines a compact, uniquely-keyed, uniquely-queried list', () => {
    expect(EVENT_VIBES.length).toBeGreaterThan(0)
    expect(EVENT_VIBES.length).toBeLessThanOrEqual(8)
    const keys = EVENT_VIBES.map((vibe) => vibe.key)
    const queries = EVENT_VIBES.map((vibe) => vibe.query)
    expect(new Set(keys).size).toBe(keys.length)
    expect(new Set(queries).size).toBe(queries.length)
    for (const vibe of EVENT_VIBES) {
      expect(vibe.key).toMatch(/^[a-z-]+$/)
      expect(vibe.label.length).toBeGreaterThan(0)
      expect(vibe.emoji.length).toBeGreaterThan(0)
    }
  })

  it('resolves vibes by key', () => {
    expect(vibeByKey('music')?.label).toBe('Music & Nightlife')
    expect(vibeByKey('nope')).toBeUndefined()
  })
})

describe('vibeIndexForSlug', () => {
  it('is deterministic across repeated calls', () => {
    expect(vibeIndexForSlug('night-shift-kla')).toBe(vibeIndexForSlug('night-shift-kla'))
  })

  it('stays within the vibe bucket range', () => {
    const slugs = ['a', 'night-shift', 'kampala-night-market', 'uganda-cup-final', 'x'.repeat(200), 'slug-with-ünïcode']
    for (const slug of slugs) {
      const index = vibeIndexForSlug(slug)
      expect(index).toBeGreaterThanOrEqual(0)
      expect(index).toBeLessThan(EVENT_VIBES.length)
    }
  })

  it('distributes slugs across more than one bucket', () => {
    const slugs = Array.from({ length: 40 }, (_, index) => `event-slug-${index}`)
    const used = new Set(slugs.map((slug) => vibeIndexForSlug(slug)))
    expect(used.size).toBeGreaterThan(1)
  })

  it('maps a slug to the vibe living at its index', () => {
    const slug = 'rolex-food-fest'
    expect(vibeForSlug(slug)).toBe(EVENT_VIBES[vibeIndexForSlug(slug)])
  })
})
