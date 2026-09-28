'use client'

import { useState } from 'react'

// Shared "Download PDF ticket" action for the attendee ticket surfaces.
// The browser relays the user's own access credential (session cookie for
// signed-in attendees, the order's guest access token for guest checkout) to
// the proxy route, which forwards it to the authoritative API. The PDF is
// generated server-side from server-loaded data — this component only handles
// the download UX: one request at a time, honest errors, no silent failures.

type Props = {
  path: string
  filename: string
  /** Extra headers (e.g. the guest order access token from sessionStorage). */
  getHeaders?: () => Record<string, string>
}

export function DownloadTicketPdfButton({ path, filename, getHeaders }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function download() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch(path, { headers: getHeaders?.() ?? {} })
      if (response.status === 401 || response.status === 403) throw new Error('You no longer have access to this ticket.')
      if (response.status === 404) throw new Error('Ticket not found — it may have been removed.')
      if (!response.ok) throw new Error('The PDF ticket could not be generated right now. Please try again shortly.')
      const contentType = response.headers.get('content-type') ?? ''
      if (!contentType.includes('application/pdf')) throw new Error('Unexpected response while generating the PDF ticket.')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not download the PDF ticket.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="hero-actions">
        <button type="button" className="button button-primary" onClick={download} disabled={busy} aria-busy={busy}>
          {busy ? 'Preparing PDF…' : 'Download PDF ticket'}
        </button>
      </div>
      {error && <p role="alert" className="error-text">{error}</p>}
    </div>
  )
}
