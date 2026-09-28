import { NextResponse } from 'next/server'

// Shared relay logic for the PDF ticket proxies. The Next tier never touches
// ticket data here — the Nest API stays authoritative for both authorization
// and PDF generation; these proxies only forward the access credential
// (cookie for attendees, x-order-access-token for guests) and relay bytes.
//
// Cache-leak contract: PDF responses are always `cache-control: no-store`,
// content-type is forced to application/pdf on success, and the server's
// Content-Disposition filename is relayed verbatim (it is already sanitized
// server-side by ticketPdfFilename).

export function ticketPdfResponse(response: Response, payload: ArrayBuffer): NextResponse {
  const headers = new Headers()
  if (response.ok) {
    headers.set('content-type', 'application/pdf')
    const disposition = response.headers.get('content-disposition')
    if (disposition) headers.set('content-disposition', disposition)
  } else {
    headers.set('content-type', response.headers.get('content-type') ?? 'application/json')
  }
  headers.set('cache-control', 'no-store')
  return new NextResponse(payload, { status: response.status, headers })
}
