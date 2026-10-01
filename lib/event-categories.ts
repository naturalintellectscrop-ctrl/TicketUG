// Shared discovery taxonomy for the public event surfaces (landing, discovery
// filters, event cards, detail pages, featured carousel).
//
// A category is a marketing keyword shortcut, not a data column: events have no
// category field, so category filters expand into an OR-keyword search over
// title/description through lib/public-events.ts (listPublicEvents keywords).
// Keep keys stable: card gradient covers and pill palettes are derived from
// these keys, so renaming or reordering keys changes live cover art.
//
// Icons are official Lucide icons — no emoji glyphs anywhere in the UI.
import type { LucideIcon } from 'lucide-react'
import {
  Cake,
  Church,
  MicVocal,
  MoonStar,
  Music,
  Palette,
  PartyPopper,
  Presentation,
  Trophy,
  Users,
  UtensilsCrossed,
} from 'lucide-react'

export type EventCategory = {
  key: string
  label: string
  icon: LucideIcon
  /** Case-insensitive substrings matched against title/description (OR-combined). */
  keywords: string[]
}

const MAX_KEYWORDS = 16
const MAX_KEYWORD_LENGTH = 60

export const EVENT_CATEGORIES: EventCategory[] = [
  { key: 'concerts', label: 'Concerts', icon: MicVocal, keywords: ['concert', 'live band', 'unplugged', 'album launch', 'acoustic'] },
  { key: 'music', label: 'Music & DJ', icon: Music, keywords: ['music', 'dj', 'afrobeats', 'afrobeat', 'karaoke', 'jazz', 'kizomba', 'salsa', 'band'] },
  { key: 'nightlife', label: 'Nightlife', icon: MoonStar, keywords: ['nightlife', 'club', 'lounge', 'afterparty', 'after-party', 'midnight'] },
  { key: 'party', label: 'Parties', icon: PartyPopper, keywords: ['party', 'bash', 'rave', 'block party', 'pool party', 'braai', 'bar crawl'] },
  { key: 'sports', label: 'Sports', icon: Trophy, keywords: ['football', 'sports', 'rugby', 'cricket', 'basketball', 'volleyball', 'marathon', 'fitness', 'tournament', 'league', 'boxing', 'yoga'] },
  { key: 'family', label: 'Family & Kids', icon: Users, keywords: ['family', 'kids', 'children', 'fun day', 'picnic', 'fun fair'] },
  { key: 'food', label: 'Food & Drink', icon: UtensilsCrossed, keywords: ['food', 'drink', 'grill', 'rolex', 'chapati', 'wine', 'brunch', 'coffee', 'cocktail', 'tasting', 'street food', 'cookout'] },
  { key: 'conferences', label: 'Conferences', icon: Presentation, keywords: ['conference', 'summit', 'hackathon', 'workshop', 'forum', 'expo', 'seminar', 'networking', 'pitch'] },
  { key: 'faith', label: 'Faith', icon: Church, keywords: ['gospel', 'faith', 'church', 'worship', 'praise', 'crusade', 'prayer', 'ministry'] },
  { key: 'culture', label: 'Culture & Arts', icon: Palette, keywords: ['culture', 'art', 'dance', 'theatre', 'poetry', 'fashion', 'exhibition', 'museum', 'comedy', 'drum'] },
  { key: 'celebration', label: 'Celebrations', icon: Cake, keywords: ['wedding', 'graduation', 'anniversary', 'birthday', 'festival', 'carnival', 'celebration', 'new year', 'send-off'] },
]

export function categoryByKey(key: string | null | undefined): EventCategory | undefined {
  return key ? EVENT_CATEGORIES.find((category) => category.key === key) : undefined
}

// Deterministic cover variation: the same event slug always maps to the same
// category, so a card's fallback cover never flickers between renders or across
// pages. Multiplicative rolling hash — cheap, stable, and spreads well enough
// for eleven buckets.
export function categoryIndexForSlug(slug: string): number {
  let hash = 0
  for (let index = 0; index < slug.length; index += 1) {
    hash = (hash * 31 + slug.charCodeAt(index)) >>> 0
  }
  return EVENT_CATEGORIES.length ? hash % EVENT_CATEGORIES.length : 0
}

