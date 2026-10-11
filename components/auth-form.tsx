'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, CheckCircle2, CircleAlert, Eye, EyeOff, Lock, Mail, User } from 'lucide-react'
import { safeInternalPath } from '@/lib/safe-redirect'

type Mode = 'sign-in' | 'sign-up'

export function AuthForm({ mode, nextPath }: { mode: Mode; nextPath?: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

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
      const payload = await response.json().catch(() => null) as { confirmationRequired?: boolean; redirectTo?: string } | null
      if (payload?.confirmationRequired) {
        setNotice('Account created. Check your email to confirm the address, then sign in.')
        return
      }
      // Honour ?next= when the caller passed a safe internal path (e.g. the
      // event order page), so buyers return to checkout instead of /account.
      // Otherwise follow the server-computed landing (platform roles go to
      // the control center; everyone else to their account workspace).
      router.push(nextPath ? safeInternalPath(nextPath, '/account') : safeInternalPath(payload?.redirectTo, '/account'))
      router.refresh()
    } catch {
      setError('Authentication is temporarily unavailable. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} className="auth-form">
      {mode === 'sign-up' && (
        <label className="authfield">
          <span className="authfield-label">Full name</span>
          <span className="authfield-box">
            <User size={17} strokeWidth={2.2} aria-hidden className="authfield-icon" />
            <input name="name" required autoComplete="name" placeholder="Your full name" />
          </span>
        </label>
      )}

      <label className="authfield">
        <span className="authfield-label">Email</span>
        <span className="authfield-box">
          <Mail size={17} strokeWidth={2.2} aria-hidden className="authfield-icon" />
          <input name="email" type="email" required autoComplete="email" placeholder="you@example.com" inputMode="email" />
        </span>
      </label>

      <label className="authfield">
        <span className="authfield-label">Password</span>
        <span className="authfield-box has-toggle">
          <Lock size={17} strokeWidth={2.2} aria-hidden className="authfield-icon" />
          <input
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            minLength={8}
            autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
            placeholder={mode === 'sign-up' ? 'At least 8 characters' : 'Your password'}
          />
          <button
            type="button"
            className="authfield-toggle"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
          >
            {showPassword
              ? <EyeOff size={16} strokeWidth={2.2} aria-hidden />
              : <Eye size={16} strokeWidth={2.2} aria-hidden />}
          </button>
        </span>
      </label>

      {error && <p role="alert" className="auth-alert auth-alert-error"><CircleAlert size={16} strokeWidth={2.2} aria-hidden />{error}</p>}
      {notice && <p role="status" className="auth-alert auth-alert-ok"><CheckCircle2 size={16} strokeWidth={2.2} aria-hidden />{notice}</p>}

      <button disabled={pending} type="submit" className="auth-submit">
        {pending
          ? <><span className="auth-spinner" aria-hidden />Please wait…</>
          : <>{mode === 'sign-up' ? 'Create account' : 'Sign in'}<ArrowRight size={17} strokeWidth={2.6} aria-hidden /></>}
      </button>
    </form>
  )
}
