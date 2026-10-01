import Link from 'next/link'
import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { PlatformAlert } from '@/lib/platform/alerts'

/**
 * Shared presentational pieces for the Platform Control Center.
 * Server components only — the control center ships zero client JS apart
 * from the active-state nav.
 */

/** Status chip. Tone is semantic, never decorative: ok/verified, info/neutral,
 * warn/attention, bad/failed, brand/identity. */
export function StatusPill({ tone = 'info', children }: { tone?: 'ok' | 'info' | 'warn' | 'bad' | 'brand'; children: ReactNode }) {
  return <span className="pill" data-tone={tone}>{children}</span>
}

/** Maps a system status value to a pill tone. Unknown values stay neutral. */
export function stateTone(value: string): 'ok' | 'info' | 'warn' | 'bad' {
  switch (value) {
    case 'PAID':
    case 'SUCCEEDED':
    case 'CHECKED_IN':
    case 'PROCESSED':
    case 'SALES_OPEN':
    case 'EVENT_LIVE':
    case 'PUBLIC':
    case 'ACTIVE':
    case 'ISSUED':
      return 'ok'
    case 'AWAITING_PAYMENT':
    case 'PENDING':
    case 'PROCESSING':
    case 'RECEIVED':
    case 'PUBLISHED':
    case 'DUPLICATE':
      return 'info'
    case 'PAYMENT_PROCESSING':
    case 'SUSPENDED':
    case 'SALES_CLOSED':
      return 'warn'
    case 'FAILED':
    case 'REJECTED':
    case 'CANCELLED':
    case 'EXPIRED':
    case 'VOID':
    case 'REFUNDED':
      return 'bad'
    default:
      return 'info'
  }
}

/** Truthful "cannot compute right now" panel — used when the database is
 * unreachable. Never renders zeros in its place. */
export function UnavailablePanel({ what }: { what: string }) {
  return (
    <section className="surface stack" aria-live="polite">
      <p className="eyebrow">Unavailable</p>
      <h2>{what} could not be loaded</h2>
      <p className="muted">
        The database could not be reached, so nothing is shown rather than showing numbers that would be guesses.
        Refresh to retry — if this persists, check the runtime logs and the deployment&apos;s database configuration.
      </p>
    </section>
  )
}

export function EmptyState({ message }: { message: string }) {
  return <p className="muted empty-state">{message}</p>
}

/** Server-rendered pagination over a known total. Links preserve the current
 * filter query string; offset arithmetic mirrors the loaders. `pageParam`
 * lets two independent lists coexist on one page (payments vs webhooks). */
export function Pagination({ page, pageSize, total, baseHref, pageParam = 'page' }: { page: number; pageSize: number; total: number; baseHref: string; pageParam?: string }) {
  const maxPage = Math.max(1, Math.ceil(total / pageSize))
  const separator = baseHref.includes('?') ? '&' : '?'
  const prev = page > 1 ? `${baseHref}${separator}${pageParam}=${page - 1}` : null
  const next = page < maxPage ? `${baseHref}${separator}${pageParam}=${page + 1}` : null
  if (total === 0) return null
  return (
    <nav className="pagination" aria-label="Pagination">
      <span className="muted">{total.toLocaleString('en-UG')} total · page {page} of {maxPage}</span>
      <span className="pagination-links">
        {prev ? <Link className="button button-quiet" href={prev}><ChevronLeft size={15} strokeWidth={2.4} aria-hidden /> Previous</Link> : <span className="button button-quiet" aria-disabled="true"><ChevronLeft size={15} strokeWidth={2.4} aria-hidden /> Previous</span>}
        {next ? <Link className="button button-quiet" href={next}>Next <ChevronRight size={15} strokeWidth={2.4} aria-hidden /></Link> : <span className="button button-quiet" aria-disabled="true">Next <ChevronRight size={15} strokeWidth={2.4} aria-hidden /></span>}
      </span>
    </nav>
  )
}

export function AlertList({ alerts }: { alerts: PlatformAlert[] }) {
  if (alerts.length === 0) {
    return (
      <section className="alert-list" aria-label="Operational alerts">
        <div className="alert-item" data-severity="ok">
          <span className="alert-dot" aria-hidden="true" />
          <div><strong>No operational alerts.</strong><p className="muted">Every monitored counter is clean right now.</p></div>
        </div>
      </section>
    )
  }
  return (
    <section className="alert-list" aria-label="Operational alerts">
      {alerts.map((alert) => (
        <div className="alert-item" data-severity={alert.severity} key={alert.href + alert.title}>
          <span className="alert-dot" aria-hidden="true" />
          <div>
            <strong>{alert.title}</strong>
            <p className="muted">{alert.detail}</p>
            <Link href={alert.href} className="text-link">Open the relevant view</Link>
          </div>
        </div>
      ))}
    </section>
  )
}

/** Simple metric tile. `note` carries the semantics that keep a number honest
 * (e.g. "pre-fee, provider-collected"). */
export function Metric({ label, value, note, href }: { label: string; value: string; note?: string; href?: string }) {
  const body = (
    <>
      <p className="eyebrow">{label}</p>
      <strong>{value}</strong>
      {note && <p className="muted">{note}</p>}
    </>
  )
  return href
    ? <Link className="surface metric-card metric-link" href={href}>{body}</Link>
    : <article className="surface metric-card">{body}</article>
}
