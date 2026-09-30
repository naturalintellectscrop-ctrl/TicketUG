// Shared "vibe" taxonomy for the public event surfaces (landing, discovery,
// event cards, detail pages). A vibe is a marketing keyword shortcut, not a
// data column: events have no category field, so vibe pills deep-link into the
// existing public search (q=) — a pill filters by keyword in title/description.
// Keep the list short, visual, and stable: card gradient covers are derived
// from these keys, so reordering or renaming keys changes live cover art.

export type EventVibe = { key: string; label: string; emoji: string; query: string }

export const EVENT_VIBES: EventVibe[] = [
  { key: 'music', label: 'Music & Nightlife', emoji: '🎵', query: 'music' },
  { key: 'food', label: 'Food & Drinks', emoji: '🍢', query: 'food' },
  { key: 'culture', label: 'Culture & Art', emoji: '🎭', query: 'culture' },
  { key: 'sports', label: 'Sports', emoji: '⚽', query: 'football' },
  { key: 'faith', label: 'Faith & Community', emoji: '🙌', query: 'gospel' },
  { key: 'business', label: 'Business & Tech', emoji: '💼', query: 'summit' },
]

export function vibeByKey(key: string): EventVibe | undefined {
  return EVENT_VIBES.find((vibe) => vibe.key === key)
}

// Deterministic cover variation: the same event slug always maps to the same
// vibe, so a card's fallback cover never flickers between renders or across
// pages. Multiplicative rolling hash — cheap, stable, and spreads well enough
// for six buckets.
export function vibeIndexForSlug(slug: string): number {
  let hash = 0
  for (let index = 0; index < slug.length; index += 1) {
    hash = (hash * 31 + slug.charCodeAt(index)) >>> 0
  }
  return EVENT_VIBES.length ? hash % EVENT_VIBES.length : 0
}

export function vibeForSlug(slug: string): EventVibe {
  return EVENT_VIBES[vibeIndexForSlug(slug)] ?? EVENT_VIBES[0]
}
