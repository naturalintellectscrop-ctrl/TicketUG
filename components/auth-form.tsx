'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'

type Mode = 'sign-in' | 'sign-up'

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '')
    const password = String(form.get('password') ?? '')
    const name = String(form.get('name') ?? '')
    setPending(true)
    setError(null)
    const result = mode === 'sign-up'
      ? await authClient.signUp.email({ email, password, name })
      : await authClient.signIn.email({ email, password })
    setPending(false)
    if (result.error) {
      setError('Unable to authenticate with those details.')
      return
    }
    router.push('/account')
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="auth-form">
      {mode === 'sign-up' && <label>Name<input name="name" required autoComplete="name" /></label>}
      <label>Email<input name="email" type="email" required autoComplete="email" /></label>
      <label>Password<input name="password" type="password" required minLength={8} autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'} /></label>
      {error && <p role="alert">{error}</p>}
      <button disabled={pending} type="submit">{pending ? 'Please wait…' : mode === 'sign-up' ? 'Create account' : 'Sign in'}</button>
    </form>
  )
}
