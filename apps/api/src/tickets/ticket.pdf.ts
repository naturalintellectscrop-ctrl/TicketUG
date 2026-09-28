import PDFDocument from 'pdfkit'

// Production PDF ticket rendering. The PDF is a delivery/print representation
// of an ALREADY-AUTHORIZED ticket: every field arrives from the authoritative
// server-side ticket/order/event query (see TicketsService.pdfSource), the QR
// is built from the same credential mechanism the scanner verifies
// (ticket.qr.ts — `ticketug:v1:<credential>`), and nothing here re-derives or
// trusts client-supplied data. Missing optional fields render honestly instead
// of being invented.

// Brand palette (mirrors app/globals.css :root tokens).
const INK = '#171714'
const CREAM = '#fff8ed'
const BRAND = '#ef5b43'
const MUTED = '#716d62'
const BORDER = '#d8d0c1'

// Real TicketUG support channels, committed by the team on /contact
// (app/contact/page.tsx) — carried over verbatim; never invent contact details.
const SUPPORT_LINES = ['Support: +256 752 256 576 · +256 762 449 504 (call or WhatsApp)']

export type TicketPdfSource = {
  ticket: { publicId: string; ticketTypeName: string; attendeeName: string; attendeeEmail: string; status: string; issuedAt: string }
  order: { orderNumber: string }
  event: { title: string; startsAt: string; endsAt: string; timezone: string; venueName: string | null; venueCity: string | null }
  organizerName: string | null
  /** True when the event has at least one active gate. */
  eventHasGates: boolean
  /** Names of the active gates this ticket's type is permitted through. */
  permittedGates: string[]
  qrPng: Buffer
}

const A5: [number, number] = [419.53, 595.28]
const PAGE_PADDING = 28

/** status-specific honest note; null = no extra note. */
function statusNote(status: string): string | null {
  if (status === 'CHECKED_IN') return 'This ticket has already been checked in.'
  if (status === 'CANCELLED' || status === 'REFUNDED' || status === 'VOID') return `This ticket is ${status.toLowerCase()} — it will not pass the gate.`
  return null
}

