'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Ticket = { public_id: string; name: string; price_minor_units: string; currency: string; remaining_capacity: number }

export function OrderForm({ tickets }: { tickets: Ticket[] }) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  async function submit(data: FormData) {
    setPending(true)
    setMessage('Creating your order…')
    const items = tickets.map((ticket) => ({ ticketTypeId: ticket.public_id, quantity: Number(data.get(`quantity-${ticket.public_id}`) || 0) })).filter((item) => item.quantity > 0)
    if (!items.length) { setMessage('Choose at least one ticket to continue.'); setPending(false); return }
    const response = await fetch('/api/orders/guest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items, purchaserName: data.get('purchaserName'), purchaserEmail: data.get('purchaserEmail'), idempotencyKey: crypto.randomUUID() }) })
    const result = await response.json()
    if (!response.ok) { setMessage(result.message || 'Unable to create order'); setPending(false); return }
    // Kick off payment immediately so the provider window opens without a
    // second click; failures are non-fatal because the status page offers a
    // "Start payment" retry for orders still awaiting payment.
    await fetch(`/api/orders/${result.publicId}/payment`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-order-access-token': result.guestAccessToken }, body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }) }).catch(() => null)
    // The guest access key is the only credential for this order — keep it in
    // this tab's session storage, where the status page expects to find it.
    sessionStorage.setItem(`ticketug:guest-token:${result.publicId}`, result.guestAccessToken)
    router.push(`/guest/orders/${result.publicId}`)
  }
  return <form className="stack" action={submit}>
    <label>Name<input name="purchaserName" required /></label>
    <label>Email<input name="purchaserEmail" type="email" required /></label>
    {tickets.map((ticket) => <label key={ticket.public_id}>{ticket.name} — {Number(ticket.price_minor_units).toLocaleString('en-UG')} {ticket.currency}<input name={`quantity-${ticket.public_id}`} type="number" min="0" max={ticket.remaining_capacity} defaultValue="0" /></label>)}
    <button className="button" type="submit" disabled={pending}>{pending ? 'Working…' : 'Create order'}</button>
    {message && <p role="status">{message}</p>}
  </form>
}
