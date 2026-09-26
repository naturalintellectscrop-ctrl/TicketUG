'use client'

import { useState } from 'react'

type StaffRow = { id: string; userProfileId: string; displayName: string | null; memberRole: string | null; status: string }
type MemberRow = { userProfileId: string; displayName: string | null; role: string }

export function EventStaffManager({ organizerId, eventId, initialStaff, members }: { organizerId: string; eventId: string; initialStaff: StaffRow[]; members: MemberRow[] }) {
  const [staff, setStaff] = useState(initialStaff)
  const [selected, setSelected] = useState('')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const assignedIds = new Set(staff.map((row) => row.userProfileId))
  const eligible = members.filter((member) => !assignedIds.has(member.userProfileId))

  async function refresh() {
    const response = await fetch(`/api/organizers/${organizerId}/events/${eventId}/staff`)
    if (response.ok) setStaff((await response.json()).staff)
  }

  async function assign() {
    if (!selected) return
    setPending(true)
    setMessage('')
    try {
      const response = await fetch(`/api/organizers/${organizerId}/events/${eventId}/staff`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userProfileId: selected }) })
      const result = await response.json()
      if (!response.ok) setMessage(result.error || 'Unable to assign staff.')
      else { setMessage('Staff member assigned. They can now scan this event.'); setSelected(''); await refresh() }
    } catch { setMessage('Unable to assign staff. Check your connection.') } finally { setPending(false) }
  }

  async function remove(userProfileId: string) {
    setPending(true)
    setMessage('')
    try {
      const response = await fetch(`/api/organizers/${organizerId}/events/${eventId}/staff`, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userProfileId }) })
      if (!response.ok) setMessage('Unable to remove staff.')
      else { setMessage('Staff access removed.'); await refresh() }
    } catch { setMessage('Unable to remove staff. Check your connection.') } finally { setPending(false) }
  }

  return (
    <section className="surface stack" aria-label="Event staff">
      <div className="row-between"><div><p className="eyebrow">Event operations</p><h2>Event staff</h2></div><span className="muted">{staff.length} assigned</span></div>
      <p className="muted">Assigned staff can open the scanner and check in tickets for this event. Duplicate assignments are prevented automatically.</p>
      {staff.length ? (
        <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {staff.map((row) => (
            <li className="row-between" key={row.id}>
              <span><strong>{row.displayName || 'Member'}</strong>{row.memberRole && <span className="muted"> · {row.memberRole.replace('ORGANIZER_', '').replace('_', ' ').toLowerCase()}</span>}</span>
              <button type="button" className="button button-quiet" onClick={() => remove(row.userProfileId)} disabled={pending}>Remove</button>
            </li>
          ))}
        </ul>
      ) : (
        <p>No staff assigned yet. Without an assignment, event staff cannot scan this event.</p>
      )}
      {eligible.length ? (
        <div className="row">
          <label htmlFor="staff-select" className="sr-only">Assign a member</label>
          <select id="staff-select" value={selected} onChange={(event) => setSelected(event.target.value)}>
            <option value="">Choose a member…</option>
            {eligible.map((member) => <option key={member.userProfileId} value={member.userProfileId}>{member.displayName || 'Member'} · {member.role.replace('ORGANIZER_', '').replace('_', ' ').toLowerCase()}</option>)}
          </select>
          <button type="button" className="button button-primary" onClick={assign} disabled={pending || !selected}>{pending ? 'Working…' : 'Assign staff'}</button>
        </div>
      ) : (
        <p className="muted">All active members are assigned. Invite more team members from the organizer team page.</p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  )
}
