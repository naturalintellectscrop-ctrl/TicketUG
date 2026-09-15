'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import QrScanner from 'qr-scanner'

type Event = { id: string; title: string; starts_at: string; status: string }
type Result = { outcome: string; ticket_type_name?: string; attendee_name?: string; checkedInAt?: string }
type CameraState = 'idle' | 'starting' | 'scanning' | 'denied' | 'unavailable' | 'unsupported'

export const TICKETUG_QR_PREFIX = 'ticketug:v1:'
export function extractTicketCredential(value: string) {
  const normalized = value.trim()
  if (!normalized.startsWith(TICKETUG_QR_PREFIX)) return null
  const credential = normalized.slice(TICKETUG_QR_PREFIX.length)
  return /^tkt_[A-Za-z0-9_-]{16,120}$/.test(credential) ? credential : null
}

const messages: Record<string, string> = { VALID: 'Ticket accepted and checked in.', ALREADY_CHECKED_IN: 'Already checked in.', INVALID_QR: 'Invalid TicketUG QR.', INVALID_TICKET: 'Ticket could not be found.', WRONG_EVENT: 'Wrong event.', CANCELLED_TICKET: 'This ticket has been cancelled.', REFUNDED_TICKET: 'This ticket has been refunded.', VOID_TICKET: 'This ticket is void.', UNAUTHORIZED_SCANNER: 'Scanner not authorized for this event.', VERIFICATION_UNAVAILABLE: 'Unable to verify ticket. Check your connection and try again.' }

export function ScannerPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [eventId, setEventId] = useState('')
  const [payload, setPayload] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [loading, setLoading] = useState(false)
  const [cameraState, setCameraState] = useState<CameraState>('idle')
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<QrScanner | null>(null)
  const processingRef = useRef(false)
  const lastCredentialRef = useRef<string | null>(null)
  const cooldownRef = useRef(0)

  useEffect(() => {
    fetch('/api/check-ins').then((response) => response.ok ? response.json() : Promise.reject()).then((data) => { setEvents(data.events); if (data.events[0]) setEventId(data.events[0].id) }).catch(() => setResult({ outcome: 'UNAUTHORIZED_SCANNER' }))
  }, [])

  const stopCamera = useCallback(() => {
    scannerRef.current?.stop()
    scannerRef.current?.destroy()
    scannerRef.current = null
    if (videoRef.current?.srcObject instanceof MediaStream) videoRef.current.srcObject.getTracks().forEach((track) => track.stop())
    setCameraState('idle')
  }, [])

  const submitPayload = useCallback(async (value: string) => {
    const credential = extractTicketCredential(value)
    if (!credential) { setResult({ outcome: 'INVALID_QR' }); return }
    if (processingRef.current || (lastCredentialRef.current === credential && Date.now() < cooldownRef.current)) return
    processingRef.current = true
    lastCredentialRef.current = credential
    cooldownRef.current = Date.now() + 2500
    setPayload(value.trim())
    setLoading(true)
    setResult(null)
    stopCamera()
    try {
      const response = await fetch('/api/check-ins', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ eventId, payload: value.trim() }) })
      setResult(await response.json())
    } catch { setResult({ outcome: 'VERIFICATION_UNAVAILABLE' }) }
    finally { setLoading(false); processingRef.current = false }
  }, [eventId, stopCamera])

  async function enableCamera() {
    if (!eventId) return
    if (!navigator.mediaDevices?.getUserMedia) { setCameraState('unsupported'); return }
    setResult(null)
    setCameraState('starting')
    try {
      const scanner = new QrScanner(videoRef.current!, (decoded) => { void submitPayload(decoded.data) }, { preferredCamera: 'environment', highlightScanRegion: false, returnDetailedScanResult: true })
      scannerRef.current = scanner
      await scanner.start()
      setCameraState('scanning')
    } catch { scannerRef.current?.destroy(); scannerRef.current = null; setCameraState('denied') }
  }

  useEffect(() => () => { scannerRef.current?.stop(); scannerRef.current?.destroy(); if (videoRef.current?.srcObject instanceof MediaStream) videoRef.current.srcObject.getTracks().forEach((track) => track.stop()) }, [])

  async function verify(event: FormEvent) { event.preventDefault(); if (payload.trim()) await submitPayload(payload) }
  const cameraMessage = cameraState === 'denied' ? 'Camera permission is blocked. Allow camera access in your browser settings or use manual entry.' : cameraState === 'unsupported' || cameraState === 'unavailable' ? 'No camera is available in this browser. Use manual entry below.' : ''

  return (
    <main className="auth-page stack">
      <Link href="/account">Account</Link>
      <p className="eyebrow">Event operations</p>
      <h1>Scanner</h1>
      <p className="muted">TicketUG verifies every scan online. No offline acceptance is available.</p>
      {events.length ? <>
        <label>Event<select value={eventId} onChange={(e) => { stopCamera(); setEventId(e.target.value) }}>{events.map((item) => <option key={item.id} value={item.id}>{item.title} · {new Date(item.starts_at).toLocaleDateString('en-UG')}</option>)}</select></label>
        <section className="surface stack" aria-label="Camera scanner">
          <div className="row-between"><div><h2>Camera scanner</h2><p className="muted">Point the camera at a TicketUG QR code.</p></div>{cameraState !== 'scanning' ? <button type="button" onClick={enableCamera} disabled={cameraState === 'starting'}>{cameraState === 'starting' ? 'Starting camera…' : 'Enable camera'}</button> : <button type="button" onClick={stopCamera}>Stop camera</button>}</div>
          <div className="scanner-viewport"><video ref={videoRef} muted playsInline aria-label="Live QR scanner camera preview" /><span className="scanner-guide" aria-hidden="true" /></div>
          {cameraMessage && <p role="alert">{cameraMessage}</p>}
          {cameraState === 'idle' && <p className="muted">Camera is off.</p>}
          {cameraState === 'scanning' && <p className="muted">Scanning…</p>}
        </section>
        <form className="surface stack" onSubmit={verify}><label htmlFor="payload">Enter QR manually</label><input id="payload" value={payload} onChange={(e) => setPayload(e.target.value)} placeholder="ticketug:v1:tkt_..." autoComplete="off"/><button type="submit" disabled={loading || !payload.trim()}>{loading ? 'Verifying…' : 'Verify and check in'}</button></form>
        {result && <section className={`surface stack ${result.outcome === 'VALID' ? 'success' : ''}`} aria-live="polite"><strong>{messages[result.outcome] ?? 'Ticket rejected.'}</strong>{result.ticket_type_name && <p>{result.ticket_type_name}{result.attendee_name ? ` · ${result.attendee_name}` : ''}</p>}{result.checkedInAt && <p className="muted">Checked in at {new Date(result.checkedInAt).toLocaleString('en-UG')}</p>}<button type="button" onClick={() => { setResult(null); setPayload(''); lastCredentialRef.current = null; cooldownRef.current = 0; void enableCamera() }}>Scan next</button></section>}
      </> : <section className="surface"><p>No assigned events are available for scanning.</p></section>}
    </main>
  )
}
