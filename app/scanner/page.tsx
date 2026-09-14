'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

type Event = { id: string; title: string; starts_at: string; status: string }
type Result = { outcome: string; ticket_type_name?: string; attendee_name?: string; checkedInAt?: string }
const messages: Record<string, string> = { VALID: 'Ticket accepted and checked in.', ALREADY_CHECKED_IN: 'Already checked in.', INVALID_QR: 'That is not a valid TicketUG QR.', INVALID_TICKET: 'Ticket could not be found.', WRONG_EVENT: 'This ticket belongs to another event.', CANCELLED_TICKET: 'This ticket has been cancelled.', REFUNDED_TICKET: 'This ticket has been refunded.', VOID_TICKET: 'This ticket is void.', UNAUTHORIZED_SCANNER: 'You are not authorized to scan this event.', VERIFICATION_UNAVAILABLE: 'Unable to verify ticket. Check your connection and try again.' }

export default function ScannerPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [eventId, setEventId] = useState('')
  const [payload, setPayload] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [loading, setLoading] = useState(false)
  const [camera, setCamera] = useState<'idle' | 'ready' | 'denied'>('idle')
  useEffect(() => { fetch('/api/check-ins').then((response) => response.ok ? response.json() : Promise.reject()).then((data) => { setEvents(data.events); if (data.events[0]) setEventId(data.events[0].id) }).catch(() => setResult({ outcome: 'UNAUTHORIZED_SCANNER' })) }, [])
  async function enableCamera() { if (!navigator.mediaDevices?.getUserMedia) { setCamera('denied'); return } try { const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); stream.getTracks().forEach((track) => track.stop()); setCamera('ready') } catch { setCamera('denied') } }
  async function verify(event?: FormEvent) { event?.preventDefault(); if (!eventId || !payload.trim()) return; setLoading(true); setResult(null); try { const response = await fetch('/api/check-ins', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ eventId, payload: payload.trim() }) }); setResult(await response.json()) } catch { setResult({ outcome: 'VERIFICATION_UNAVAILABLE' }) } finally { setLoading(false) } }
  return (
    <main className="auth-page stack">
      <Link href="/account">Account</Link>
      <p className="eyebrow">Event operations</p>
      <h1>Scanner</h1>
      <p className="muted">TicketUG verifies every scan online. No offline acceptance is available.</p>
      {events.length ? (
        <>
          <label>Event<select value={eventId} onChange={(e) => setEventId(e.target.value)}>{events.map((item) => <option key={item.id} value={item.id}>{item.title} · {new Date(item.starts_at).toLocaleDateString('en-UG')}</option>)}</select></label>
          <section className="surface stack"><div className="row-between"><div><h2>Camera scanner</h2><p className="muted">Camera capability is ready for the scanner adapter.</p></div><button type="button" onClick={enableCamera}>{camera === 'ready' ? 'Camera ready' : 'Enable camera'}</button></div>{camera === 'denied' && <p role="alert">Camera permission is unavailable. Use manual entry below.</p>}</section>
          <form className="surface stack" onSubmit={verify}><label htmlFor="payload">Manual QR credential</label><input id="payload" value={payload} onChange={(e) => setPayload(e.target.value)} placeholder="ticketug:v1:tkt_..." autoComplete="off"/><button type="submit" disabled={loading || !payload.trim()}>{loading ? 'Verifying…' : 'Verify and check in'}</button></form>
          {result && <section className={`surface stack ${result.outcome === 'VALID' ? 'success' : ''}`} aria-live="polite"><strong>{messages[result.outcome] ?? 'Ticket rejected.'}</strong>{result.ticket_type_name && <p>{result.ticket_type_name}{result.attendee_name ? ` · ${result.attendee_name}` : ''}</p>}{result.checkedInAt && <p className="muted">Checked in at {new Date(result.checkedInAt).toLocaleString('en-UG')}</p>}</section>}
        </>
      ) : <section className="surface"><p>No assigned events are available for scanning.</p></section>}
    </main>
  )
}
