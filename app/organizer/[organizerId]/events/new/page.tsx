'use client'
import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { PageHeader } from '@/components/console/page-head'

export default function NewEventPage() {
  const router = useRouter(); const { organizerId } = useParams<{ organizerId: string }>(); const [error, setError] = useState(''); const [pending, setPending] = useState(false)
  async function submit(formData: FormData) { setPending(true); setError(''); const startsRaw = String(formData.get('startsAt') ?? ''); const endsRaw = String(formData.get('endsAt') ?? ''); const startsAt = startsRaw ? new Date(startsRaw).toISOString() : ''; const endsAt = endsRaw ? new Date(endsRaw).toISOString() : ''; if (!startsAt || !endsAt) { setError('Please provide both start and end times'); setPending(false); return }; const response = await fetch(`/api/organizers/${organizerId}/events`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...Object.fromEntries(formData), startsAt, endsAt }) }); if (!response.ok) { setError((await response.json()).message ?? 'Unable to create event'); setPending(false); return }; router.push(`/organizer/${organizerId}/events`) }
  return (
    <>
      <PageHeader
        crumb="Events"
        title="Create event"
        lede="Set the essentials now. Right after the event is created, add ticket types on its Tickets page."
      />
      <form className="surface form-stack" action={submit}><label>Title<input name="title" required maxLength={180} /></label><label>Slug<input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" /></label><label>Description<textarea name="description" rows={5} /></label><div className="form-grid"><label>Starts<input name="startsAt" type="datetime-local" required /></label><label>Ends<input name="endsAt" type="datetime-local" required /></label></div><label>Timezone<input name="timezone" defaultValue="Africa/Kampala" required /></label>{error && <p className="error-text">{error}</p>}<button className="button" disabled={pending}>{pending ? 'Creating…' : 'Create event'}</button></form>
    </>
  )
}
