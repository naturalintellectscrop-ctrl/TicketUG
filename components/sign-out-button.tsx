'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function SignOutButton() {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  async function signOut() {
    setPending(true)
    try {
      await fetch('/api/auth/sign-out', { method: 'POST' })
      router.push('/sign-in')
      router.refresh()
    } finally {
      setPending(false)
    }
  }
  return (
    <button type="button" className="button button-quiet" onClick={signOut} disabled={pending}>
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
