import { NextRequest } from 'next/server'
import { ticketPdfResponse } from '@/lib/ticket-pdf-proxy'

const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:4000'

export async function GET(request: NextRequest, context: { params: Promise<{ publicId: string; ticketPublicId: string }> }) {
  const { publicId, ticketPublicId } = await context.params
  const response = await fetch(`${apiOrigin}/api/v1/public/orders/${publicId}/tickets/${ticketPublicId}/pdf`, { headers: { 'x-order-access-token': request.headers.get('x-order-access-token') ?? '' } })
  return ticketPdfResponse(response, await response.arrayBuffer())
}
