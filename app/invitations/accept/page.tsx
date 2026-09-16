'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AcceptInvitationPage() {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [message, setMessage] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const response = await fetch('/api/invitations/accept', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }) })
    if (response.ok) {
      setMessage('Invitation accepted.')
      router.push('/organizer')
      router.refresh()
    } else setMessage('This invitation is invalid, expired, or requires sign-in.')
  }

  return <main className="page-shell"><p className="eyebrow">Team invitation</p><h1>Join an organizer workspace</h1><p className="lede">Sign in with the invited account before accepting the invitation.</p><form onSubmit={submit} className="profile-form"><label>Invitation token<input required value={token} onChange={(event) => setToken(event.target.value)} /></label><button type="submit">Accept invitation</button><p role="status">{message}</p></form></main>
}
