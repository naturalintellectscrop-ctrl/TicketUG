import { NextRequest } from 'next/server'
import { requireTicketUGContext } from '@/lib/request-context'
import { apiErrorResponse } from '@/lib/server/errors'
import { getTicketForProfile } from '@/lib/server/tickets'

// Authenticated ticket detail with QR (Pair 6, Supabase-native). Ownership in
// the same SQL statement; the QR is built from the server-held credential.
export async function GET(_request: NextRequest, context: { params: Promise<{ publicId: string }> }) {
  try {
    const auth = await requireTicketUGContext()
    const { publicId } = await context.params
    return Response.json(await getTicketForProfile(auth.profileId, publicId))
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return Response.json({ message: 'Authentication required' }, { status: 401 })
    return apiErrorResponse(error)
  }
}
