'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

export function OrganizerOnboarding() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [message, setMessage] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('Creating organizer…')
    const response = await fetch('/api/organizers', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, slug }) })
    if (response.ok) {
      router.push('/organizer')
      router.refresh()
    } else {
      setMessage('Unable to create organizer. Check the name and slug.')
    }
  }

  return (
    <form onSubmit={submit} className="profile-form">
      <label>Organizer name<input required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>Workspace slug<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase())} /></label>
      <button type="submit">Become an organizer</button>
      <p role="status">{message}</p>
    </form>
  )
}
