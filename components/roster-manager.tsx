'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { canManageMemberRole } from '@/lib/organizer-authorization'
import type { TicketUGRole } from '@/lib/request-context'

export type MemberRow = {
  id: string
  user_profile_id: string
  display_name: string | null
  role: string
  status: string
  created_at: string
}

const ROLE_LABELS: Record<string, string> = {
  ORGANIZER_OWNER: 'Owner',
  ORGANIZER_MANAGER: 'Manager',
  EVENT_STAFF: 'Event staff',
}

function initials(name: string | null) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return parts.slice(0, 2).map((part) => part[0]!.toUpperCase()).join('')
}

function joinedOn(value: string) {
  return new Date(value).toLocaleDateString('en-UG', { dateStyle: 'medium' })
}

function memberLabel(member: MemberRow) {
  return member.display_name ?? 'This member'
}

export function RosterManager({ organizerId, actorRole, selfProfileId, initialMembers }: { organizerId: string; actorRole: TicketUGRole; selfProfileId: string; initialMembers: MemberRow[] }) {
  const router = useRouter()
  const [members, setMembers] = useState(initialMembers)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')

  const isOwner = actorRole === 'ORGANIZER_OWNER'

  async function refresh() {
    const response = await fetch(`/api/organizers/${organizerId}/members`, { cache: 'no-store' })
    if (response.ok) setMembers((await response.json()).members)
  }

  async function send(method: 'PATCH' | 'DELETE', memberId: string, body?: unknown) {
    setPending(true)
    setMessage('')
    try {
      const response = await fetch(`/api/organizers/${organizerId}/members/${memberId}`, {
        method,
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) {
        setMessage(result?.error || 'The change did not go through. Try again.')
        return false
      }
      return true
    } catch {
      setMessage('The change did not go through. Check your connection.')
      return false
    } finally {
      setPending(false)
    }
  }

  async function changeRole(member: MemberRow, nextRole: string) {
    const label = ROLE_LABELS[nextRole] ?? nextRole
    if (!window.confirm(`Change ${memberLabel(member)} to ${label.toLowerCase()}? The change takes effect on their next action.`)) return
    const ok = await send('PATCH', member.id, { role: nextRole })
    if (!ok) return
    setMessage(`${memberLabel(member)} is now ${label === 'Event staff' ? 'event staff' : `a ${label.toLowerCase()}`}.`)
    await refresh()
  }

  async function removeMember(member: MemberRow) {
    if (!window.confirm(`Remove ${memberLabel(member)} from the workspace? They lose access immediately and can only come back through a new invitation.`)) return
    const ok = await send('DELETE', member.id)
    if (!ok) return
    setMessage(`${memberLabel(member)} was removed from the workspace.`)
    await refresh()
  }

  async function leaveTeam(member: MemberRow) {
    if (!window.confirm('Leave this workspace? You lose access immediately and can only come back through a new invitation.')) return
    const ok = await send('DELETE', member.id)
    if (!ok) return
    router.push('/organizer')
    router.refresh()
  }

  async function transferOwnership(member: MemberRow) {
    if (!window.confirm(`Transfer ownership to ${memberLabel(member)}? They become the owner immediately and you continue as a manager. You can leave the team afterwards.`)) return
    setPending(true)
    setMessage('')
    try {
      const response = await fetch(`/api/organizers/${organizerId}/transfer-ownership`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ memberId: member.id }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) {
        setMessage(result?.error || 'The transfer did not go through. Try again.')
        return
      }
      setMessage(`Ownership transferred to ${memberLabel(member)}. You are now a manager.`)
      await refresh()
      router.refresh()
    } catch {
      setMessage('The transfer did not go through. Check your connection.')
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <div className="roster-rows">
        {members.map((member) => {
          const self = member.user_profile_id === selfProfileId
          const actionable = member.status === 'ACTIVE' && canManageMemberRole(actorRole, member.role as TicketUGRole)
          return (
            <article className="roster-row" key={member.id} data-self={self ? 'true' : undefined}>
              <div className="member-identity">
                <span className="member-avatar" data-role={member.role} aria-hidden="true">{initials(member.display_name)}</span>
                <div>
                  <span className="member-name">
                    {member.display_name ?? 'Unnamed member'}
                    {self && <span className="member-self-tag">You</span>}
                  </span>
                  <span className="member-meta">
                    <span className="role-badge" data-role={member.role}>{ROLE_LABELS[member.role] ?? member.role}</span>
                    <span>joined {joinedOn(member.created_at)}</span>
                  </span>
                </div>
              </div>
              <div className="roster-actions">
                {member.status !== 'ACTIVE' && <span className="status-pill" data-status={member.status}>{member.status}</span>}
                {isOwner && !self && member.status === 'ACTIVE' && (
                  <button type="button" className="button button-ownership" onClick={() => transferOwnership(member)} disabled={pending}>Transfer ownership</button>
                )}
                {isOwner && member.role === 'ORGANIZER_MANAGER' && (
                  <button type="button" className="button button-quiet" onClick={() => changeRole(member, 'EVENT_STAFF')} disabled={pending}>Demote to staff</button>
                )}
                {isOwner && member.role === 'EVENT_STAFF' && (
                  <button type="button" className="button button-quiet" onClick={() => changeRole(member, 'ORGANIZER_MANAGER')} disabled={pending}>Make manager</button>
                )}
                {actionable && !self && (
                  <button type="button" className="button button-danger" onClick={() => removeMember(member)} disabled={pending}>Remove</button>
                )}
                {self && !isOwner && (
                  <button type="button" className="button button-danger" onClick={() => leaveTeam(member)} disabled={pending}>Leave this team</button>
                )}
              </div>
            </article>
          )
        })}
      </div>
      {isOwner ? (
        <p className="muted">You own this workspace. Use Transfer ownership to hand the seat to any member — afterwards you stay on as a manager and can leave the team whenever you like.</p>
      ) : (
        <p className="muted">You can leave this workspace yourself — you would only get back in through a new invitation.</p>
      )}
      {message && <p role="status">{message}</p>}
    </>
  )
}
