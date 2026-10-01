import Link from 'next/link'
import type { Metadata } from 'next'
import { CalendarSearch, Home, Ticket } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'

// Brand-styled 404 — event pages call notFound() for unknown/undiscoverable
// slugs, so this is a real public surface, not an edge case.
export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="page-shell">
        <p className="eyebrow">404 — nothing here</p>
        <h1>This ticket<br /><em>doesn&apos;t exist.</em></h1>
        <p className="lede">
          The page you followed may have been moved, expired, or mistyped. If you
          followed a ticket link, double-check it — every Ticket Uganda order has
          its own access link.
        </p>
        <div className="row-between" style={{ maxWidth: 420 }}>
          <Link href="/events" className="button"><Ticket size={17} strokeWidth={2.4} aria-hidden /> Browse events</Link>
          <Link href="/" className="button button-quiet"><Home size={16} strokeWidth={2.4} aria-hidden /> Home</Link>
        </div>
        <section className="surface stack" style={{ marginTop: 40 }}>
          <p className="eyebrow">Looking for something else?</p>
          <p className="muted" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 9 }}>
            <CalendarSearch size={17} strokeWidth={2.2} aria-hidden /> Find concerts, festivals, parties and more on the events page — no account needed to buy.
          </p>
        </section>
      </main>
    </>
  )
}
