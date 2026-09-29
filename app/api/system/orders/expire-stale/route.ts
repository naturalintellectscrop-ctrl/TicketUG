import { NextRequest } from 'next/server'
import { apiErrorResponse } from '@/lib/server/errors'
import { expireStaleOrders } from '@/lib/server/orders'

// Operator/cron sweep (Pair 6, Supabase-native). Authenticates with the shared
// operator secret exactly like the removed NestJS surface — fail-closed when
// CRON_SECRET is unset so the surface can never be silently unauthenticated.
// The sweep uses FOR UPDATE SKIP LOCKED in ticketug.expire_stale_orders.
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('x-cron-secret') !== secret) {
    return Response.json({ message: 'System endpoint authentication required' }, { status: 401 })
  }
  try {
    const body = (await request.json().catch(() => ({}))) as { limit?: number }
    return Response.json(await expireStaleOrders(body?.limit))
  } catch (error) {
    return apiErrorResponse(error)
  }
}
