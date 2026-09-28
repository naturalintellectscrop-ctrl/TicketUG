import { NextRequest } from 'next/server'
import { ticketPdfResponse } from '@/lib/ticket-pdf-proxy'

const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:4000'

export async function GET(request: NextRequest, context: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await context.params
  const response = await fetch(`${apiOrigin}/api/v1/tickets/${publicId}/pdf`, { headers: { cookie: request.headers.get('cookie') ?? '' } })
  return ticketPdfResponse(response, await response.arrayBuffer())
}
