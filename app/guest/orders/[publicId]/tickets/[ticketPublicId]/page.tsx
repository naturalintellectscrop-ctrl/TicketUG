'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'

type Ticket = { eventTitle: string; eventStartsAt: string; eventEndsAt: string; venueName: string | null; venueCity: string | null; ticketTypeName: string; attendeeName: string; status: string; publicId: string; qrDataUrl?: string }

export default function GuestTicketPage({ params }: { params: Promise<{ publicId: string; ticketPublicId: string }> }) {
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { params.then(({ publicId, ticketPublicId }) => { const token = sessionStorage.getItem(`ticketug:guest-token:${publicId}`) ?? ''; fetch(`/api/public/orders/${publicId}/tickets/${ticketPublicId}`, { headers: { 'x-order-access-token': token } }).then(async (response) => { if (!response.ok) throw new Error('Ticket not found or guest access has expired'); setTicket(await response.json()) }).catch((reason) => setError(reason.message)) }) }, [params])
  if (error) return <main className="auth-page stack"><p role="alert">{error}</p><Link href="/">Return home</Link></main>
  if (!ticket) return <main className="auth-page"><p>Loading ticket…</p></main>
  return <main className="auth-page stack"><Link href="/">Return home</Link><p className="eyebrow">Guest digital ticket</p><h1>{ticket.eventTitle}</h1><section className="surface stack"><p><strong>{ticket.ticketTypeName}</strong></p><p>{ticket.attendeeName}</p><p>{new Date(ticket.eventStartsAt).toLocaleString('en-UG')}–{new Date(ticket.eventEndsAt).toLocaleTimeString('en-UG')}</p><p>{ticket.venueName ?? 'Venue to be announced'}{ticket.venueCity ? ` · ${ticket.venueCity}` : ''}</p><p>Status: <strong>{ticket.status}</strong></p><p>Ticket reference: <strong>{ticket.publicId}</strong></p>{ticket.qrDataUrl ? <Image src={ticket.qrDataUrl} alt="Secure ticket QR credential" width={320} height={320} unoptimized /> : <p>QR credential unavailable.</p>}</section></main>
}
