import { NextRequest } from 'next/server'
import { requireTicketUGContext } from '@/lib/request-context'
import { apiErrorResponse } from '@/lib/server/errors'
import { getTicketPdfForProfile } from '@/lib/server/tickets'

// Owner PDF ticket (Pair 6, Supabase-native). Generated on demand from the
// server-loaded row; no-store so one user's ticket is never cached for another.
export async function GET(_request: NextRequest, context: { params: Promise<{ publicId: string }> }) {
  try {
    const auth = await requireTicketUGContext()
    const { publicId } = await context.params
    const { buffer, filename } = await getTicketPdfForProfile(auth.profileId, publicId)
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="${filename}"`,
        'cache-control': 'no-store',
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return Response.json({ message: 'Authentication required' }, { status: 401 })
    return apiErrorResponse(error)
  }
}