/** Safe download filename: ticketug-ticket-<reference>.pdf */
export function ticketPdfFilename(publicId: string): string {
  const safe = publicId.replace(/[^A-Za-z0-9._-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80)
  return `ticketug-ticket-${safe || 'ticket'}.pdf`
}

function formatDateRange(startsAt: string, endsAt: string, timezone: string): string {
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  const day = (date: Date) => new Intl.DateTimeFormat('en-UG', { dateStyle: 'medium', timeZone: timezone }).format(date)
  const time = (date: Date) => new Intl.DateTimeFormat('en-UG', { timeStyle: 'short', timeZone: timezone }).format(date)
  // Overnight/multi-day events print both full dates so the range is never misleading.
  if (day(start) !== day(end)) return `${day(start)}, ${time(start)} – ${day(end)}, ${time(end)} (${timezone})`
  return `${day(start)} · ${time(start)} – ${time(end)} (${timezone})`
}

export async function buildTicketPdf(source: TicketPdfSource): Promise<Buffer> {
  const doc = new PDFDocument({ size: A5, margins: { top: PAGE_PADDING, bottom: PAGE_PADDING, left: PAGE_PADDING, right: PAGE_PADDING }, info: { Title: `TicketUG — ${source.event.title} — ${source.ticket.publicId}`, Author: 'TicketUG · Natural Intellects Ltd' } })
  const chunks: Buffer[] = []
  const done = new Promise<Buffer>((resolve) => { doc.on('data', (chunk: Buffer) => chunks.push(chunk)); doc.on('end', () => resolve(Buffer.concat(chunks))) })

  const width = A5[0] - PAGE_PADDING * 2
  let y = 0

  // Header band
  doc.rect(0, 0, A5[0], 62).fill(INK)
  doc.fill(CREAM).font('Helvetica-Bold').fontSize(19).text('TicketUG', PAGE_PADDING, 22)
  doc.font('Helvetica').fontSize(8).fillColor('#b9b3a5').text('E-TICKET', A5[0] - PAGE_PADDING - doc.widthOfString('E-TICKET'), 27)
  doc.rect(0, 62, A5[0], 4).fill(BRAND)
  y = 84

  // Event identity
  doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(7.5).text('EVENT', PAGE_PADDING, y, { characterSpacing: 1.2 })
  y += 13
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(20).text(source.event.title || 'Untitled event', PAGE_PADDING, y, { width, lineGap: -1 })
  y = doc.y + 10

  doc.fillColor(INK).font('Helvetica').fontSize(9.5).text(formatDateRange(source.event.startsAt, source.event.endsAt, source.event.timezone), PAGE_PADDING, y, { width })
  y = doc.y + 4
  const venue = [source.event.venueName, source.event.venueCity].filter(Boolean).join(', ')
  doc.fillColor(MUTED).fontSize(9.5).text(venue || 'Venue to be announced', PAGE_PADDING, y, { width })
  y = doc.y + 14

  // Divider
  doc.moveTo(PAGE_PADDING, y).lineTo(A5[0] - PAGE_PADDING, y).lineWidth(0.75).strokeColor(BORDER).stroke()
  y += 14

  // Ticket meta
  const row = (label: string, value: string) => {
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(7.5).text(label, PAGE_PADDING, y + 2, { characterSpacing: 1.2, width: 92 })
    doc.fillColor(INK).font('Helvetica').fontSize(10).text(value, PAGE_PADDING + 96, y, { width: width - 96, lineGap: 0 })
    y = Math.max(doc.y, y + 14) + 6
  }
  row('TICKET', source.ticket.ticketTypeName || '—')
  row('ATTENDEE', source.ticket.attendeeName || source.ticket.attendeeEmail || 'Not provided')
  row('TICKET REF', source.ticket.publicId)
  row('ORDER', source.order.orderNumber)
  row('STATUS', source.ticket.status)
  if (source.organizerName) row('ORGANIZER', source.organizerName)
  const note = statusNote(source.ticket.status)
  if (note) { doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(8.5).text(note, PAGE_PADDING, y, { width }); y = doc.y + 10 }
  y += 2

  // Gate access (only when the event actually models gates — never invent one)
  if (source.eventHasGates) {
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(7.5).text('ENTRY', PAGE_PADDING, y, { characterSpacing: 1.2 })
    y += 12
    doc.fillColor(INK).font('Helvetica').fontSize(9)
    if (source.permittedGates.length > 0) doc.text(`Valid at: ${source.permittedGates.join(' · ')}`, PAGE_PADDING, y, { width })
    else doc.text('No gate permissions configured yet — this ticket cannot be scanned until the organizer maps its type to a gate.', PAGE_PADDING, y, { width })
    y = doc.y + 12
  }

  // QR credential
  const qrSize = 148
  const qrX = (A5[0] - qrSize) / 2
  doc.image(source.qrPng, qrX, y, { width: qrSize, height: qrSize })
  y += qrSize + 10
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(8.5).text('Verified by TicketUG at entry', PAGE_PADDING, y, { align: 'center', width })
  y = doc.y + 3
  doc.fillColor(MUTED).font('Helvetica').fontSize(7.5).text('Each QR scans once. The scanner checks this credential against the ticket registry server-side — keep it private until you arrive.', PAGE_PADDING, y, { align: 'center', width })
  y = doc.y + 14

  // Footer (real support channels + company line)
  const footerY = A5[1] - PAGE_PADDING - 24
  doc.moveTo(PAGE_PADDING, footerY - 10).lineTo(A5[0] - PAGE_PADDING, footerY - 10).lineWidth(0.75).strokeColor(BORDER).stroke()
  doc.fillColor(MUTED).fontSize(7)
  doc.text(SUPPORT_LINES[0], PAGE_PADDING, footerY, { align: 'center', width })
  doc.text('TicketUG · Natural Intellects Ltd', PAGE_PADDING, doc.y + 2, { align: 'center', width })

  doc.end()
  return done
}
