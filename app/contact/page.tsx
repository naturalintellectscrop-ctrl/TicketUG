import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

// Ported from v0/ticketug-sitewide-motion (branch retired by merge): the real
// TicketUG support contacts committed by the team, carried over verbatim and
// restyled for the current palette.
const contacts = [
  { label: "Call or WhatsApp", value: "+256752256576", href: "tel:+256752256576" },
  { label: "Call or WhatsApp", value: "+256762449504", href: "tel:+256762449504" },
]

export const metadata = {
  title: "Contact Ticket Uganda support",
  description: "Reach the Ticket Uganda team by phone or WhatsApp at +256 752 256 576 / +256 762 449 504 — help with orders, tickets, check-ins, payouts and organizer onboarding.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact Ticket Uganda support",
    description: "Phone or WhatsApp the Ticket Uganda team — help with orders, tickets, check-ins, payouts and organizer onboarding."
  }
}

export default function ContactPage() {
  return (
    <main className="page-shell contact-page">
      <div className="contact-hero">
        <p className="contact-kicker">Ticket Uganda support</p>
        <h1>Let&apos;s make<br /><em>it happen.</em></h1>
        <p className="contact-lede">Questions about an event, a ticket, or bringing your own gathering to life? Reach the Ticket Uganda team directly.</p>
      </div>
      <section className="contact-grid" aria-label="Contact options">
        {contacts.map((contact) => (
          <a className="contact-card" href={contact.href} key={contact.value}>
            <span>{contact.label}</span>
            <strong>{contact.value}</strong>
            <small>Tap to call</small>
          </a>
        ))}
        <div className="contact-card contact-card-muted">
          <span>Good to know</span>
          <strong>We&apos;re here to help</strong>
          <small>Have your event name or ticket details nearby so we can get you sorted quickly.</small>
        </div>
      </section>
      <Link href="/" className="button button-quiet">Return home <ArrowUpRight size={16} strokeWidth={2.6} aria-hidden /></Link>
    </main>
  )
}
