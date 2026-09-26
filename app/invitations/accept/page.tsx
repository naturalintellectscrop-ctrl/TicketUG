'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AcceptInvitationPage() {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [message, setMessage] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const response = await fetch('/api/invitations/accept', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }) })
    const result = await response.json().catch(() => null)
    if (response.ok) {
      setMessage('Invitation accepted.')
      router.push('/organizer')
      router.refresh()
    } else setMessage(result?.error ?? 'This invitation is invalid, expired, or requires sign-in.')
  }

  return (
    <main className="page-shell">
      <p className="eyebrow">Team invitation</p>
      <h1>Join an organizer workspace</h1>
      <p className="lede">Paste the invitation link or the token from it. Invitations only work for the email address they were sent to — sign in with the invited account before accepting.</p>
      <p className="muted">Not signed in yet? <Link className="text-link" href="/sign-in?next=%2Finvitations%2Faccept">Sign in first</Link>.</p>
      <form onSubmit={submit} className="profile-form">
        <label>Invitation token<input required value={token} onChange={(event) => setToken(event.target.value)} /></label>
        <button type="submit">Accept invitation</button>
        <p role="status">{message}</p>
      </form>
    </main>
  )
}
