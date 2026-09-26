'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

// Client-side mirror of apps/api/src/events/event-lifecycle.ts — the NestJS
// endpoint remains the authoritative validator; this map only decides which
// actions to offer in the UI.
const transitions: Record<string, readonly string[]> = {
  DRAFT: ['PUBLISHED', 'CANCELLED'],
  PUBLISHED: ['SALES_OPEN', 'CANCELLED', 'SUSPENDED'],
  SALES_OPEN: ['SALES_CLOSED', 'SUSPENDED', 'CANCELLED'],
  SALES_CLOSED: ['EVENT_LIVE', 'CANCELLED'],
  EVENT_LIVE: ['COMPLETED', 'CANCELLED'],
  COMPLETED: ['ARCHIVED'],
  CANCELLED: ['ARCHIVED'],
  SUSPENDED: ['PUBLISHED', 'CANCELLED', 'ARCHIVED'],
  ARCHIVED: [],
}

const labels: Record<string, string> = {
  PUBLISHED: 'Publish event',
  SALES_OPEN: 'Open sales',
  SALES_CLOSED: 'Close sales',
  EVENT_LIVE: 'Mark event live',
  COMPLETED: 'Complete event',
  SUSPENDED: 'Suspend sales',
  CANCELLED: 'Cancel event',
  ARCHIVED: 'Archive event',
}

const dangerActions = new Set(['CANCELLED', 'SUSPENDED', 'ARCHIVED'])

export function EventLifecycleControls({ organizerId, eventId, currentState, canManage, isOwner }: { organizerId: string; eventId: string; currentState: string; canManage: boolean; isOwner: boolean }) {
  const router = useRouter()
  const [pending, setPending] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const options = (transitions[currentState] ?? []).filter((to) => (to === 'PUBLISHED' || to === 'CANCELLED' ? isOwner : canManage))

  async function transition(to: string) {
    setPending(to)
    setMessage('')
    try {
      const response = await fetch(`/api/organizers/${organizerId}/events/${eventId}/transition`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ to }) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) setMessage(result.message || result.error || 'Transition was rejected.')
      else { setMessage(`Event is now ${to.replace(/_/g, ' ').toLowerCase()}.`); router.refresh() }
    } catch { setMessage('Unable to reach the transition service. Check your connection.') } finally { setPending(null) }
  }

  return (
    <section className="stack" aria-label="Event lifecycle controls">
      <div className="row-between">
        <div>
          <p className="eyebrow">Lifecycle</p>
          <h2>Event state</h2>
        </div>
        <strong>{currentState.replace(/_/g, ' ')}</strong>
      </div>
      {options.length ? (
        <div className="row">
          {options.map((to) => (
            <button key={to} type="button" className={dangerActions.has(to) ? 'button button-quiet' : 'button button-primary'} onClick={() => transition(to)} disabled={pending !== null}>
              {pending === to ? 'Working…' : labels[to] ?? to}
            </button>
          ))}
        </div>
      ) : (
        <p className="muted">{currentState === 'ARCHIVED' ? 'This event is archived and can no longer change state.' : canManage ? 'No transitions are available from this state.' : 'Only organizer owners and managers can change the event state.'}</p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  )
}
