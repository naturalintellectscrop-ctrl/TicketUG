'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type OrderStatus = { status: string; paymentExpiresAt: string | null }
type PaymentInfo = { provider: string; status: string } | null

const ACTIVE_STATUSES = ['AWAITING_PAYMENT', 'PAYMENT_PROCESSING']

function formatRemaining(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
  return `${minutes}m ${seconds}s`
}

// Live payment panel for the account order detail page. The server component
// owns the data display; this client section adds the countdown, payment
// initiation/retry, the dev-only simulated payment and cancellation, polling
// the authenticated proxies every 10s while the order can still move.
export function AccountOrderActions({ publicId, initialStatus, initialExpiresAt }: { publicId: string; initialStatus: string; initialExpiresAt: string | null }) {
  const router = useRouter()
  const [status, setStatus] = useState(initialStatus)
  const [expiresAt, setExpiresAt] = useState(initialExpiresAt)
  const [payment, setPayment] = useState<PaymentInfo>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const refreshOrder = useCallback(async (silent = true) => {
    const response = await fetch(`/api/orders/${publicId}`, { cache: 'no-store' })
    if (!response.ok) return
    const order: OrderStatus = await response.json()
    setStatus(order.status)
    setExpiresAt(order.paymentExpiresAt)
    if (!silent) setError('')
    router.refresh()
  }, [publicId, router])

  // Live countdown tick.
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [])

  // Poll while the order can still move.
  useEffect(() => {
    if (!ACTIVE_STATUSES.includes(status)) return
    const timer = setInterval(() => { refreshOrder(true) }, 10_000)
    return () => clearInterval(timer)
  }, [status, refreshOrder])

  // Load payment info while active (drives the dev test-payment shortcut).
  useEffect(() => {
    if (!ACTIVE_STATUSES.includes(status)) { return }
    let cancelled = false
    fetch(`/api/orders/${publicId}/payment`, { cache: 'no-store' }).then(async (response) => { if (!cancelled) setPayment(response.ok ? await response.json() : null) }).catch(() => null)
    return () => { cancelled = true }
  }, [status, publicId])

  async function startPayment() {
    setPending(true); setNotice(''); setError('')
    const response = await fetch(`/api/orders/${publicId}/payment`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }) })
    const result = await response.json().catch(() => null)
    if (!response.ok) setError(result?.message ?? 'Unable to start payment. Please try again.')
    else setNotice('Payment started — follow your provider\'s instructions, then this page updates automatically.')
    await refreshOrder(true)
    setPending(false)
  }

  async function completeTestPayment() {
    if (!payment) return
    setPending(true); setNotice(''); setError('')
    const response = await fetch(`/api/orders/${publicId}/payment/test-complete`, { method: 'POST' })
    const result = await response.json().catch(() => null)
    if (!response.ok) setError(result?.message ?? 'Test payment could not be completed.')
    else setNotice('Test payment verified — tickets are being issued.')
    await refreshOrder(true)
    setPending(false)
  }

  async function cancelOrder() {
    if (!window.confirm('Cancel this order? Your reserved tickets are released back into inventory and this cannot be undone.')) return
    setPending(true); setNotice(''); setError('')
    const response = await fetch(`/api/orders/${publicId}/cancel`, { method: 'PATCH' })
    const result = await response.json().catch(() => null)
    if (!response.ok) setError(result?.message ?? 'Unable to cancel this order right now.')
    else setNotice('Order cancelled. Any reserved tickets were released back into inventory.')
    await refreshOrder(true)
    setPending(false)
  }

  if (!ACTIVE_STATUSES.includes(status)) return null

  const remaining = expiresAt ? new Date(expiresAt).getTime() - now : null
  const windowClosed = remaining !== null && remaining <= 0

  return <section className="surface stack" aria-label="Payment actions">
    <h2>Payment</h2>
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert" className="error-text">{error}</p>}
    {expiresAt && !windowClosed && <p className="muted countdown" role="timer">Complete payment within <strong><time dateTime={expiresAt}>{formatRemaining(remaining!)}</time></strong> — after that the reservation expires and tickets return to inventory automatically.</p>}
    {expiresAt && windowClosed && <p className="muted">The payment window has closed. This order expires automatically; reserved tickets are released.</p>}
    {payment?.provider === 'test' && payment.status !== 'SUCCEEDED' && <div className="hero-actions"><button type="button" className="button" onClick={completeTestPayment} disabled={pending}>Complete simulated payment</button></div>}
    {payment?.status === 'SUCCEEDED' ? <p className="muted">Payment confirmed — your tickets appear below once issued.</p> : <div className="hero-actions"><button type="button" className="button button-primary" onClick={startPayment} disabled={pending}>{payment ? 'Restart payment' : 'Start payment'}</button><button type="button" className="button button-danger" onClick={cancelOrder} disabled={pending}>Cancel order</button></div>}
  </section>
}
