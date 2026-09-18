import Link from "next/link"

const pillars = [
      { number: "01", title: "Find your people", body: "Discover the gatherings, rooms, and sounds worth showing up for — with the details you need before you tap buy." },

      { number: "02", title: "Build the buzz", body: "Publish a gathering, shape your ticket tiers, and keep the whole arrival-to-applause story in one place." },

      { number: "03", title: "Open the door", body: "Secure QR tickets make arrival feel less like a queue and more like the beginning of something memorable." }

]

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden">
      <header className="site-header page-reveal">
        <Link href="/" className="brand-mark" aria-label="TicketUG home"><span className="brand-dot" />TicketUG</Link>
        <nav className="site-nav" aria-label="Primary navigation">
          <Link href="#how-it-works">The rhythm</Link>
          <Link href="/api/health">System status</Link>
          <Link href="#organizers" className="nav-cta">Make a moment <span aria-hidden="true">↗</span></Link>
        </nav>
      </header>

      <section className="hero-section page-reveal">
        <div className="hero-copy">
          <h1>Make room<br /><em>for more.</em></h1>
          <p className="hero-lede">TicketUG is where Uganda&apos;s best gatherings find their people. Reserve your place, build your crowd, and show up ready.</p>
          <div className="hero-actions">
            <Link href="#events" className="button button-primary">Find an event <span aria-hidden="true">↗</span></Link>
            <Link href="#organizers" className="button button-quiet">I&apos;m an organizer <span aria-hidden="true">→</span></Link>
          </div>
          <div className="hero-note"><span className="pulse-dot" /> No gatekeeping. Just good moments.</div>
        </div>
        <div className="hero-art" aria-label="Illustration of a live event ticket" role="img">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="ticket-card">
            <div className="ticket-top"><span>ADMIT ONE</span><span>UG · 001</span></div>
            <div className="ticket-art"><span className="ticket-spark spark-one">✦</span><span className="ticket-spark spark-two">✦</span><strong>Good<br /><i>times</i></strong><span className="ticket-ring" /></div>
            <div className="ticket-bottom"><span>FRI 14 · KLA</span><span className="ticket-barcode" /></div>
          </div>
          <span className="float-label label-top">show up curious</span><span className="float-label label-bottom">good people inside</span>
        </div>
      </section>

      <section id="how-it-works" className="rhythm-section">
        <div className="section-intro"><h2>One platform.<br /><span>Every kind of gathering.</span></h2></div>
        <div className="pillar-grid">{pillars.map((pillar) => <article key={pillar.number} className="pillar-card"><span className="pillar-number">{pillar.number}</span><h3>{pillar.title}</h3><p>{pillar.body}</p><span className="pillar-arrow" aria-hidden="true">↗</span></article>)}</div>
      </section>

      <section id="events" className="events-banner"><div><h2>Your next moment<br /><em>is already here.</em></h2></div><div className="banner-side"><p>From rooftop sets to community stages, find your next reason to step into something shared.</p><Link href="/sign-up" className="text-link">Get on the list <span aria-hidden="true">↗</span></Link></div></section>

      <section className="details-section" aria-labelledby="details-heading">
        <div className="section-intro"><h2 id="details-heading">Everything you need<br /><span>before the doors open.</span></h2><p className="details-lede">TicketUG keeps the full event journey in one calm, clear place — from the first announcement to the final scan.</p></div>
        <div className="details-grid">
          <article className="detail-card"><span className="detail-icon">01</span><h3>Clear event pages</h3><p>Share the date, venue, lineup, ticket tiers, policies, and what guests should know before they commit.</p></article>
          <article className="detail-card"><span className="detail-icon">02</span><h3>Tickets that travel</h3><p>Guests receive a digital ticket with a secure QR code, ready to find on their phone when it is time to arrive.</p></article>
          <article className="detail-card"><span className="detail-icon">03</span><h3>A smoother door</h3><p>Organizers can verify tickets quickly, see attendance signals, and keep the welcome focused on people.</p></article>
          <article className="detail-card"><span className="detail-icon">04</span><h3>Built for local energy</h3><p>From intimate workshops to city-wide showcases, TicketUG gives every kind of gathering room to grow.</p></article>
        </div>
      </section>

      <section id="organizers" className="organizer-banner"><div className="organizer-stamp">FOR<br />THE<br /><i>makers</i></div><div><h2>You bring the spark.<br /><span>We&apos;ll handle the door.</span></h2><p>Publishing, payments, ticket delivery, and event-day operations — one connected workflow, without the spreadsheet maze.</p><Link href="/sign-up" className="button button-dark">Start making <span aria-hidden="true">↗</span></Link></div></section>
      <footer className="site-footer"><span className="brand-mark"><span className="brand-dot" />TicketUG</span><span>Built for the moments that matter.</span><span>© 2026 TicketUG</span></footer>
    </main>
  )
}
