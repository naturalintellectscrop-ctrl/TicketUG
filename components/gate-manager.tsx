'use client'

import { useState } from 'react'

type GateRow = { id: string; name: string; description: string; isActive: boolean; ticketTypeIds: string[] }
type TicketTypeOption = { id: string; publicId: string; name: string; active: boolean }

// Organizer gate management (Pair 1B): create, rename, enable/disable, delete
// gates and configure which ticket types may enter through each one. All
// mutations go through the owner/manager-guarded gate APIs; this UI can never
// offer more than the server would accept.
export function GateManager({ organizerId, eventId, initialGates, ticketTypes }: { organizerId: string; eventId: string; initialGates: GateRow[]; ticketTypes: TicketTypeOption[] }) {
  const [gates, setGates] = useState(initialGates)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string[]>>({})

  async function refresh() {
    const response = await fetch(`/api/organizers/${organizerId}/events/${eventId}/gates`)
    if (response.ok) { setGates((await response.json()).gates); setDrafts({}) }
  }

  async function createGate() {
    if (!name.trim()) return
    setPending(true); setMessage('')
    try {
      const response = await fetch(`/api/organizers/${organizerId}/events/${eventId}/gates`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, description }) })
      const result = await response.json()
      if (!response.ok) setMessage(result.message || 'Unable to create the gate.')
      else { setMessage(`“${result.gate.name}” created. Now choose which ticket types may enter through it.`); setName(''); setDescription(''); await refresh() }
    } catch { setMessage('Unable to create the gate. Check your connection.') } finally { setPending(false) }
  }

  async function patchGate(gateId: string, body: Record<string, unknown>, successMessage: string) {
    setPending(true); setMessage('')
    try {
      const response = await fetch(`/api/organizers/${organizerId}/events/${eventId}/gates/${gateId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const result = await response.json()
      if (!response.ok) setMessage(result.message || 'Unable to update the gate.')
      else { setMessage(successMessage); setEditing(null); await refresh() }
    } catch { setMessage('Unable to update the gate. Check your connection.') } finally { setPending(false) }
  }

  async function deleteGate(gate: GateRow) {
    if (!window.confirm(`Delete “${gate.name}”? Its ticket-type permissions and any staff assignments scoped to it are removed — those staff lose scanner access until you reassign them.`)) return
    setPending(true); setMessage('')
    try {
      const response = await fetch(`/api/organizers/${organizerId}/events/${eventId}/gates/${gate.id}`, { method: 'DELETE' })
      const result = await response.json()
      if (!response.ok) setMessage(result.message || 'Unable to delete the gate.')
      else { setMessage(`“${gate.name}” deleted.`); await refresh() }
    } catch { setMessage('Unable to delete the gate. Check your connection.') } finally { setPending(false) }
  }

  async function savePermissions(gate: GateRow) {
    const ids = drafts[gate.id] ?? gate.ticketTypeIds
    setPending(true); setMessage('')
    try {
      const response = await fetch(`/api/organizers/${organizerId}/events/${eventId}/gates/${gate.id}/ticket-types`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ticketTypeIds: ids }) })
      const result = await response.json()
      if (!response.ok) setMessage(result.message || 'Unable to save gate permissions.')
      else { setMessage(ids.length ? `“${gate.name}” now admits ${ids.length} ticket ${ids.length === 1 ? 'type' : 'types'}.` : `“${gate.name}” now admits no ticket types — it will reject every ticket until you map at least one.`); await refresh() }
    } catch { setMessage('Unable to save gate permissions. Check your connection.') } finally { setPending(false) }
  }

  function draftFor(gate: GateRow) {
    return drafts[gate.id] ?? gate.ticketTypeIds
  }

  function togglePermission(gate: GateRow, ticketTypeId: string) {
    const current = draftFor(gate)
    const next = current.includes(ticketTypeId) ? current.filter((id) => id !== ticketTypeId) : [...current, ticketTypeId]
    setDrafts({ ...drafts, [gate.id]: next })
  }

  return (
    <section className="surface stack" aria-label="Event gates">
      <div className="row-between"><div><p className="eyebrow">Access control</p><h2>Gates</h2></div><span className="muted">{gates.length} {gates.length === 1 ? 'gate' : 'gates'}</span></div>
      <p className="muted">Gates are the physical entry points your staff scan at — Main Gate, VIP Gate, and so on. A staff member assigned to a gate can only admit ticket types permitted through that exact gate. If an event has active gates, a ticket type with no gate permissions is rejected at every gate until you map it.</p>
      {gates.length ? (
        <div className="gate-list">
          {gates.map((gate) => {
            const draft = draftFor(gate)
            const dirty = JSON.stringify([...draft].sort()) !== JSON.stringify([...gate.ticketTypeIds].sort())
            return (
              <article className="gate-card" key={gate.id}>
                <div className="gate-card-head">
                  {editing?.id === gate.id ? (
                    <form className="row" onSubmit={(event) => { event.preventDefault(); if (editing.name.trim()) void patchGate(gate.id, { name: editing.name.trim() }, 'Gate renamed.') }}>
                      <label htmlFor={`gate-name-${gate.id}`} className="sr-only">Gate name</label>
                      <input id={`gate-name-${gate.id}`} value={editing.name} maxLength={120} onChange={(event) => setEditing({ id: gate.id, name: event.target.value })} />
                      <button type="submit" className="button button-primary" disabled={pending || !editing.name.trim()}>Save</button>
                      <button type="button" className="button button-quiet" onClick={() => setEditing(null)}>Cancel</button>
                    </form>
                  ) : (
                    <h3>{gate.name} <span className={`gate-state ${gate.isActive ? 'gate-on' : 'gate-off'}`}>{gate.isActive ? 'Active' : 'Disabled'}</span></h3>
                  )}
                  <div className="gate-actions">
                    {!editing || editing.id !== gate.id ? <button type="button" className="button button-quiet" onClick={() => setEditing({ id: gate.id, name: gate.name })} disabled={pending}>Rename</button> : null}
                    <button type="button" className="button button-quiet" onClick={() => void patchGate(gate.id, { isActive: !gate.isActive }, gate.isActive ? `“${gate.name}” disabled — its scanners stop admitting tickets.` : `“${gate.name}” enabled.`)} disabled={pending}>{gate.isActive ? 'Disable' : 'Enable'}</button>
                    <button type="button" className="button button-quiet" onClick={() => void deleteGate(gate)} disabled={pending}>Delete</button>
                  </div>
                </div>
                {gate.description && <p className="gate-desc">{gate.description}</p>}
                {ticketTypes.length ? (
                  <>
                    <fieldset className="gate-perms" style={{ border: 0, margin: 0, padding: 0 }}>
                      <legend className="muted" style={{ fontSize: '.8rem', marginBottom: 8 }}>Ticket types permitted through this gate</legend>
                      {ticketTypes.map((type) => {
                        const checked = draft.includes(type.id)
                        return (
                          <label className={`perm-chip${checked ? ' is-checked' : ''}`} key={type.id}>
                            <input type="checkbox" checked={checked} onChange={() => togglePermission(gate, type.id)} />
                            {type.name}{!type.active && ' (inactive)'}
                          </label>
                        )
                      })}
                    </fieldset>
                    <div className="gate-actions">
                      <button type="button" className="button button-primary" onClick={() => void savePermissions(gate)} disabled={pending || !dirty}>{dirty ? 'Save permissions' : 'Permissions saved'}</button>
                      {dirty && <button type="button" className="button button-quiet" onClick={() => setDrafts({ ...drafts, [gate.id]: gate.ticketTypeIds })} disabled={pending}>Discard changes</button>}
                    </div>
                  </>
                ) : (
                  <p className="muted">No ticket types on this event yet — create ticket types first, then map them to gates.</p>
                )}
              </article>
            )
          })}
        </div>
      ) : (
        <div className="gate-empty">No gates yet. Add your first gate below — for example “Main Gate” — then choose which ticket types may enter through it. Without gates, scanners work event-wide as before.</div>
      )}
      <div className="form-stack">
        <h3>Add a gate</h3>
        <div className="row">
          <label htmlFor="new-gate-name" className="sr-only">Gate name</label>
          <input id="new-gate-name" value={name} maxLength={120} placeholder="e.g. Main Gate" onChange={(event) => setName(event.target.value)} />
        </div>
        <label htmlFor="new-gate-desc">Description <span className="muted">(optional)</span>
          <input id="new-gate-desc" value={description} maxLength={500} placeholder="e.g. South entrance, general admission lanes" onChange={(event) => setDescription(event.target.value)} />
        </label>
        <div className="row"><button type="button" className="button button-primary" onClick={() => void createGate()} disabled={pending || !name.trim()}>{pending ? 'Working…' : 'Create gate'}</button></div>
      </div>
      {message && <p role="status">{message}</p>}
    </section>
  )
}
