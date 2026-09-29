'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { safeInternalPath } from '@/lib/safe-redirect'

type Mode = 'sign-in' | 'sign-up'

export function AuthForm({ mode, nextPath }: { mode: Mode; nextPath?: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '')
    const password = String(form.get('password') ?? '')
    const name = String(form.get('name') ?? '')
    setPending(true)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(mode === 'sign-up' ? '/api/auth/sign-up' : '/api/auth/sign-in', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(mode === 'sign-up' ? { email, password, name } : { email, password }),
      })
      if (!response.ok) {
        let message = mode === 'sign-up'
          ? 'Unable to create the account with those details.'
          : 'Unable to authenticate with those details. Check your information and try again.'
        try {
          const body = await response.json()
          if (typeof body?.error === 'string' && body.error) message = body.error
        } catch {}
        setError(message)
        return
      }
      const payload = await response.json().catch(() => null)
      if (payload?.confirmationRequired) {
        setNotice('Account created. Check your email to confirm the address, then sign in.')
        return
      }
      // Honour ?next= when the caller passed a safe internal path (e.g. the
      // event order page), so buyers return to checkout instead of /account.
      router.push(safeInternalPath(nextPath, '/account'))
      router.refresh()
    } catch {
      setError('Authentication is temporarily unavailable. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} className="auth-form">
      {mode === 'sign-up' && <label>Name<input name="name" required autoComplete="name" /></label>}
      <label>Email<input name="email" type="email" required autoComplete="email" /></label>
      <label>Password<input name="password" type="password" required minLength={8} autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'} /></label>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <button disabled={pending} type="submit">{pending ? 'Please wait…' : mode === 'sign-up' ? 'Create account' : 'Sign in'}</button>
    </form>
  )
}
