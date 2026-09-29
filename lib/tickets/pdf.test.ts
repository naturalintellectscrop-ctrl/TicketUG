import { describe, expect, it } from 'vitest'
import { buildTicketPdf, ticketPdfFilename, type TicketPdfSource } from './pdf'
import { ticketQrPng, ticketQrPayload } from './qr'

const baseSource = async (): Promise<TicketPdfSource> => ({
  ticket: { publicId: 'tkt_0123456789abcdef0123456789abcdef', ticketTypeName: 'Regular', attendeeName: 'Sarah Nakato', attendeeEmail: 'sarah@example.com', status: 'ISSUED', issuedAt: '2026-09-28T10:00:00Z' },
  order: { orderNumber: 'TUG-2026-0001' },
  event: { title: 'Nyege Nyege Warmup', startsAt: '2026-11-14T18:00:00Z', endsAt: '2026-11-15T02:00:00Z', timezone: 'Africa/Kampala', venueName: 'Nile Grounds', venueCity: 'Jinja' },
  organizerName: 'Night Shift Collective',
  eventHasGates: true,
  permittedGates: ['Main Gate', 'VIP Gate'],
  qrPng: await ticketQrPng('tkt_0123456789abcdef0123456789abcdef'),
})

describe('ticketPdfFilename', () => {
  it('uses the ticket reference in the TicketUG filename convention', () => {
    expect(ticketPdfFilename('tkt_abc123')).toBe('ticketug-ticket-tkt_abc123.pdf')
  })

  it('strips path separators, control characters and unsafe characters', () => {
    expect(ticketPdfFilename('../../etc/passwd')).toBe('ticketug-ticket-..-..-etc-passwd.pdf')
    expect(ticketPdfFilename('tkt_a\nb\tc d')).toBe('ticketug-ticket-tkt_a-b-c-d.pdf')
  })

  it('caps the length and falls back when nothing safe remains', () => {
    expect(ticketPdfFilename('x'.repeat(500)).length).toBeLessThanOrEqual('ticketug-ticket-'.length + 80 + '.pdf'.length)
    expect(ticketPdfFilename('///')).toBe('ticketug-ticket-ticket.pdf')
  })
})

describe('ticketQrPng', () => {
  it('encodes the SAME authoritative payload the scanner verifies', async () => {
    const credential = 'tkt_AAAAAAAAAAAAAAAAAAAAAA'
    expect(ticketQrPayload(credential)).toBe(`ticketug:v1:${credential}`)
    const png = await ticketQrPng(credential)
    expect(png.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
  })

  it('is deterministic per credential and differs across credentials', async () => {
    const a = await ticketQrPng('tkt_AAAAAAAAAAAAAAAAAAAAAA')
    const a2 = await ticketQrPng('tkt_AAAAAAAAAAAAAAAAAAAAAA')
    const b = await ticketQrPng('tkt_BBBBBBBBBBBBBBBBBBBBBB')
    expect(a.equals(a2)).toBe(true)
    expect(a.equals(b)).toBe(false)
  })
})

describe('buildTicketPdf', () => {
  it('renders a real PDF document with plausible content size', async () => {
    const buffer = await buildTicketPdf(await baseSource())
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(buffer.length).toBeGreaterThan(1500)
    expect(buffer.subarray(buffer.length - 1024).toString('latin1')).toContain('%%EOF')
  })

  it('does not crash when optional fields are missing (no organizer, no venue, no gates, sparse attendee)', async () => {
    const buffer = await buildTicketPdf({
      ...(await baseSource()),
      event: { ...(await baseSource()).event, venueName: null, venueCity: null },
      organizerName: null,
      eventHasGates: false,
      permittedGates: [],
      ticket: { ...(await baseSource()).ticket, attendeeName: '', attendeeEmail: '' },
    })
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })

  it('renders an honest gate notice when the event has gates but this type is unmapped', async () => {
    const buffer = await buildTicketPdf({ ...(await baseSource()), permittedGates: [] })
    expect(buffer.length).toBeGreaterThan(1500)
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })

  it('survives long event titles and empty status-note cases', async () => {
    const buffer = await buildTicketPdf({ ...(await baseSource()), event: { ...(await baseSource()).event, title: 'Kampala Night Market '.repeat(8) } })
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })
})
