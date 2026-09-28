export default function EventsLoading() {
  return (
    <main className="events-index">
      <div className="page-shell" aria-busy="true" aria-live="polite">
        <p className="eyebrow">Discover</p>
        <h1>Events in Uganda</h1>
        <div className="event-card-grid" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => <div className="event-card surface skeleton-card" key={index} />)}
        </div>
        <p className="sr-only">Loading events…</p>
      </div>
    </main>
  )
}
