'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'

export default function NewTicketTypePage() {
  const { organizerId, eventId } = useParams<{ organizerId: string; eventId: string }>()
  const router = useRouter()
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setSaving(true)
    const form = new FormData(event.currentTarget)
    const saleStartsAt = form.get('saleStartsAt') ? new Date(String(form.get('saleStartsAt'))).toISOString() : undefined
    const saleEndsAt = form.get('saleEndsAt') ? new Date(String(form.get('saleEndsAt'))).toISOString() : undefined
    const response = await fetch(`/api/organizers/${organizerId}/events/${eventId}/ticket-types`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: form.get('name'), description: form.get('description'), priceMinorUnits: Number(form.get('priceMinorUnits')), capacity: Number(form.get('capacity')), saleStartsAt, saleEndsAt, active: form.get('active') === 'on' }) })
    if (!response.ok) { setError((await response.json()).message ?? 'Unable to save ticket type'); setSaving(false); return }
    router.push(`/organizer/${organizerId}/events/${eventId}/tickets`)
  }
  return <main className="page-shell"><Link href={`/organizer/${organizerId}/events/${eventId}/tickets`}>Back to ticket types</Link><p className="eyebrow">New ticket type</p><h1>Configure inventory</h1><form className="form-stack" onSubmit={submit}><div className="form-grid"><label>Name<input name="name" required maxLength={160} /></label><label>Price in UGX<input name="priceMinorUnits" type="number" min="0" step="1" required /></label><label>Capacity<input name="capacity" type="number" min="0" step="1" required /></label><label>Sale starts<input name="saleStartsAt" type="datetime-local" /></label><label>Sale ends<input name="saleEndsAt" type="datetime-local" /></label></div><label>Description<textarea name="description" rows={5} maxLength={5000} /></label><label><input name="active" type="checkbox" /> Active for public display</label>{error && <p className="error-text" role="alert">{error}</p>}<button className="button" disabled={saving}>{saving ? 'Saving…' : 'Create ticket type'}</button></form></main>
}
