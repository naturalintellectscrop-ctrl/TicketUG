'use client'

import { useState } from 'react'

type Ticket = { public_id: string; name: string; price_minor_units: string; currency: string; remaining_capacity: number }

export function OrderForm({ tickets }: { tickets: Ticket[] }) {
  const [message, setMessage] = useState('')
  async function submit(data: FormData) {
    const items = tickets.map((ticket) => ({ ticketTypeId: ticket.public_id, quantity: Number(data.get(`quantity-${ticket.public_id}`) || 0) })).filter((item) => item.quantity > 0)
    const response = await fetch('/api/orders/guest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items, purchaserName: data.get('purchaserName'), purchaserEmail: data.get('purchaserEmail'), idempotencyKey: crypto.randomUUID() }) })
    const result = await response.json()
    if (!response.ok) { setMessage(result.message || 'Unable to create order'); return }
    const payment = await fetch(`/api/orders/${result.publicId}/payment`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-order-access-token': result.guestAccessToken }, body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }) })
    const paymentResult = await payment.json()
    sessionStorage.setItem(`ticketug:guest-token:${result.publicId}`, result.guestAccessToken)
    setMessage(payment.ok ? `Order ${result.orderNumber} created. Payment status: ${paymentResult.status}. Use the secure order link when tickets are issued.` : `Order ${result.orderNumber} created and awaiting payment.`)
  }
  return <form className="stack" action={submit}><label>Name<input name="purchaserName" required /></label><label>Email<input name="purchaserEmail" type="email" required /></label>{tickets.map((ticket) => <label key={ticket.public_id}>{ticket.name} — {Number(ticket.price_minor_units).toLocaleString('en-UG')} {ticket.currency}<input name={`quantity-${ticket.public_id}`} type="number" min="0" max={ticket.remaining_capacity} defaultValue="0" /></label>)}<button className="button" type="submit">Create order</button>{message && <p role="status">{message}</p>}</form>
}
