'use client'

import { FormEvent, useState } from 'react'

export function ProfileEditor({ initial }: { initial: { displayName: string; phone?: string | null; deliveryEmail?: string | null; deliveryPhone?: string | null } }) {
  const [form, setForm] = useState({
    displayName: initial.displayName ?? '',
    phone: initial.phone ?? '',
    deliveryEmail: initial.deliveryEmail ?? '',
    deliveryPhone: initial.deliveryPhone ?? '',
  })
  const [message, setMessage] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('Saving…')
    const response = await fetch('/api/profile', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) })
    setMessage(response.ok ? 'Profile saved.' : 'Please check your details and try again.')
  }

  return (
    <form onSubmit={submit} className="profile-form">
      <label>Display name<input required minLength={2} maxLength={120} value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></label>
      <label>Phone<input maxLength={32} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
      <label>Ticket delivery email<input type="email" value={form.deliveryEmail} onChange={(event) => setForm({ ...form, deliveryEmail: event.target.value })} /></label>
      <label>Ticket delivery phone<input maxLength={32} value={form.deliveryPhone} onChange={(event) => setForm({ ...form, deliveryPhone: event.target.value })} /></label>
      <button type="submit">Save profile</button>
      <p role="status">{message}</p>
    </form>
  )
}
