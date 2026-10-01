import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

/**
 * Full-viewport welcome hero — the first screen someone sees when they have
 * finished logging in.
 *
 * Rendered on the post-authentication landing pages (/account for attendees,
 * /account/control-center for platform roles), not on the public landing:
 * the public homepage already opens with its own marketing hero, and what
 * belongs here is the "you are in" moment — a full-width, full-height brand
 * welcome with the two paths that matter next (browse events, how it works).
 *
 * Purely presentational server component: no session or DB access, so it
 * never blocks the landing render and looks identical for every role.
 */
export function WelcomeHero() {
  return (
    <section className="welcome-hero page-reveal" aria-label="Welcome to Ticket Uganda">
      <div className="welcome-hero-copy">
        <p className="eyebrow"><span className="eyebrow-line" /> Verified events · Secure tickets</p>
        <h2>A ticket that<br /><em>actually gets you in.</em></h2>
        <p>Every event on Ticket Uganda is published by a real organizer, and every QR is checked against our servers at the gate. Start with the events on sale right now.</p>
        <div className="welcome-hero-actions">
          <Link href="/events" className="button button-primary">Browse verified events <ArrowUpRight size={16} strokeWidth={2.6} aria-hidden /></Link>
          <Link href="/#how-it-works" className="button button-white">How it works</Link>
        </div>
      </div>
    </section>
  )
}
