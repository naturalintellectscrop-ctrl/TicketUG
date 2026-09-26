'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { buildEventIcs } from '@/lib/ics'
import { guestTokenStorageKey } from '@/lib/guest-order-access'

type Ticket = { eventTitle: string; eventStartsAt: string; eventEndsAt: string; venueName: string | null; venueCity: string | null; ticketTypeName: string; attendeeName: string; status: string; publicId: string; qrDataUrl?: string }

export default function GuestTicketPage({ params }: { params: Promise<{ publicId: string; ticketPublicId: string }> }) {
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [orderPublicId, setOrderPublicId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => { params.then(({ publicId, ticketPublicId }) => {
    setOrderPublicId(publicId)
    const token = sessionStorage.getItem(guestTokenStorageKey(publicId)) ?? ''
    fetch(`/api/public/orders/${publicId}/tickets/${ticketPublicId}`, { headers: { 'x-order-access-token': token } }).then(async (response) => { if (!response.ok) throw new Error('Ticket not found or guest access has expired'); setTicket(await response.json()) }).catch((reason) => setError(reason.message))
  }) }, [params])

  function downloadCalendar() {
    if (!ticket) return
    try {
      const ics = buildEventIcs({ uid: `${ticket.publicId}@ticketug.ug`, title: `${ticket.eventTitle} — ${ticket.ticketTypeName} (${ticket.attendeeName})`, startsAt: ticket.eventStartsAt, endsAt: ticket.eventEndsAt, location: [ticket.venueName, ticket.venueCity].filter(Boolean).join(', ') || null, description: `Ticket ${ticket.publicId} · show the QR credential at the entrance scan point · TicketUG by Natural Intellects Ltd` })
      const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `ticketug-event-${ticket.publicId}.ics`
      anchor.click()
      URL.revokeObjectURL(url)
      setNotice('Calendar file downloaded — the event now travels with your ticket.')
    } catch { setError('Could not build the calendar file for this ticket.') }
  }

  if (error) return <main className="auth-page stack"><p role="alert" className="error-text">{error}</p>{orderPublicId && <Link className="text-link" href={`/guest/orders/${orderPublicId}`}>Back to order</Link>}<Link className="text-link" href="/">Return home</Link></main>
  if (!ticket) return <main className="auth-page"><p>Loading ticket…</p></main>
  const venue = ticket.venueName ?? 'Venue to be announced'
  return <main className="auth-page stack">
    <Link className="text-link" href={orderPublicId ? `/guest/orders/${orderPublicId}` : '/'}>← Back to order</Link>
    <p className="eyebrow">Guest digital ticket</p>
    <div className="row-between">
      <h1>{ticket.eventTitle}</h1>
      <span className="status-pill" data-status={ticket.status}>{ticket.status.replace(/_/g, ' ').toLowerCase()}</span>
    </div>
    {notice && <p role="status" className="muted">{notice}</p>}
    <section className="surface stack" aria-label="Ticket details">
      <div className="row-between"><span className="muted">Attendee</span><strong>{ticket.attendeeName}</strong></div>
      <div className="row-between"><span className="muted">Ticket type</span><span>{ticket.ticketTypeName}</span></div>
      <div className="row-between"><span className="muted">When</span><time dateTime={ticket.eventStartsAt}>{new Date(ticket.eventStartsAt).toLocaleString('en-UG')} – {new Date(ticket.eventEndsAt).toLocaleTimeString('en-UG')}</time></div>
      <div className="row-between"><span className="muted">Where</span><span>{venue}{ticket.venueCity ? ` · ${ticket.venueCity}` : ''}</span></div>
      <div className="row-between"><span className="muted">Reference</span><code>{ticket.publicId}</code></div>
    </section>
    <section className="surface stack" aria-label="Entry credential">
      <h2>Entry QR credential</h2>
      {ticket.qrDataUrl ? <div className="qr-frame"><Image src={ticket.qrDataUrl} alt="Secure ticket QR credential" width={280} height={280} unoptimized /></div> : <p>QR credential unavailable.</p>}
      <p className="muted">Present this QR code at the entrance scan point. Each credential scans once — keep it private until you arrive.</p>
    </section>
    <section className="surface stack" aria-label="Ticket actions">
      <h2>Add to your plans</h2>
      <p className="muted">Download a calendar file so the event lands in your phone or laptop calendar with the exact times and venue.</p>
      <div className="hero-actions"><button type="button" className="button button-primary" onClick={downloadCalendar}>Add to calendar (.ics)</button></div>
    </section>
    <footer className="auth-footer muted">TicketUG · Natural Intellects Ltd — keep this ticket private; anyone with the QR credential could scan it first.</footer>
  </main>
}
