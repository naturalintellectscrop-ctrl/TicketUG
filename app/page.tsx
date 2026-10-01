import Link from "next/link"
import { ArrowRight, ArrowUpRight, Sparkles } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { EventCard } from "@/components/event-card"
import { getUpcomingPublicEvents, type PublicEventCard } from "@/lib/public-events"
import { EVENT_CATEGORIES } from "@/lib/event-categories"
import { SITE_NAME, SITE_DESCRIPTION, SITE_URL } from "@/lib/site"
import { logServerError } from '@/lib/server/errors'

export const dynamic = "force-dynamic"

const pillars = [
  { number: "01", title: "Find your people", body: "Discover the nights, rooms, and sounds worth showing up for — with the details you need before you tap buy." },
  { number: "02", title: "Build the buzz", body: "Publish an event, shape your ticket tiers, and keep the whole door-to-dancefloor story in one place." },
  { number: "03", title: "Open the door", body: "Secure QR tickets make arrival feel less like a queue and more like the beginning of the night." }
]

// Marketing moodboard, not event data: these are illustrative photos of the
// kinds of nights Ticket Uganda is built for, shown only while the public listing
// is empty. Real event cards take over the moment organizers publish.
const showcaseTiles = [
  { src: "/showcase/hero-stage.jpg", caption: "Concert nights", alt: "Stage lights over a concert crowd at night" },
  { src: "/showcase/food-festival.jpg", caption: "Food markets", alt: "Rolex chapati wraps being prepared at a busy food market" },
  { src: "/showcase/culture-day.jpg", caption: "Culture days", alt: "Traditional dancers in bright kitenge costumes" },
  { src: "/showcase/football-night.jpg", caption: "Match nights", alt: "Football fans celebrating under stadium lights" },
  { src: "/showcase/sunday-gospel.jpg", caption: "Sunday sessions", alt: "Gospel choir singing outdoors in golden light" }
]

