import { NextRequest } from 'next/server'
import { apiErrorResponse } from '@/lib/server/errors'
import { getTicketPdfForGuest } from '@/lib/server/tickets'

// Guest PDF ticket (Pair 6, Supabase-native). no-store + forced content-type;
// the filename is sanitized by ticketPdfFilename server-side.
export async function GET(request: NextRequest, context: { params: Promise<{ publicId: string; ticketPublicId: string }> }) {
  try {
    const { publicId, ticketPublicId } = await context.params
    const token = request.headers.get('x-order-access-token') ?? ''
    const { buffer, filename } = await getTicketPdfForGuest(publicId, ticketPublicId, token)
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="${filename}"`,
        'cache-control': 'no-store',
      },
    })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
