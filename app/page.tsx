import Link from "next/link"
import { SiteHeader } from "@/components/site-header"
import { EventCard } from "@/components/event-card"
import { getUpcomingPublicEvents, type PublicEventCard } from "@/lib/public-events"

export const dynamic = "force-dynamic"

const pillars = [
  { number: "01", title: "Find your people", body: "Discover the nights, rooms, and sounds worth showing up for — with the details you need before you tap buy." },
  { number: "02", title: "Build the buzz", body: "Publish an event, shape your ticket tiers, and keep the whole door-to-dancefloor story in one place." },
  { number: "03", title: "Open the door", body: "Secure QR tickets make arrival feel less like a queue and more like the beginning of the night." }
]

export default async function HomePage() {
  let upcoming: PublicEventCard[] = []
  let eventsUnavailable = false
  try {
    upcoming = await getUpcomingPublicEvents(6)
  } catch {
    eventsUnavailable = true
  }
  return (
    <main className="min-h-screen overflow-hidden">
      <SiteHeader nextPath="/account">
        <Link href="#how-it-works">The rhythm</Link>
        <Link href="#trust">Why TicketUG</Link>
      </SiteHeader>

      <section className="hero-section page-reveal">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-line" /> Kampala, Uganda · Live now</p>
          <h1>Make room<br /><em>for more.</em></h1>
          <p className="hero-lede">TicketUG is where Uganda&apos;s best nights find their people. Buy your seat, build your crowd, and walk in ready.</p>
          <div className="hero-actions">
            <Link href="/events" className="button button-primary">Find an event <span aria-hidden="true">↗</span></Link>
            <Link href="#organizers" className="button button-quiet">I&apos;m an organizer <span aria-hidden="true">→</span></Link>
          </div>
          <div className="hero-note"><span className="pulse-dot" /> Secure QR tickets, verified at the gate.</div>
        </div>
        <div className="hero-art" aria-label="Illustration of a live event ticket" role="img">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="ticket-card">
            <div className="ticket-top"><span>ADMIT ONE</span><span>UG · 001</span></div>
            <div className="ticket-art"><span className="ticket-spark spark-one">✦</span><span className="ticket-spark spark-two">✦</span><strong>Night<br /><i>shift</i></strong><span className="ticket-ring" /></div>
            <div className="ticket-bottom"><span>FRI 14 · KLA</span><span className="ticket-barcode" /></div>
          </div>
          <span className="float-label label-top">sold out energy</span><span className="float-label label-bottom">good people inside</span>
        </div>
      </section>

      <section id="how-it-works" className="rhythm-section">
        <div className="section-intro"><p className="eyebrow">The rhythm</p><h2>One platform.<br /><span>Every kind of night.</span></h2></div>
        <div className="pillar-grid">{pillars.map((pillar) => <article key={pillar.number} className="pillar-card"><span className="pillar-number">{pillar.number}</span><h3>{pillar.title}</h3><p>{pillar.body}</p><span className="pillar-arrow" aria-hidden="true">↗</span></article>)}</div>
      </section>

      <section id="events" className="events-banner events-real">
        <div className="section-intro"><p className="eyebrow">Upcoming events</p><h2>The night is<br /><em>already yours.</em></h2></div>
        {eventsUnavailable ? (
          <p className="muted">Event listings are temporarily unavailable. Please try again shortly.</p>
        ) : upcoming.length ? (
          <>
            <div className="event-card-grid">{upcoming.map((event) => <EventCard key={event.publicId} event={event} />)}</div>
            <div className="row"><Link href="/events" className="button button-dark">Browse all events <span aria-hidden="true">↗</span></Link></div>
          </>
        ) : (
          <div className="events-empty surface">
            <p><strong>No upcoming events are available right now.</strong></p>
            <p className="muted">Organizers publish events here the moment they go on sale. Check back soon — or be the one who puts the next night on the board.</p>
            <Link href="/sign-up" className="text-link">Get on the list <span aria-hidden="true">↗</span></Link>
          </div>
        )}
      </section>

      <section id="organizers" className="organizer-banner"><div className="organizer-stamp">FOR<br />THE<br /><i>makers</i></div><div><p className="eyebrow">Organizers</p><h2>You bring the spark.<br /><span>We&apos;ll handle the door.</span></h2><p>Publishing, payments, ticket delivery, and event-day operations — one connected workflow, without the spreadsheet maze.</p><Link href="/sign-up" className="button button-dark">Start making <span aria-hidden="true">↗</span></Link></div></section>

      <section id="trust" className="trust-section">
        <div className="section-intro"><p className="eyebrow">Why TicketUG</p><h2>Fun on the surface.<br /><span>Serious underneath.</span></h2></div>
        <div className="trust-grid">
          <article className="trust-card"><h3>Verified at the gate</h3><p>Every QR is checked against the ticket registry on our servers — validity, status, and gate — before entry is confirmed, and a ticket checks in exactly once.</p></article>
          <article className="trust-card"><h3>Doors that know their tiers</h3><p>Tickets can be scoped to specific gates, so a standard ticket can&apos;t wander into VIP — enforced by the scanner, not the honor system.</p></article>
          <article className="trust-card"><h3>Orders you can get back</h3><p>Lose your phone or your session? A secure recovery link brings your order and tickets back.</p></article>
        </div>
      </section>

      <footer className="site-footer"><span className="brand-mark"><span className="brand-dot" />TicketUG</span><span>Built for the moments that matter.</span><Link href="/contact">Contact</Link><span>© 2026 TicketUG</span></footer>
    </main>
  )
}
