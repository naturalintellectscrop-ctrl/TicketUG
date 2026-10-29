'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isValidWorkspaceSlug, slugifyWorkspaceName } from '@/lib/slug'

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * First-run organizer onboarding — the empty state of the /organizer hub.
 * Derives the workspace address from the organizer name (still editable),
 * validates with the exact rules the API enforces, and maps every API error
 * to a specific, actionable message instead of a generic failure.
 */
export function OrganizerOnboarding() {
  const router = useRouter()
  const [name, setName] = useState('')
  // null = the user hasn't touched the address yet — derive it from the name
  // during render instead of syncing it through an effect.
  const [slugInput, setSlugInput] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<'muted' | 'error' | 'ok'>('muted')

  const slug = slugInput ?? slugifyWorkspaceName(name)
  const slugEdited = slugInput !== null

  const slugTakenShape = slug.length > 0 && !SLUG_PATTERN.test(slug)
  const slugReady = isValidWorkspaceSlug(slug)

  function slugHint(): string {
    if (slugEdited && slugTakenShape) return 'Use lowercase letters, numbers and single hyphens — no spaces.'
    if (slug.length > 0 && slug.length < 3) return 'The workspace address needs at least 3 characters.'
    if (slugEdited && slugReady) return 'Looks good — this becomes your workspace address.'
    if (!slugEdited && slugReady) return 'Auto-filled from your name — edit it if you prefer something else.'
    return 'Lowercase letters, numbers and single hyphens, e.g. kampala-night-market.'
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!slugReady) {
      setMessage('Fix the workspace address before continuing.')
      setMessageTone('error')
      return
    }
    setSubmitting(true)
    setMessage('Creating your workspace…')
    setMessageTone('muted')
    try {
      const response = await fetch('/api/organizers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, slug }),
      })
      if (response.ok) {
        setMessage('Workspace created — taking you there…')
        setMessageTone('ok')
        router.push('/organizer')
        router.refresh()
        return
      }
      if (response.status === 409) {
        const body = (await response.json().catch(() => null)) as { code?: string } | null
        if (body?.code === 'SLUG_TAKEN') {
          setMessage('That workspace address is already taken — try a different one.')
        } else {
          setMessage('You already own a workspace. One owner account per workspace — you can invite teammates from its team page.')
        }
        setMessageTone('error')
      } else if (response.status === 400) {
        setMessage('Check the organizer name and workspace address, then try again.')
        setMessageTone('error')
      } else if (response.status === 429) {
        setMessage('Too many attempts — please wait a minute and try again.')
        setMessageTone('error')
      } else {
        setMessage('Unable to create the workspace right now. Please try again.')
        setMessageTone('error')
      }
    } catch {
      setMessage('Network problem — check your connection and try again.')
      setMessageTone('error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="stack">
      <div>
        <h2>Start your first workspace</h2>
        <p className="muted" style={{ margin: '0 0 4px' }}>
          A workspace is your organizer home — it holds your events, ticket tiers, gates, team and
          sales reports. Everything you publish belongs to exactly one workspace.
        </p>
        <ol className="onboarding-steps">
          <li>Create the workspace with a name and address.</li>
          <li>Add an event, set ticket tiers and gates.</li>
          <li>Publish and start selling — reports and check-ins come with it.</li>
        </ol>
      </div>

      <form onSubmit={submit} className="profile-form" style={{ maxWidth: 520 }}>
        <label htmlFor="organizer-name">Organizer name
          <input
            id="organizer-name"
            required
            minLength={2}
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Kampala Night Market"
            autoComplete="organization"
          />
        </label>
        <label htmlFor="organizer-slug">Workspace address
          <input
            id="organizer-slug"
            required
            value={slug}
            onChange={(event) => setSlugInput(event.target.value.toLowerCase())}
            placeholder="kampala-night-market"
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            minLength={3}
            maxLength={80}
            aria-invalid={slugEdited && slugTakenShape ? true : undefined}
            aria-describedby="organizer-slug-hint"
          />
        </label>
        <p className="onboarding-hint" id="organizer-slug-hint" data-tone={slugEdited && slugTakenShape ? 'error' : 'muted'}>{slugHint()}</p>
        <button type="submit" disabled={submitting || !slugReady} aria-busy={submitting}>Become an organizer</button>
        <p role="status" aria-live="polite" data-tone={messageTone} className={messageTone === 'error' ? 'error-text' : 'muted'} style={{ margin: 0 }}>{message}</p>
      </form>
    </div>
  )
}
