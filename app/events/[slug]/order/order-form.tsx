'use client'

import { useState } from 'react'

 type Ticket = { public_id: string; name: string; price_minor_units: string; currency: string; remaining_capacity: number }
 type PaymentState = { publicId: string; token: string; provider: string; status: string } | null

export function OrderForm({ tickets }: { tickets: Ticket[] }) {
  const [message, setMessage] = useState('')
  const [payment, setPayment] = useState<PaymentState>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  async function submit(data: FormData) {
    setPending(true)
    setMessage('Creating your order…')
    const items = tickets.map((ticket) => ({ ticketTypeId: ticket.public_id, quantity: Number(data.get(`quantity-${ticket.public_id}`) || 0) })).filter((item) => item.quantity > 0)
    const response = await fetch('/api/orders/guest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items, purchaserName: data.get('purchaserName'), purchaserEmail: data.get('purchaserEmail'), idempotencyKey: crypto.randomUUID() }) })
    const result = await response.json()
    if (!response.ok) { setMessage(result.message || 'Unable to create order'); setPending(false); return }
    const paymentResponse = await fetch(`/api/orders/${result.publicId}/payment`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-order-access-token': result.guestAccessToken }, body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }) })
    const paymentResult = await paymentResponse.json()
    sessionStorage.setItem(`ticketug:guest-token:${result.publicId}`, result.guestAccessToken)
    setExpiresAt(result.paymentExpiresAt ?? null)
    setPayment({ publicId: result.publicId, token: result.guestAccessToken, provider: paymentResult.provider, status: paymentResult.status })
    setMessage(paymentResponse.ok ? `Order ${result.orderNumber} created. Payment is ${paymentResult.status.toLowerCase()}.` : `Order ${result.orderNumber} created and awaiting payment.`)
    setPending(false)
  }
  async function completeTestPayment() {
    if (!payment) return
    setPending(true)
    const response = await fetch(`/api/orders/${payment.publicId}/payment/test-complete`, { method: 'POST', headers: { 'x-order-access-token': payment.token } })
    const result = await response.json()
    if (!response.ok) setMessage(result.message || 'Test payment could not be completed.')
    else { setPayment({ ...payment, status: 'SUCCEEDED' }); setExpiresAt(null); setMessage('Test payment verified. Your order is paid and tickets are being issued.') }
    setPending(false)
  }
  return <form className="stack" action={submit}><label>Name<input name="purchaserName" required /></label><label>Email<input name="purchaserEmail" type="email" required /></label>{tickets.map((ticket) => <label key={ticket.public_id}>{ticket.name} — {Number(ticket.price_minor_units).toLocaleString('en-UG')} {ticket.currency}<input name={`quantity-${ticket.public_id}`} type="number" min="0" max={ticket.remaining_capacity} defaultValue="0" /></label>)}<button className="button" type="submit" disabled={pending}>{pending ? 'Working…' : 'Create order'}</button>{payment?.provider === 'test' && payment.status !== 'SUCCEEDED' && <section className="surface stack" aria-label="Test payment"><strong>Development test payment</strong><p className="muted">No money moves. This uses the same signed webhook path as a provider callback.</p><button type="button" onClick={completeTestPayment} disabled={pending}>Complete simulated payment</button></section>}{payment && payment.status !== 'SUCCEEDED' && expiresAt && <section className="surface stack" aria-label="Payment window"><strong>Payment window open</strong><p className="muted" role="status">Complete payment before <time dateTime={expiresAt}>{new Date(expiresAt).toLocaleTimeString()}</time> — unpaid orders expire automatically and their tickets are released back into inventory.</p></section>}{message && <p role="status">{message}</p>}</form>
}
