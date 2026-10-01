'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { RefreshCw } from 'lucide-react'

// Route-segment error boundary (Next.js required contract: client component).
// Renders the branded failure state instead of the framework default; the
// digest is shown so an operator can correlate the report with the server log.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Browser console breadcrumb (Next already reports this to the server in
    // production via the digest); no PII is available here by design.
    console.error(`[ticketug:route-error] ${error.name}: ${error.message}`)
  }, [error])

  return (
    <main className="page-shell">
      <p className="eyebrow">Something went wrong</p>
      <h1>Hit a<br /><em>snag.</em></h1>
      <p className="lede">
        That didn&apos;t go through — and it&apos;s on us, not you. Try again; if it
        keeps failing, the Ticket Uganda team can pick it up from the error code.
      </p>
      {error.digest ? <p className="muted">Error code: <code>{error.digest}</code></p> : null}
      <div className="row-between" style={{ maxWidth: 420 }}>
        <button type="button" className="button" onClick={reset}>
          <RefreshCw size={16} strokeWidth={2.4} aria-hidden /> Try again
        </button>
        <Link href="/" className="button button-quiet">Back to safety</Link>
      </div>
    </main>
  )
}