export function categoryForSlug(slug: string): EventCategory {
  return EVENT_CATEGORIES[categoryIndexForSlug(slug)] ?? EVENT_CATEGORIES[0]
}

// ---------------------------------------------------------------------------
// Date-window filter ("Any week" style). All boundaries are computed on the UTC
// calendar for determinism; Uganda (Africa/Kampala) sits at a fixed UTC+3 with
// no DST, so the worst-case drift for a "today" boundary is three hours — an
// acceptable trade-off for a discovery filter.
// ---------------------------------------------------------------------------

export const EVENT_WHEN_KEYS = ['any', 'today', 'week', 'weekend', 'month'] as const
export type EventWhenKey = (typeof EVENT_WHEN_KEYS)[number]

export const EVENT_WHEN_OPTIONS: Array<{ key: EventWhenKey; label: string }> = [
  { key: 'any', label: 'Any time' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'weekend', label: 'This weekend' },
  { key: 'month', label: 'This month' },
]

export function normalizeWhenKey(value: string | null | undefined): EventWhenKey {
  const normalized = value?.trim().toLowerCase() ?? ''
  return (EVENT_WHEN_KEYS as readonly string[]).includes(normalized) ? (normalized as EventWhenKey) : 'any'
}

export type WhenRange = { from: Date | null; to: Date | null }

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

const DAY_MS = 86_400_000

export function resolveWhenRange(when: string | null | undefined, now: Date = new Date()): WhenRange {
  const key = normalizeWhenKey(when)
  if (key === 'any') return { from: null, to: null }
  const dayStart = startOfUtcDay(now)
  if (key === 'today') return { from: dayStart, to: new Date(dayStart.getTime() + DAY_MS) }
  if (key === 'week') return { from: dayStart, to: new Date(dayStart.getTime() + 7 * DAY_MS) }
  if (key === 'month') {
    const from = dayStart
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
    return { from, to }
  }
  // Weekend: Friday 00:00 UTC → Monday 00:00 UTC. Mon–Thu targets the upcoming
  // weekend; Fri–Sun targets the weekend in progress.
  const weekday = now.getUTCDay()
  const daysSinceFriday = (weekday + 2) % 7 // Fri→0, Sat→1, Sun→2, Mon→3 … Thu→6
  const weekendStart = daysSinceFriday <= 2
    ? new Date(dayStart.getTime() - daysSinceFriday * DAY_MS)
    : new Date(dayStart.getTime() + ((5 - weekday + 7) % 7) * DAY_MS)
  return { from: weekendStart, to: new Date(weekendStart.getTime() + 3 * DAY_MS) }
}

// ---------------------------------------------------------------------------
// Sort modes for the discovery listing.
// ---------------------------------------------------------------------------

export const EVENT_SORT_KEYS = ['trending', 'newest', 'soonest'] as const
export type EventSortKey = (typeof EVENT_SORT_KEYS)[number]

export const EVENT_SORT_OPTIONS: Array<{ key: EventSortKey; label: string }> = [
  { key: 'trending', label: 'Trending' },
  { key: 'newest', label: 'Just announced' },
  { key: 'soonest', label: 'Soonest first' },
]

export function normalizeSortKey(value: string | null | undefined): EventSortKey {
  const normalized = value?.trim().toLowerCase() ?? ''
  return (EVENT_SORT_KEYS as readonly string[]).includes(normalized) ? (normalized as EventSortKey) : 'trending'
}

export function sanitizeKeywords(keywords: string[] | null | undefined): string[] {
  if (!keywords?.length) return []
  const cleaned: string[] = []
  for (const raw of keywords) {
    if (typeof raw !== 'string') continue
    const keyword = raw.trim().slice(0, MAX_KEYWORD_LENGTH)
    if (!keyword) continue
    if (!cleaned.some((existing) => existing.toLowerCase() === keyword.toLowerCase())) cleaned.push(keyword)
    if (cleaned.length >= MAX_KEYWORDS) break
  }
  return cleaned
}

