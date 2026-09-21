'use client'

import { useEffect, useState } from 'react'

type Member = { user_profile_id: string; display_name: string | null; role: string; status: string }
type Assignment = { id: string; user_profile_id: string; display_name: string | null; role: string; status: string }

export function EventStaffAssignment({ organizerId, eventId }: { organizerId: string; eventId: string }) {
  const [members, setMembers] = useState<Member[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [selected, setSelected] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const [membersResponse, assignmentsResponse] = await Promise.all([
      fetch(`/api/organizers/${organizerId}/members`),
      fetch(`/api/organizers/${organizerId}/events/${eventId}/staff`),
    ])
    if (membersResponse.ok) {
      const data = await membersResponse.json()
      setMembers(data.members.filter((member: Member) => member.role === 'EVENT_STAFF' && member.status === 'ACTIVE'))
    }
    if (assignmentsResponse.ok) setAssignments((await assignmentsResponse.json()).assignments)
  }

  // The initial request synchronizes this client-only panel with the server after hydration.
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { void load() }, [organizerId, eventId])

  async function assign() {
    if (!selected) return
    setBusy(true)
    setMessage('')
    const response = await fetch(`/api/organizers/${organizerId}/events/${eventId}/staff`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userProfileId: selected }) })
    setBusy(false)
    if (!response.ok) { setMessage('That staff member could not be assigned.'); return }
    setSelected('')
    setMessage('Event staff assignment saved.')
    await load()
  }

  async function remove(userProfileId: string) {
    const response = await fetch(`/api/organizers/${organizerId}/events/${eventId}/staff`, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userProfileId }) })
    if (response.ok) { setMessage('Assignment removed.'); await load() }
  }

  return <section className="surface stack" aria-labelledby="event-staff-heading">
    <div><p className="eyebrow">Operations</p><h2 id="event-staff-heading">Event staff</h2><p className="muted">Assign active event staff to this event. Scanner access is limited to assigned events.</p></div>
    <div className="row">
      <label className="sr-only" htmlFor="event-staff-select">Staff member</label>
      <select id="event-staff-select" value={selected} onChange={(event) => setSelected(event.target.value)}>
        <option value="">Choose active event staff</option>
        {members.filter((member) => !assignments.some((assignment) => assignment.user_profile_id === member.user_profile_id)).map((member) => <option key={member.user_profile_id} value={member.user_profile_id}>{member.display_name || 'Unnamed member'}</option>)}
      </select>
      <button className="button" type="button" disabled={!selected || busy} onClick={() => void assign()}>{busy ? 'Assigning…' : 'Assign staff'}</button>
    </div>
    {message && <p className="muted" role="status">{message}</p>}
    {assignments.length > 0 ? <div className="stack">{assignments.map((assignment) => <div className="row-between" key={assignment.id}><span><strong>{assignment.display_name || 'Unnamed member'}</strong><small className="muted">{assignment.role}</small></span><button className="button button-quiet" type="button" onClick={() => void remove(assignment.user_profile_id)}>Remove</button></div>)}</div> : <p className="muted">No staff assigned yet.</p>}
  </section>
}
