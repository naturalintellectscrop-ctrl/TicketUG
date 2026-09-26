'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { buildRecoveryPath, guestTokenStorageKey, recoveryKeyFromSearch } from '@/lib/guest-order-access'

type GuestOrderItem = { ticketTypeId: string; ticketName: string; quantity: number; unitPriceMinorUnits: number; currency: string; lineTotalMinorUnits: number }
type GuestOrder = { publicId: string; orderNumber: string; status: string; purchaserName: string; purchaserEmail: string; currency: string; totalMinorUnits: number; createdAt: string; updatedAt: string; cancelledAt: string | null; paymentExpiresAt: string | null; items: GuestOrderItem[] }
type GuestTicket = { publicId: string; ticketTypeName: string; attendeeName: string; status: string; eventTitle: string }
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

function money(minor: number, currency: string) { return `${Number(minor).toLocaleString('en-UG')} ${currency}` }

export default function GuestOrderPage({ params }: { params: Promise<{ publicId: string }> }) {
  const [order, setOrder] = useState<GuestOrder | null>(null)
  const [tickets, setTickets] = useState<GuestTicket[] | null>(null)
  const [payment, setPayment] = useState<PaymentInfo>(null)
  const [hasToken, setHasToken] = useState<boolean | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [publicId, setPublicId] = useState('')
  const [token, setToken] = useState('')
  const [adoptedKey, setAdoptedKey] = useState(false)

  const loadOrder = useCallback(async (silent = false) => {
    if (!publicId || typeof window === 'undefined') return
    const currentToken = sessionStorage.getItem(guestTokenStorageKey(publicId)) ?? ''
    const response = await fetch(`/api/public/orders/${publicId}`, { headers: { 'x-order-access-token': currentToken }, cache: 'no-store' })
    if (!response.ok) {
      if (!silent) setError(response.status === 404 ? 'Order not found, or the access key does not match this order.' : 'Unable to load your order right now. Please try again.')
      return
    }
    setOrder(await response.json())
    setToken(currentToken)
    if (!silent) setError('')
  }, [publicId])

  // Resolve the route param and adopt a recovery key from the URL if present:
  // the key moves into sessionStorage and the address bar is rewritten clean
  // immediately, so the token never persists in browser history. All state
  // updates happen inside the promise callback (no synchronous effect
  // setState).
  useEffect(() => {
    params.then((value) => {
      const id = value.publicId
      setPublicId(id)
      if (typeof window === 'undefined') return
      const fromUrl = recoveryKeyFromSearch(window.location.search)
      if (fromUrl) {
        sessionStorage.setItem(guestTokenStorageKey(id), fromUrl)
        window.history.replaceState(null, '', window.location.pathname)
        setAdoptedKey(true)
        return
      }
      if (!sessionStorage.getItem(guestTokenStorageKey(id))) setHasToken(false)
    })
  }, [params])
  useEffect(() => {
    if (!publicId || hasToken === false) return
    const start = setTimeout(() => { loadOrder() }, 0)
    return () => clearTimeout(start)
  }, [publicId, hasToken, loadOrder])
  // Live countdown tick.
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [])

  // Poll while the order can still move (payment in flight).
  useEffect(() => {
    if (!order || !ACTIVE_STATUSES.includes(order.status)) return
    const timer = setInterval(() => { loadOrder(true) }, 10_000)
    return () => clearInterval(timer)
  }, [order, loadOrder])

  // Paid orders: load the issued ticket list for deep links.
  useEffect(() => {
    if (!order || order.status !== 'PAID' || tickets || typeof window === 'undefined') return
    fetch(`/api/public/orders/${publicId}/tickets`, { headers: { 'x-order-access-token': sessionStorage.getItem(guestTokenStorageKey(publicId)) ?? '' }, cache: 'no-store' }).then(async (response) => { if (response.ok) setTickets(await response.json()) }).catch(() => null)
  }, [order, tickets, publicId])

  // Active orders: load payment info (drives the dev test-payment shortcut).
  useEffect(() => {
    if (!order || !ACTIVE_STATUSES.includes(order.status) || typeof window === 'undefined') return
    fetch(`/api/orders/${publicId}/payment`, { headers: { 'x-order-access-token': sessionStorage.getItem(guestTokenStorageKey(publicId)) ?? '' }, cache: 'no-store' }).then(async (response) => { setPayment(response.ok ? await response.json() : null) }).catch(() => null)
  }, [order, publicId])

  async function cancelOrder() {
    if (!order || !window.confirm('Cancel this order? Your reserved tickets are released back into inventory and this cannot be undone.')) return
    setPending(true); setNotice(''); setError('')
    const response = await fetch(`/api/public/orders/${publicId}/cancel`, { method: 'PATCH', headers: { 'x-order-access-token': token } })
    const result = await response.json().catch(() => null)
    if (!response.ok) setError(result?.message ?? 'Unable to cancel this order right now.')
    else { setOrder(result); setNotice('Order cancelled. Any reserved tickets were released back into inventory.') }
    setPending(false)
  }

  async function retryPayment() {
    if (!order) return
    setPending(true); setNotice(''); setError('')
    const response = await fetch(`/api/orders/${publicId}/payment`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-order-access-token': token }, body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }) })
    const result = await response.json().catch(() => null)
    if (!response.ok) setError(result?.message ?? 'Unable to start payment. Please try again.')
    else { setPayment(result); setNotice(`Payment started — status ${String(result?.status ?? 'PROCESSING').toLowerCase()}.`) }
    await loadOrder(true)
    setPending(false)
  }

  async function completeTestPayment() {
    if (!payment) return
    setPending(true); setNotice(''); setError('')
    const response = await fetch(`/api/orders/${publicId}/payment/test-complete`, { method: 'POST', headers: { 'x-order-access-token': token } })
    const result = await response.json().catch(() => null)
    if (!response.ok) setError(result?.message ?? 'Test payment could not be completed.')
    else { setTickets(null); setNotice('Test payment verified. Your tickets are being issued.') }
    await loadOrder(true)
    setPending(false)
  }

  function copyReference() {
    if (!order) return
    navigator.clipboard?.writeText(order.orderNumber).then(() => setNotice('Order reference copied to clipboard.')).catch(() => null)
  }

  const recoveryLink = order && token ? `${typeof window !== 'undefined' ? window.location.origin : ''}${buildRecoveryPath(order.publicId, token)}` : ''

  function copyRecoveryLink() {
    if (!recoveryLink) return
    navigator.clipboard?.writeText(recoveryLink).then(() => setNotice('Recovery link copied. Save it somewhere safe — it reopens this order in any browser.')).catch(() => null)
  }

  async function rotateKey() {
    if (!order || !token) return
    if (!window.confirm('Reset the access key for this order? Every previously shared link stops working, and you will receive a new recovery link to save.')) return
    setPending(true); setNotice(''); setError('')
    const response = await fetch(`/api/public/orders/${publicId}/rekey`, { method: 'POST', headers: { 'x-order-access-token': token } })
    const result = await response.json().catch(() => null)
    if (!response.ok) setError(result?.message ?? 'Unable to reset the access key right now.')
    else {
      sessionStorage.setItem(guestTokenStorageKey(publicId), result.guestAccessToken)
      setToken(result.guestAccessToken)
      setTickets(null)
      setNotice('Access key reset. Previous copies of your order link no longer work — save the new recovery link below.')
    }
    setPending(false)
  }

  if (hasToken === false) {
    return <main className="auth-page stack"><Link className="text-link" href="/">← Return home</Link><p className="eyebrow">Guest order status</p><h1>Access key needed</h1><section className="surface stack" aria-label="Access key required"><p>This order page is unlocked by a private access key. It lives in this browser if the order was placed here, or inside a recovery link like <code>/guest/orders/…?key=…</code>.</p><p className="muted">Reopen the confirmation page from the browser you ordered in, or ask the event organizer for help with your order reference.</p></section></main>
  }
  if (error) return <main className="auth-page stack"><Link className="text-link" href="/">← Return home</Link><p className="eyebrow">Guest order status</p><h1>Order unavailable</h1><p role="alert" className="error-text">{error}</p></main>
  if (!order) return <main className="auth-page"><p>Loading order…</p></main>

  const remaining = order.paymentExpiresAt ? new Date(order.paymentExpiresAt).getTime() - now : null
  const windowClosed = remaining !== null && remaining <= 0
  const isActive = ACTIVE_STATUSES.includes(order.status)

  return <main className="auth-page stack">
    <Link className="text-link" href="/">← Return home</Link>
    <p className="eyebrow">Guest order status</p>
    <div className="row-between">
      <h1>{order.orderNumber}</h1>
      <span className="status-pill" data-status={order.status}>{order.status.replace(/_/g, ' ').toLowerCase()}</span>
    </div>
    {adoptedKey && <p role="status" className="muted">Access key restored from your recovery link — the address bar has been cleaned up. Consider saving the link below.</p>}
    {notice && <p role="status">{notice}</p>}

    <section className="surface stack" aria-label="Order summary">
      <h2>Order summary</h2>
      <div className="row-between"><span className="muted">Placed by</span><span>{order.purchaserName} · {order.purchaserEmail}</span></div>
      <div className="row-between"><span className="muted">Placed</span><time dateTime={order.createdAt}>{new Date(order.createdAt).toLocaleString('en-UG')}</time></div>
      {order.cancelledAt && <div className="row-between"><span className="muted">Cancelled</span><time dateTime={order.cancelledAt}>{new Date(order.cancelledAt).toLocaleString('en-UG')}</time></div>}
      <div className="row-between"><span className="muted">Total</span><strong>{money(order.totalMinorUnits, order.currency)}</strong></div>
      <div className="row-between"><span className="muted">Reference</span><span className="row-between"><code>{order.publicId}</code><button type="button" className="button button-quiet" onClick={copyReference}>Copy</button></span></div>
    </section>

    <section className="surface stack" aria-label="Tickets ordered">
      <h2>Tickets ordered</h2>
      <div className="order-items">
        {order.items.map((item) => <div key={item.ticketTypeId}><span>{item.ticketName} × {item.quantity}</span><span>{money(item.lineTotalMinorUnits, item.currency)}</span></div>)}
      </div>
      <p className="muted">Unit prices are locked at order time and shown in Ugandan shillings.</p>
    </section>

    {isActive && <section className="surface stack" aria-label="Payment">
      <h2>Payment</h2>
      {order.paymentExpiresAt && !windowClosed && <p className="muted countdown" role="timer">Complete payment within <strong><time dateTime={order.paymentExpiresAt}>{formatRemaining(remaining!)}</time></strong> — after that the reservation expires and tickets return to inventory automatically.</p>}
      {order.paymentExpiresAt && windowClosed && <p className="muted">The payment window has closed. This order will expire automatically; reserved tickets are released.</p>}
      {payment?.provider === 'test' && payment.status !== 'SUCCEEDED' && <section className="surface stack" aria-label="Test payment"><strong>Development test payment</strong><p className="muted">No money moves. This uses the same signed webhook path as a provider callback.</p><button type="button" className="button" onClick={completeTestPayment} disabled={pending}>Complete simulated payment</button></section>}
      {payment?.status === 'SUCCEEDED' ? <p className="muted">Payment confirmed — tickets are issued below.</p> : <div className="hero-actions"><button type="button" className="button button-primary" onClick={retryPayment} disabled={pending}>{payment ? 'Restart payment' : 'Start payment'}</button><button type="button" className="button button-danger" onClick={cancelOrder} disabled={pending}>Cancel order</button></div>}
    </section>}

    {order.status === 'PAID' && <section className="surface stack" aria-label="Your tickets">
      <h2>Your tickets</h2>
      {tickets === null && <p className="muted">Loading issued tickets…</p>}
      {tickets?.length === 0 && <p className="muted">Tickets are being issued — check back in a moment.</p>}
      {tickets && tickets.length > 0 && <div className="ticket-rows">
        {tickets.map((ticket) => <Link key={ticket.publicId} className="ticket-row" href={`/guest/orders/${publicId}/tickets/${ticket.publicId}`}>
          <span><strong>{ticket.attendeeName}</strong><span className="muted">{ticket.ticketTypeName}</span></span>
          <span className="status-pill" data-status={ticket.status}>{ticket.status.replace(/_/g, ' ').toLowerCase()}</span>
        </Link>)}
      </div>}
      <p className="muted">Open a ticket to show its QR credential at the entrance scan point.</p>
    </section>}

    {order.status === 'CANCELLED' && <section className="surface stack" aria-label="Cancelled order"><h2>Order cancelled</h2><p className="muted">This order was cancelled{order.cancelledAt ? ` on ${new Date(order.cancelledAt).toLocaleString('en-UG')}` : ''} and its reserved tickets were released back into inventory. Place a new order from the event page if you still want to attend.</p></section>}
    {order.status === 'EXPIRED' && <section className="surface stack" aria-label="Expired order"><h2>Order expired</h2><p className="muted">The payment window lapsed before payment completed, so the reservation was released automatically. Place a new order from the event page if tickets remain.</p></section>}

    {token && <section className="surface stack" aria-label="Order recovery">
      <h2>Keep access to this order</h2>
      <p className="muted">This order is unlocked by a private access key stored in this browser. Save the recovery link — it reopens this order in any browser, even after this tab is closed.</p>
      <div className="row-between recovery-row"><code className="recovery-link">{recoveryLink}</code><button type="button" className="button button-quiet" onClick={copyRecoveryLink}>Copy link</button></div>
      <div className="row-between recovery-row"><span className="muted">Shared the link by mistake?</span><button type="button" className="button button-quiet" onClick={rotateKey} disabled={pending}>Reset access key</button></div>
    </section>}

    <footer className="auth-footer muted">TicketUG · Natural Intellects Ltd — keep this tab&apos;s access key private; anyone with it can view this order.</footer>
  </main>
}
