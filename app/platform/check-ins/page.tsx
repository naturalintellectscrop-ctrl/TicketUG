import Link from 'next/link'
import { Metric, UnavailablePanel } from '@/components/platform/ui'
import { loadCheckInOverview } from '@/lib/platform/queries'
import { formatDateTime } from '@/lib/platform/format'

export const dynamic = 'force-dynamic'

/** Gate activity, exactly as the atomic check-in table recorded it. Rejected
 * and duplicate scan attempts are NOT persisted anywhere (the UNIQUE(ticket_id)
 * constraint rejects them at write time), so this page shows verified entries
 * only and says so — reconstructed rejection numbers would be fiction. */
export default async function PlatformCheckInsPage() {
  const overview = await loadCheckInOverview()
  const totalScans = overview?.perEvent.reduce((sum, event) => sum + event.checkedIn, 0) ?? 0

  return (
    <main className="platform-shell">
      <header className="section-heading">
        <div>
          <p className="eyebrow">Verified entry</p>
          <h1>Check-ins</h1>
          <p className="lede">What the gates have actually verified, straight from the check-in registry. Each ticket can check in exactly once — the database enforces it, so these numbers are the door&apos;s truth.</p>
        </div>
      </header>

      {overview === null ? (
        <UnavailablePanel what="Check-in data" />
      ) : (
        <>
          <section className="platform-section">
            <div className="metric-grid">
              <Metric label="Verified entries" value={totalScans.toLocaleString('en-UG')} note="Sum over events with activity" />
              <Metric label="Events with check-ins" value={overview.perEvent.length.toLocaleString('en-UG')} note="Events seen at a gate" />
              <Metric label="Active scanners" value={overview.scanners.length.toLocaleString('en-UG')} note="Staff who have scanned" />
              <Metric label="Duplicate attempts" value="Not recorded" note="Rejected at write time by the registry — never persisted" />
            </div>
          </section>

          <section className="platform-section">
            <div className="section-heading"><div><p className="eyebrow">By event</p><h2>Gate totals</h2></div></div>
            {overview.perEvent.length === 0 ? <p className="muted empty-state">No check-ins anywhere on the platform yet.</p> : (
              <div className="platform-scroll">
                <table className="platform-table">
                  <thead><tr><th scope="col">Event</th><th scope="col">Organizer</th><th scope="col" className="num">Tickets issued</th><th scope="col" className="num">Checked in</th><th scope="col" className="num">Entry rate</th><th scope="col">Last scan</th></tr></thead>
                  <tbody>
                    {overview.perEvent.map((event) => (
                      <tr key={event.eventId}>
                        <td><Link href={`/platform/events/${event.eventPublicId}`}>{event.eventTitle}</Link></td>
                        <td>{event.organizerName}</td>
                        <td className="num">{event.ticketsIssued.toLocaleString('en-UG')}</td>
                        <td className="num">{event.checkedIn.toLocaleString('en-UG')}</td>
                        <td className="num">{event.ticketsIssued > 0 ? `${Math.round((event.checkedIn / event.ticketsIssued) * 100)}%` : '—'}</td>
                        <td>{event.lastCheckInAt ? formatDateTime(event.lastCheckInAt) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="platform-section">
            <div className="section-heading"><div><p className="eyebrow">People</p><h2>Scanners &amp; latest scans</h2></div></div>
            <div className="admin-columns">
              <article className="surface stack">
                <p className="eyebrow">Most active scanners</p>
                {overview.scanners.length === 0 ? <p className="muted">No scans recorded.</p> : overview.scanners.map((scanner) => (
                  <div className="row-between" key={scanner.profileId}>
                    <span><Link href={`/platform/users/${scanner.profileId}`}>{scanner.scannerName ?? 'Unnamed scanner'}</Link></span>
                    <span>{scanner.scans.toLocaleString('en-UG')} scans<span className="table-cell-sub">{scanner.lastScanAt ? `last ${formatDateTime(scanner.lastScanAt)}` : ''}</span></span>
                  </div>
                ))}
              </article>
              <article className="surface stack">
                <p className="eyebrow">Latest verified scans</p>
                {overview.recent.length === 0 ? <p className="muted">No scans recorded.</p> : overview.recent.map((scan) => (
                  <div className="row-between" key={scan.ticketPublicId}>
                    <span>{scan.eventTitle}<span className="table-cell-sub">{scan.ticketPublicId} · by {scan.scannerName ?? 'unknown'}</span></span>
                    <span className="muted">{formatDateTime(scan.checkedInAt)}</span>
                  </div>
                ))}
              </article>
            </div>
          </section>
        </>
      )}
    </main>
  )
}
