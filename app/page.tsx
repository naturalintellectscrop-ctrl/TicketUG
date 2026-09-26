import Link from "next/link"
import { SiteHeader } from "@/components/site-header"

export const dynamic = "force-dynamic"

const pillars = [
  { number: "01", title: "Find your people", body: "Discover the nights, rooms, and sounds worth showing up for — with the details you need before you tap buy." },
  { number: "02", title: "Build the buzz", body: "Publish an event, shape your ticket tiers, and keep the whole door-to-dancefloor story in one place." },
  { number: "03", title: "Open the door", body: "Secure QR tickets make arrival feel less like a queue and more like the beginning of the night." }
]

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden">
      <SiteHeader nextPath="/account">
        <Link href="#how-it-works">The rhythm</Link>
        <Link href="/api/health">System status</Link>
      </SiteHeader>

      <section className="hero-section page-reveal">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-line" /> Kampala, Uganda · Live now</p>
          <h1>Make room<br /><em>for more.</em></h1>
          <p className="hero-lede">TicketUG is where Uganda&apos;s best nights find their people. Buy your seat, build your crowd, and walk in ready.</p>
          <div className="hero-actions">
            <Link href="#events" className="button button-primary">Find an event <span aria-hidden="true">↗</span></Link>
            <Link href="#organizers" className="button button-quiet">I&apos;m an organizer <span aria-hidden="true">→</span></Link>
          </div>
          <div className="hero-note"><span className="pulse-dot" /> No gatekeeping. Just good nights.</div>
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

      <section id="events" className="events-banner"><div><p className="eyebrow">Coming together</p><h2>The night is<br /><em>already yours.</em></h2></div><div className="banner-side"><p>From rooftop sets to community stages, find your next reason to leave the house.</p><Link href="/sign-up" className="text-link">Get on the list <span aria-hidden="true">↗</span></Link></div></section>

      <section id="organizers" className="organizer-banner"><div className="organizer-stamp">FOR<br />THE<br /><i>makers</i></div><div><p className="eyebrow">Organizers</p><h2>You bring the spark.<br /><span>We&apos;ll handle the door.</span></h2><p>Publishing, payments, ticket delivery, and event-day operations — one connected workflow, without the spreadsheet maze.</p><Link href="/sign-up" className="button button-dark">Start making <span aria-hidden="true">↗</span></Link></div></section>
      <footer className="site-footer"><span className="brand-mark"><span className="brand-dot" />TicketUG</span><span>Built for the moments that matter.</span><span>© 2026 TicketUG</span></footer>
    </main>
  )
}
