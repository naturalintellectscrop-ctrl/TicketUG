import { NextRequest } from 'next/server'
import { apiErrorResponse } from '@/lib/server/errors'
import { getTicketForGuest } from '@/lib/server/tickets'

// Guest ticket detail with QR (Pair 6, Supabase-native). Token compared inside
// the SQL read; the QR is built from the server-held credential.
export async function GET(request: NextRequest, context: { params: Promise<{ publicId: string; ticketPublicId: string }> }) {
  try {
    const { publicId, ticketPublicId } = await context.params
    const token = request.headers.get('x-order-access-token') ?? ''
    return Response.json(await getTicketForGuest(publicId, ticketPublicId, token))
  } catch (error) {
    return apiErrorResponse(error)
  }
}
