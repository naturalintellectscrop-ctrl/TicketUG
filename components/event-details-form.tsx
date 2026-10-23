'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { wallTimeToUtcIso } from '@/lib/timezone'

/**
 * Event details editor (spec §5.2.2). The schedule inputs carry the event's
 * LOCAL wall time; on submit they are converted to UTC ISO with the event's
 * own timezone (never the browser's) before hitting the details endpoint.
 * The server re-validates everything, including which lifecycle states may
 * still change the schedule.
 */
export function EventDetailsForm({
  organizerId,
  eventId,
  defaults,
  scheduleLocked,
}: {
  organizerId: string
  eventId: string
  defaults: { title: string; description: string; startsAt: string; endsAt: string; timezone: string }
  scheduleLocked: boolean
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const timezone = String(form.get('timezone') ?? defaults.timezone)
    const startsWall = String(form.get('startsAt') ?? '')
    const endsWall = String(form.get('endsAt') ?? '')
    const startsIso = scheduleLocked ? undefined : wallTimeToUtcIso(startsWall, timezone)
    const endsIso = scheduleLocked ? undefined : wallTimeToUtcIso(endsWall, timezone)
    setPending(true)
    setError(null)
    setSaved(false)
    try {
      if (!scheduleLocked && (!startsIso || !endsIso)) {
        setError('Check the start/end times and timezone — they could not be interpreted.')
        return
      }
      const response = await fetch(`/api/organizers/${organizerId}/events/${eventId}/details`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: String(form.get('title') ?? ''),
          description: String(form.get('description') ?? ''),
          ...(scheduleLocked ? {} : { startsAt: startsIso, endsAt: endsIso, timezone }),
        }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        setError(typeof body?.error === 'string' && body.error ? body.error : 'The changes were not saved. Try again.')
        return
      }
      setSaved(true)
      router.refresh()
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="surface form-stack" onSubmit={submit} aria-label="Event details">
      <label>Title<input name="title" required minLength={1} maxLength={180} defaultValue={defaults.title} /></label>
      <label>Description<textarea name="description" rows={5} maxLength={5000} defaultValue={defaults.description} placeholder="What makes this event worth showing up for?" /></label>
      <div className="form-grid">
        <label>Starts (venue time)<input name="startsAt" type="datetime-local" required disabled={scheduleLocked} defaultValue={defaults.startsAt} /></label>
        <label>Ends (venue time)<input name="endsAt" type="datetime-local" required disabled={scheduleLocked} defaultValue={defaults.endsAt} /></label>
      </div>
      <label>Timezone<input name="timezone" required disabled={scheduleLocked} defaultValue={defaults.timezone} aria-describedby={scheduleLocked ? 'schedule-lock-note' : undefined} /></label>
      {scheduleLocked && (
        <p className="muted" id="schedule-lock-note" style={{ margin: 0 }}>
          The schedule is locked at this event&apos;s state — buyers already hold tickets for these dates. Only the title and description can change.
        </p>
      )}
      {error && <p role="alert" className="error-text" style={{ margin: 0 }}>{error}</p>}
      {saved && <p role="status" style={{ margin: 0, color: '#3c5a12', fontWeight: 600 }}>Saved — the event page reflects your changes.</p>}
      <button type="submit" className="button button-dark" disabled={pending}>{pending ? 'Saving…' : 'Save changes'}</button>
    </form>
  )
}
