'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowDownUp, CalendarDays, ChevronDown, Sparkles } from 'lucide-react'
import {
  EVENT_CATEGORIES,
  EVENT_SORT_OPTIONS,
  EVENT_WHEN_OPTIONS,
  type EventSortKey,
  type EventWhenKey,
} from '@/lib/event-categories'

type EventsFilterBarProps = {
  activeCategory: string | null
  when: EventWhenKey
  sort: EventSortKey
  query: string
}

/**
 * Discovery filter rail for /events — a horizontally scrollable row of
 * category chips (official Lucide icons, one festive tint per category) plus
 * two dropdowns: the date window ("Any time" … "This month") and the sort
 * mode (Trending / Just announced / Soonest first). Every control deep-links
 * into /events with merged query params and resets to page 1; links work
 * without JS, selects need it (progressive enhancement).
 */
export function EventsFilterBar({ activeCategory, when, sort, query }: EventsFilterBarProps) {
  const router = useRouter()
  const activeChipRef = useRef<HTMLAnchorElement | null>(null)

  // Keep the active category chip visible in the scroll rail (deep links and
  // browser-back can otherwise leave it hidden off-screen).
  useEffect(() => {
    if (activeCategory) activeChipRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [activeCategory])

  const hrefFor = (patch: { category?: string | null; when?: string; sort?: string } = {}) => {
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    const category = 'category' in patch ? patch.category : activeCategory
    if (category) params.set('category', category)
    const nextWhen = patch.when ?? when
    if (nextWhen && nextWhen !== 'any') params.set('when', nextWhen)
    const nextSort = patch.sort ?? sort
    if (nextSort && nextSort !== 'trending') params.set('sort', nextSort)
    const queryString = params.toString()
    return queryString ? `/events?${queryString}` : '/events'
  }

  const navigate = (href: string) => router.push(href, { scroll: false })

  return (
    <div className="events-filter-bar">
      <div className="filter-chips" role="group" aria-label="Filter events by category">
        <Link
          href={hrefFor({ category: null })}
          scroll={false}
          className="category-pill category-all"
          data-active={activeCategory ? undefined : 'true'}
          aria-current={activeCategory ? undefined : 'page'}
        >
          <Sparkles size={15} strokeWidth={2.4} aria-hidden />
          All events
        </Link>
        {EVENT_CATEGORIES.map((category) => {
          const Icon = category.icon
          const active = activeCategory === category.key
          return (
            <Link
              key={category.key}
              ref={active ? activeChipRef : undefined}
              href={hrefFor({ category: category.key })}
              scroll={false}
              className="category-pill"
              data-category={category.key}
              data-active={active ? 'true' : undefined}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={15} strokeWidth={2.4} aria-hidden />
              {category.label}
            </Link>
          )
        })}
      </div>
      <div className="filter-controls">
        <label className="filter-select">
          <CalendarDays size={15} strokeWidth={2.2} aria-hidden />
          <span className="sr-only">Filter events by date</span>
          <select value={when} onChange={(event) => navigate(hrefFor({ when: event.target.value }))}>
            {EVENT_WHEN_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>
          <ChevronDown size={14} strokeWidth={2.4} aria-hidden />
        </label>
        <label className="filter-select">
          <ArrowDownUp size={15} strokeWidth={2.2} aria-hidden />
          <span className="sr-only">Sort events</span>
          <select value={sort} onChange={(event) => navigate(hrefFor({ sort: event.target.value }))}>
            {EVENT_SORT_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>
          <ChevronDown size={14} strokeWidth={2.4} aria-hidden />
        </label>
      </div>
    </div>
  )
}
