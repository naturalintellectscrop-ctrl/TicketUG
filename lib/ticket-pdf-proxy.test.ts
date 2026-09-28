import { describe, expect, it } from 'vitest'
import { ticketPdfResponse } from './ticket-pdf-proxy'

function upstream(status: number, headers: Record<string, string> = {}): Response {
  return new Response('payload', { status, headers })
}

describe('ticketPdfResponse relay contract', () => {
  it('forces application/pdf and relays the sanitized server filename on success', () => {
    const result = ticketPdfResponse(upstream(200, { 'content-type': 'application/pdf', 'content-disposition': 'attachment; filename="ticketug-ticket-tkt_abc.pdf"' }), emptyPayload())
    expect(result.headers.get('content-type')).toBe('application/pdf')
    expect(result.headers.get('content-disposition')).toBe('attachment; filename="ticketug-ticket-tkt_abc.pdf"')
    expect(result.headers.get('cache-control')).toBe('no-store')
    expect(result.status).toBe(200)
  })

  it('never caches and relays upstream error content-type (JSON) for failed authorization', () => {
    const result = ticketPdfResponse(upstream(404, { 'content-type': 'application/json' }), emptyPayload())
    expect(result.headers.get('content-type')).toBe('application/json')
    expect(result.headers.get('cache-control')).toBe('no-store')
    expect(result.headers.get('content-disposition')).toBeNull()
    expect(result.status).toBe(404)
  })

  it('falls back to application/json error content-type when upstream sends none', () => {
    // Bodyless Response has no content-type header at all.
    const result = ticketPdfResponse(new Response(null, { status: 500 }), emptyPayload())
    expect(result.headers.get('content-type')).toBe('application/json')
    expect(result.headers.get('cache-control')).toBe('no-store')
  })
})

function emptyPayload(): ArrayBuffer {
  return new ArrayBuffer(7)
}
