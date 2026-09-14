'use client'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'

type Ticket = { eventTitle: string; eventStartsAt: string; eventEndsAt: string; venueName: string | null; venueCity: string | null; ticketTypeName: string; attendeeName: string; attendeeEmail: string; status: string; publicId: string; qrDataUrl?: string }
export default function TicketDetailPage({ params }: { params: Promise<{ publicId: string }> }) {
  const [ticket, setTicket] = useState<Ticket | null>(null); const [error, setError] = useState('')
  useEffect(() => { params.then(({ publicId }) => fetch(`/api/tickets/${publicId}`).then(async (response) => { if (!response.ok) throw new Error('Ticket not found'); setTicket(await response.json()) }).catch((reason) => setError(reason.message))) }, [params])
  if (error) return <main className="auth-page"><p role="alert">{error}</p><Link href="/account/tickets">Back to tickets</Link></main>
  if (!ticket) return <main className="auth-page"><p>Loading ticket…</p></main>
  return <main className="auth-page stack"><Link href="/account/tickets">My tickets</Link><p className="eyebrow">Digital ticket</p><h1>{ticket.eventTitle}</h1><section className="surface stack"><p><strong>{ticket.ticketTypeName}</strong></p><p>{ticket.attendeeName} · {ticket.attendeeEmail}</p><p>{new Date(ticket.eventStartsAt).toLocaleString('en-UG')}–{new Date(ticket.eventEndsAt).toLocaleTimeString('en-UG')}</p><p>{ticket.venueName ?? 'Venue to be announced'}{ticket.venueCity ? ` · ${ticket.venueCity}` : ''}</p><p>Status: <strong>{ticket.status}</strong></p><p>Ticket reference: <strong>{ticket.publicId}</strong></p>{ticket.qrDataUrl ? <Image src={ticket.qrDataUrl} alt="Secure ticket QR credential" width={320} height={320} unoptimized /> : <p>QR credential unavailable.</p>}</section></main>
}
