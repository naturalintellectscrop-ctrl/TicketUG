'use client'
import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'

export default function NewEventPage() {
  const router = useRouter(); const { organizerId } = useParams<{ organizerId: string }>(); const [error, setError] = useState(''); const [pending, setPending] = useState(false)
  async function submit(formData: FormData) { setPending(true); setError(''); const response = await fetch(`/api/organizers/${organizerId}/events`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.fromEntries(formData)) }); if (!response.ok) { setError((await response.json()).message ?? 'Unable to create event'); setPending(false); return }; router.push(`/organizer/${organizerId}/events`) }
  return <main className="page-shell"><p className="eyebrow">New event</p><h1>Create an event</h1><p className="lede">Set the essentials now. Ticket configuration arrives in a later phase.</p><form className="surface form-stack" action={submit}><label>Title<input name="title" required maxLength={180} /></label><label>Slug<input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" /></label><label>Description<textarea name="description" rows={5} /></label><div className="form-grid"><label>Starts<input name="startsAt" type="datetime-local" required /></label><label>Ends<input name="endsAt" type="datetime-local" required /></label></div><label>Timezone<input name="timezone" defaultValue="Africa/Kampala" required /></label>{error && <p className="error-text">{error}</p>}<button className="button" disabled={pending}>{pending ? 'Creating…' : 'Create event'}</button></form></main>
}
