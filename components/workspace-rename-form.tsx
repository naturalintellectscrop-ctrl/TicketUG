'use client'

import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'

export function WorkspaceRenameForm({ organizerId, initialName }: { organizerId: string; initialName: string }) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')

  async function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = name.trim()
    if (trimmed === initialName) {
      setMessage('The name is unchanged.')
      return
    }
    setPending(true)
    setMessage('')
    try {
      const response = await fetch(`/api/organizers/${organizerId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) {
        setMessage(result?.error || 'The rename did not go through. Try again.')
        return
      }
      setName(result.organizer.name)
      setMessage(`Workspace renamed to ${result.organizer.name}.`)
      router.refresh()
    } catch {
      setMessage('The rename did not go through. Check your connection.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="form-stack" onSubmit={rename}>
      <label htmlFor="workspace-name">Workspace name
        <input
          id="workspace-name"
          type="text"
          required
          minLength={2}
          maxLength={120}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <div className="row">
        <button type="submit" className="button button-primary" disabled={pending}>{pending ? 'Saving…' : 'Save name'}</button>
        <button type="button" className="button button-quiet" onClick={() => { setName(initialName); setMessage('') }} disabled={pending || name.trim() === initialName}>Reset</button>
      </div>
      {message && <p role="status">{message}</p>}
    </form>
  )
}
