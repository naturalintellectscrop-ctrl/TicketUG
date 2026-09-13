import Link from "next/link"

const pillars = [
  ["Discover", "Find trusted events across Uganda with clear prices and venue details."],
  ["Organize", "Give organizers the tools to publish, sell, reconcile, and grow."],
  ["Verify", "Issue secure tickets and make entry fast for staff and attendees."]
]

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-xl font-bold tracking-tight">TicketUG</Link>
        <nav className="flex items-center gap-5 text-sm text-[var(--muted-foreground)]" aria-label="Primary navigation">
          <Link href="#how-it-works">How it works</Link>
          <Link href="/api/health">System status</Link>
          <Link href="#organizers" className="rounded-full bg-[var(--brand)] px-4 py-2 font-semibold text-[var(--brand-foreground)]">For organizers</Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl gap-12 px-6 pb-24 pt-16 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:pt-24">
        <div>
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">Made for live moments</p>
          <h1 className="max-w-3xl text-5xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-7xl">Your next great night starts here.</h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-[var(--muted-foreground)]">TicketUG brings attendees, organizers, and secure event entry together in one dependable platform built for Uganda.</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="#events" className="rounded-full bg-[var(--brand)] px-6 py-3 font-semibold text-[var(--brand-foreground)]">Explore events</Link>
            <Link href="#organizers" className="rounded-full border border-[var(--border)] px-6 py-3 font-semibold">Create an event</Link>
          </div>
        </div>
        <div className="rounded-[2rem] bg-[var(--brand)] p-8 text-[var(--brand-foreground)] shadow-2xl shadow-green-950/15">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-green-100">Built for confidence</p>
          <p className="mt-16 text-3xl font-semibold leading-tight">Simple checkout. Verified tickets. Happier crowds.</p>
          <div className="mt-20 border-t border-green-200/25 pt-5 text-sm text-green-100">Secure foundations are being assembled in Phase 1.</div>
        </div>
      </section>

      <section id="how-it-works" className="border-y border-[var(--border)] bg-white/45">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 md:grid-cols-3">
          {pillars.map(([title, body]) => <article key={title} className="flex flex-col gap-4"><h2 className="text-2xl font-semibold">{title}</h2><p className="leading-7 text-[var(--muted-foreground)]">{body}</p></article>)}
        </div>
      </section>

      <section id="events" className="mx-auto max-w-6xl px-6 py-20"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">Coming together</p><h2 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight">A better foundation for Uganda&apos;s event economy.</h2></section>
      <section id="organizers" className="mx-auto max-w-6xl px-6 pb-24"><div className="rounded-3xl border border-[var(--border)] bg-white p-8"><h2 className="text-2xl font-semibold">Organizers, your audience is waiting.</h2><p className="mt-3 max-w-xl leading-7 text-[var(--muted-foreground)]">TicketUG will make publishing, payments, ticket delivery, and event-day operations feel like one connected workflow.</p></div></section>
    </main>
  )
}
