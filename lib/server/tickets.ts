import { createHash } from 'node:crypto'
import { pool } from '@/lib/db'
import { ticketQrDataUrl, ticketQrPng } from '@/lib/tickets/qr'
import { buildTicketPdf, ticketPdfFilename, type TicketPdfSource } from '@/lib/tickets/pdf'
import type { TicketProjection } from '@/lib/tickets/contracts'
import { notFound, unauthorized } from '@/lib/server/errors'

// Ticket reads — Supabase-native replacement for the removed NestJS
// TicketsService read paths (issuance itself moved into the
// ticketug.apply_payment_event SQL function). Authorization is part of the
// SAME SQL statement as the data read (owner_profile_id / guest token hash);
// one query per access path, no second authorization system.

const projection = `t.public_id, t.order_id, o.public_id AS order_public_id, o.order_number, t.event_id,
  t.event_title_snapshot AS event_title, t.event_starts_at, t.event_ends_at,
  t.venue_name_snapshot AS venue_name, t.venue_city_snapshot AS venue_city,
  t.ticket_type_name_snapshot AS ticket_type_name, t.attendee_name, t.attendee_email,
  t.status, t.issued_at`

type Row = { public_id: string; order_id: string; order_public_id: string; order_number: string; event_id: string; event_title: string; event_starts_at: string; event_ends_at: string; venue_name: string | null; venue_city: string | null; ticket_type_name: string; attendee_name: string; attendee_email: string; status: TicketProjection['status']; issued_at: string }
type PdfRow = Row & { credential: string; timezone: string; organizer_name: string | null; event_has_gates: boolean; permitted_gates: string[] | null }

function present(row: Row): TicketProjection {
  return {
    publicId: row.public_id, orderPublicId: row.order_public_id, orderNumber: row.order_number,
    eventId: row.event_id, eventTitle: row.event_title, eventStartsAt: row.event_starts_at,
    eventEndsAt: row.event_ends_at, venueName: row.venue_name, venueCity: row.venue_city,
    ticketTypeName: row.ticket_type_name, attendeeName: row.attendee_name, attendeeEmail: row.attendee_email,
    status: row.status, issuedAt: row.issued_at,
  }
}

function hashToken(token: string) { return createHash('sha256').update(token).digest('hex') }

export async function getTicketForProfile(profileId: string, publicId: string): Promise<TicketProjection & { qrDataUrl?: string }> {
  const row = (await pool.query<Row>(
    `SELECT ${projection} FROM ticketug.ticket t JOIN ticketug.order o ON o.id = t.order_id
      WHERE t.public_id = $1 AND t.owner_profile_id = $2`,
    [publicId, profileId],
  )).rows[0]
  if (!row) throw notFound('Ticket not found')
  const secret = (await pool.query<{ credential: string }>(
    'SELECT credential FROM ticketug.ticket WHERE public_id = $1 AND owner_profile_id = $2',
    [publicId, profileId],
  )).rows[0]
  return { ...present(row), qrDataUrl: secret?.credential ? await ticketQrDataUrl(secret.credential) : undefined }
}

export async function listTicketsForGuest(orderPublicId: string, token: string): Promise<TicketProjection[]> {
  if (!token) throw unauthorized('Guest access token required')
  const result = await pool.query<Row>(
    `SELECT ${projection} FROM ticketug.ticket t JOIN ticketug.order o ON o.id = t.order_id
      WHERE o.public_id = $1 AND o.guest_access_token_hash = $2 AND o.user_profile_id IS NULL
      ORDER BY t.issued_at`,
    [orderPublicId, hashToken(token)],
  )
  return result.rows.map(present)
}

export async function getTicketForGuest(orderPublicId: string, ticketPublicId: string, token: string): Promise<TicketProjection & { qrDataUrl?: string }> {
  if (!token) throw unauthorized('Guest access token required')
  const row = (await pool.query<Row & { credential: string }>(
    `SELECT ${projection}, t.credential FROM ticketug.ticket t JOIN ticketug.order o ON o.id = t.order_id
      WHERE o.public_id = $1 AND t.public_id = $2 AND o.guest_access_token_hash = $3 AND o.user_profile_id IS NULL`,
    [orderPublicId, ticketPublicId, hashToken(token)],
  )).rows[0]
  if (!row) throw notFound('Ticket not found')
  return { ...present(row), qrDataUrl: await ticketQrDataUrl(row.credential) }
}

// --- PDF tickets ------------------------------------------------------------
// One authoritative query per access path (owner / guest token) that joins the
// same rows the digital ticket uses, plus print-relevant context (timezone,
// organizer name, gate permissions). The PDF builder receives ONLY this
// server-loaded data — no client-supplied ticket details.

const pdfProjection = `${projection}, t.credential, e.timezone, org.name AS organizer_name,
  EXISTS(SELECT 1 FROM ticketug.event_gate g WHERE g.event_id = e.id AND g.is_active = true) AS event_has_gates,
  (SELECT array_agg(g.name ORDER BY g.name) FROM ticketug.ticket_type_gate ttg JOIN ticketug.event_gate g ON g.id = ttg.gate_id
    WHERE ttg.ticket_type_id = t.ticket_type_id AND g.event_id = e.id AND g.is_active = true) AS permitted_gates`
const pdfFrom = ` FROM ticketug.ticket t
  JOIN ticketug.order o ON o.id = t.order_id
  JOIN ticketug.event e ON e.id = t.event_id
  LEFT JOIN ticketug.organizer org ON org.id = e.organizer_id`

async function pdfFromRow(row: PdfRow): Promise<{ buffer: Buffer; filename: string }> {
  if (!row.credential) throw notFound('Ticket credential unavailable')
  const source: TicketPdfSource = {
    ticket: { publicId: row.public_id, ticketTypeName: row.ticket_type_name, attendeeName: row.attendee_name, attendeeEmail: row.attendee_email, status: row.status, issuedAt: row.issued_at },
    order: { orderNumber: row.order_number },
    event: { title: row.event_title, startsAt: row.event_starts_at, endsAt: row.event_ends_at, timezone: row.timezone || 'Africa/Kampala', venueName: row.venue_name, venueCity: row.venue_city },
    organizerName: row.organizer_name,
    eventHasGates: row.event_has_gates === true,
    permittedGates: row.permitted_gates ?? [],
    qrPng: await ticketQrPng(row.credential),
  }
  return { buffer: await buildTicketPdf(source), filename: ticketPdfFilename(row.public_id) }
}

export async function getTicketPdfForProfile(profileId: string, publicId: string) {
  const row = (await pool.query<PdfRow>(
    `SELECT ${pdfProjection}${pdfFrom} WHERE t.public_id = $1 AND t.owner_profile_id = $2`,
    [publicId, profileId],
  )).rows[0]
  if (!row) throw notFound('Ticket not found')
  return pdfFromRow(row)
}

export async function getTicketPdfForGuest(orderPublicId: string, ticketPublicId: string, token: string) {
  if (!token) throw unauthorized('Guest access token required')
  const row = (await pool.query<PdfRow>(
    `SELECT ${pdfProjection}${pdfFrom} WHERE o.public_id = $1 AND t.public_id = $2 AND o.guest_access_token_hash = $3 AND o.user_profile_id IS NULL`,
    [orderPublicId, ticketPublicId, hashToken(token)],
  )).rows[0]
  if (!row) throw notFound('Ticket not found')
  return pdfFromRow(row)
}