// SEO: tell search engines this is the Uganda ticketing destination and link
// the site search box into Google's sitelinks searchbox.
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      inLanguage: 'en-UG',
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/events?q={search_term_string}` },
        'query-input': 'required name=search_term_string'
      }
    },
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'Ticket Uganda',
      legalName: 'Natural Intellects Ltd',
      url: SITE_URL,
      areaServed: { '@type': 'Country', name: 'Uganda' },
      knowsAbout: ['event ticketing', 'concerts', 'festivals', 'parties', 'sports events', 'Uganda']
    }
  ]
}

export default async function HomePage() {
  let upcoming: PublicEventCard[] = []
  let eventsUnavailable = false
  try {
    upcoming = await getUpcomingPublicEvents(6)
  } catch (error) {
    logServerError('page:landing', error)
    eventsUnavailable = true
  }
  return (
    <main className="flex min-h-screen flex-col overflow-hidden">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader nextPath="/account">
        <Link href="#how-it-works">The rhythm</Link>
        <Link href="#trust">Why Ticket Uganda</Link>
      </SiteHeader>

      <section className="hero-section page-reveal">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-line" /> Kampala, Uganda · Live now</p>
          <h1>Make room<br /><em>for more.</em></h1>
          <p className="hero-lede">Ticket Uganda is where Uganda&apos;s best nights find their people. Buy your seat, build your crowd, and walk in ready.</p>
          <div className="hero-actions">
            <Link href="/events" className="button button-primary">Find an event <ArrowUpRight size={16} strokeWidth={2.6} aria-hidden /></Link>
            <Link href="#organizers" className="button button-quiet">I&apos;m an organizer <ArrowRight size={16} strokeWidth={2.6} aria-hidden /></Link>
          </div>
          <div className="hero-note"><span className="pulse-dot" /> Secure QR tickets, verified at the gate.</div>
        </div>
        <div className="hero-art">
          <div className="hero-blob hero-blob-one" aria-hidden="true" />
          <div className="hero-blob hero-blob-two" aria-hidden="true" />
          <figure className="hero-photo hero-photo-main">
            {/* eslint-disable-next-line @next/next/no-img-element -- static showcase art shipped in /public; plain img keeps the marketing shell dependency-free */}
            <img src="/showcase/hero-main.jpg" alt="Festival crowd with raised hands at golden hour in Kampala" />
          </figure>
          <figure className="hero-photo hero-photo-side">
            {/* eslint-disable-next-line @next/next/no-img-element -- static showcase art shipped in /public; plain img keeps the marketing shell dependency-free */}
            <img src="/showcase/hero-dj.jpg" alt="DJ performing under neon party lights" />
          </figure>
          <figure className="hero-photo hero-photo-wide">
            {/* eslint-disable-next-line @next/next/no-img-element -- static showcase art shipped in /public; plain img keeps the marketing shell dependency-free */}
            <img src="/showcase/hero-stage.jpg" alt="Stage lights over a concert crowd at night" />
          </figure>
          <span className="hero-ticket-stub" aria-hidden="true"><span>ADMIT ONE</span><span>UG · 001</span></span>
          <span className="float-label label-top">sold out energy</span><span className="float-label label-bottom">good people inside</span>
        </div>
      </section>

      <section className="category-section page-reveal" aria-label="Browse events by category">
        <div className="category-strip">
          <Link href="/events" className="category-pill category-all">
            <Sparkles size={15} strokeWidth={2.4} aria-hidden />
            All events
          </Link>
          {EVENT_CATEGORIES.map((category) => {
            const Icon = category.icon
            return (
              <Link key={category.key} href={`/events?category=${category.key}`} className="category-pill" data-category={category.key}>
                <Icon size={15} strokeWidth={2.4} aria-hidden />
                {category.label}
              </Link>
            )
          })}
        </div>
      </section>

      <section id="how-it-works" className="rhythm-section">
        <div className="section-intro"><p className="eyebrow">The rhythm</p><h2>One platform.<br /><span>Every kind of night.</span></h2></div>
        <div className="pillar-grid">{pillars.map((pillar) => <article key={pillar.number} className="pillar-card"><span className="pillar-number">{pillar.number}</span><h3>{pillar.title}</h3><p>{pillar.body}</p><span className="pillar-arrow" aria-hidden="true"><ArrowUpRight size={22} strokeWidth={2.2} /></span></article>)}</div>
      </section>

      <section id="events" className="events-banner events-real">
        <div className="section-intro"><p className="eyebrow">Upcoming events</p><h2>The night is<br /><em>already yours.</em></h2></div>
        {eventsUnavailable ? (
          <p className="muted">Event listings are temporarily unavailable. Please try again shortly.</p>
        ) : upcoming.length ? (
          <>
            <div className="event-card-grid">{upcoming.map((event) => <EventCard key={event.publicId} event={event} />)}</div>
            <div className="row"><Link href="/events" className="button button-dark">Browse all events <ArrowUpRight size={16} strokeWidth={2.6} aria-hidden /></Link></div>
          </>
        ) : (
          <div className="events-showcase">
            <div className="showcase-grid">
              {showcaseTiles.map((tile) => (
                <figure className="showcase-tile" key={tile.src}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- static showcase art shipped in /public; plain img keeps the marketing shell dependency-free */}
                  <img src={tile.src} alt={tile.alt} loading="lazy" />
                  <figcaption>{tile.caption}</figcaption>
                </figure>
              ))}
            </div>
            <div className="events-empty surface">
              <p><strong>No upcoming events are on the board yet.</strong></p>
              <p className="muted">Organizers publish events here the moment they go on sale. Check back soon — or be the one who puts the next night on the board.</p>
              <Link href="/sign-up" className="text-link">Be the first to list one <ArrowUpRight size={15} strokeWidth={2.6} aria-hidden /></Link>
            </div>
          </div>
        )}
      </section>

      <section id="organizers" className="organizer-banner"><div className="organizer-stamp">FOR<br />THE<br /><i>makers</i></div><div><p className="eyebrow">Organizers</p><h2>You bring the spark.<br /><span>We&apos;ll handle the door.</span></h2><p>Publishing, payments, ticket delivery, and event-day operations — one connected workflow, without the spreadsheet maze.</p><Link href="/sign-up" className="button button-dark">Start making <ArrowUpRight size={16} strokeWidth={2.6} aria-hidden /></Link></div></section>

      <section id="trust" className="trust-section">
        <div className="section-intro"><p className="eyebrow">Why Ticket Uganda</p><h2>Fun on the surface.<br /><span>Serious underneath.</span></h2></div>
        <div className="trust-grid">
          <article className="trust-card"><h3>Verified at the gate</h3><p>Every QR is checked against the ticket registry on our servers — validity, status, and gate — before entry is confirmed, and a ticket checks in exactly once.</p></article>
          <article className="trust-card"><h3>Doors that know their tiers</h3><p>Tickets can be scoped to specific gates, so a standard ticket can&apos;t wander into VIP — enforced by the scanner, not the honor system.</p></article>
          <article className="trust-card"><h3>Orders you can get back</h3><p>Lose your phone or your session? A secure recovery link brings your order and tickets back.</p></article>
        </div>
      </section>

      <footer className="site-footer mt-auto"><span className="brand-mark"><span className="brand-dot" />Ticket Uganda</span><span>Built for the moments that matter.</span><Link href="/contact">Contact</Link><span>© 2026 Ticket Uganda</span></footer>
    </main>
  )
}
