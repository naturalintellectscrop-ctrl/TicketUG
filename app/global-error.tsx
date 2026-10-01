'use client'

// Root-level error boundary — only renders when the root layout itself fails
// (crashes inside app/layout.tsx). Owns its own <html>/<body> by contract.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-UG">
      <body style={{ margin: 0, minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f6f1e7', color: '#191612', fontFamily: 'system-ui, sans-serif' }}>
        <main style={{ maxWidth: 560, padding: 32, textAlign: 'center' }}>
          <p style={{ letterSpacing: '.14em', textTransform: 'uppercase', fontSize: 12, color: '#ef5b43', fontWeight: 700 }}>Ticket Uganda</p>
          <h1 style={{ fontSize: 40, letterSpacing: '-0.05em', margin: '8px 0 12px' }}>Something broke badly.</h1>
          <p style={{ color: '#6c6459', lineHeight: 1.55 }}>
            The application failed to start its interface. Please refresh — if the
            problem persists, contact support at naturalintellectsltd@gmail.com.
            {error.digest ? <><br />Error code: <code>{error.digest}</code></> : null}
          </p>
          <button type="button" onClick={reset} style={{ marginTop: 18, padding: '12px 22px', borderRadius: 999, border: 'none', background: '#191612', color: '#f6f1e7', fontWeight: 700, cursor: 'pointer' }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
