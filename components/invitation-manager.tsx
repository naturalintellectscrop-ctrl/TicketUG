'use client'

import { FormEvent, useState } from 'react'
import type { TicketUGRole } from '@/lib/request-context'

export type InvitationRow = {
  id: string
  invited_email: string
  role: string
  status: string
  expires_at: string
  accepted_at: string | null
  invitedByName: string | null
  expired: boolean
}

const ROLE_LABELS: Record<string, string> = {
  ORGANIZER_MANAGER: 'Manager',
  EVENT_STAFF: 'Event staff',
}

function effectiveState(row: InvitationRow) {
  if (row.status === 'PENDING' && row.expired) return 'EXPIRED'
  return row.status
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-UG', { dateStyle: 'medium', timeStyle: 'short' })
}

export function InvitationManager({ organizerId, actorRole, initialInvitations }: { organizerId: string; actorRole: TicketUGRole; initialInvitations: InvitationRow[] }) {
  const [invitations, setInvitations] = useState(initialInvitations)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('EVENT_STAFF')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [issued, setIssued] = useState<{ link: string; email: string; role: string } | null>(null)

  // Owners may invite managers and staff; managers may only invite staff —
  // mirrored from canManageMemberRole so the form never offers an option the API would refuse.
  const canInviteManagers = actorRole === 'ORGANIZER_OWNER'

  async function refresh() {
    const response = await fetch(`/api/organizers/${organizerId}/invitations`, { cache: 'no-store' })
    if (response.ok) setInvitations((await response.json()).invitations)
  }

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setMessage('')
    try {
      const response = await fetch(`/api/organizers/${organizerId}/invitations`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, role }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) {
        setMessage(result?.error || 'Unable to send the invitation.')
        return
      }
      const link = `${window.location.origin}/invitations/accept?token=${result.invitation.token}`
      setIssued({ link, email, role })
      setEmail('')
      await refresh()
    } catch {
      setMessage('Unable to send the invitation. Check your connection.')
    } finally {
      setPending(false)
    }
  }

  async function copyIssuedLink() {
    if (!issued) return
    try {
      await navigator.clipboard.writeText(issued.link)
      setMessage('Invite link copied. Share it with the invited email only.')
    } catch {
      setMessage('Copy failed — select the link and copy it manually.')
    }
  }

  async function revoke(invitation: InvitationRow) {
    if (!window.confirm(`Revoke the invitation for ${invitation.invited_email}? Its link stops working immediately.`)) return
    setPending(true)
    setMessage('')
    try {
      const response = await fetch(`/api/organizers/${organizerId}/invitations/${invitation.id}/revoke`, { method: 'PATCH' })
      const result = await response.json().catch(() => null)
      if (!response.ok) {
        setMessage(result?.error || 'Unable to revoke the invitation.')
        return
      }
      setMessage(`Invitation for ${invitation.invited_email} revoked.`)
      await refresh()
    } catch {
      setMessage('Unable to revoke the invitation. Check your connection.')
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="surface stack" aria-label="Team invitations">
      <div className="row-between"><div><p className="eyebrow">Grow the team</p><h2>Invitations</h2></div><span className="muted">{invitations.length} recent</span></div>
      <p className="muted">Invite links are bound to one email address, work for 7 days, and can be revoked any time before they are accepted. Email delivery is not wired up yet — share the link with the invitee yourself.</p>

      <form className="form-stack" onSubmit={invite}>
        <div className="row">
          <label htmlFor="invite-email">Invite by email
            <input
              id="invite-email"
              type="email"
              required
              maxLength={320}
              placeholder="name@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label htmlFor="invite-role">Role
            <select id="invite-role" value={role} onChange={(event) => setRole(event.target.value)}>
              {canInviteManagers && <option value="ORGANIZER_MANAGER">Manager</option>}
              <option value="EVENT_STAFF">Event staff</option>
            </select>
          </label>
        </div>
        <button type="submit" className="button button-primary" disabled={pending}>{pending ? 'Working…' : 'Create invitation'}</button>
      </form>

      {issued && (
        <div className="invite-issue" role="status">
          <strong>Invitation ready for {issued.email} · {ROLE_LABELS[issued.role] ?? issued.role}</strong>
          <p className="muted">This link is shown once and will not appear again. It only works for {issued.email} while signed in.</p>
          <p className="invite-token">{issued.link}</p>
          <div className="row">
            <button type="button" className="button button-dark" onClick={copyIssuedLink}>Copy invite link</button>
            <button type="button" className="button button-quiet" onClick={() => setIssued(null)}>Done</button>
          </div>
        </div>
      )}

      {invitations.length ? (
        <div className="invite-rows">
          {invitations.map((invitation) => {
            const state = effectiveState(invitation)
            return (
              <article className="invite-row" key={invitation.id}>
                <div>
                  <span className="invite-email">{invitation.invited_email}</span>
                  <span className="invite-meta">
                    {ROLE_LABELS[invitation.role] ?? invitation.role}
                    {invitation.invitedByName && <> · invited by {invitation.invitedByName}</>}
                    {state === 'PENDING' && <> · expires {formatDate(invitation.expires_at)}</>}
                    {state === 'EXPIRED' && <> · expired {formatDate(invitation.expires_at)}</>}
                    {state === 'ACCEPTED' && invitation.accepted_at && <> · accepted {formatDate(invitation.accepted_at)}</>}
                  </span>
                </div>
                <div className="row">
                  <span className="status-pill" data-status={state}>{state === 'PENDING' ? 'Pending' : state.charAt(0) + state.slice(1).toLowerCase()}</span>
                  {state === 'PENDING' && (
                    <button type="button" className="button button-danger" onClick={() => revoke(invitation)} disabled={pending}>Revoke</button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <p className="muted">No invitations yet. Create one above to add managers or event staff.</p>
      )}

      {message && <p role="status">{message}</p>}
    </section>
  )
}
