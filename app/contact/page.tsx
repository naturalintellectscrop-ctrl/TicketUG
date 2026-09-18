import Link from "next/link"

const contacts = [
  { label: "Call or WhatsApp", value: "+256752256576", href: "tel:+256752256576" },
  { label: "Call or WhatsApp", value: "+256762449504", href: "tel:+256762449504" },
]

export default function ContactPage() {
  return (
    <main className="page-shell contact-page">
      <div className="contact-hero">
        <p className="contact-kicker">TicketUG support</p>
        <h1>Let&apos;s make<br /><em>it happen.</em></h1>
        <p className="contact-lede">Questions about an event, a ticket, or bringing your own gathering to life? Reach the TicketUG team directly.</p>
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
      <Link href="/" className="button button-quiet">Return home <span aria-hidden="true">↗</span></Link>
    </main>
  )
}
