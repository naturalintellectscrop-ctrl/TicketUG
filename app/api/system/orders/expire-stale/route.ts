import { NextRequest } from 'next/server'
import { apiErrorResponse } from '@/lib/server/errors'
import { expireStaleOrders } from '@/lib/server/orders'

// Operator/cron sweep (Pair 6, Supabase-native). The sweep uses FOR UPDATE SKIP
// LOCKED in ticketug.expire_stale_orders and is idempotent (a second call for
// already-expired orders is a no-op — verified in the SQL harness), so repeated
// scheduled execution is safe.
//
// Authentication is fail-closed: when CRON_SECRET is unset the endpoint 401s
// unconditionally, so it can never be silently unauthenticated. Two header
// forms are accepted, both compared to the same secret:
//   * x-cron-secret: <CRON_SECRET>          — operator/external schedulers
//   * Authorization: Bearer <CRON_SECRET>   — Vercel Cron (its automatic form
//     when the CRON_SECRET environment variable is configured)
async function runSweep(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const header = request.headers.get('x-cron-secret')
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null
  if (!secret || (header !== secret && bearer !== secret)) {
    return Response.json({ message: 'System endpoint authentication required' }, { status: 401 })
  }
  try {
    const body = (await request.json().catch(() => ({}))) as { limit?: number }
    return Response.json(await expireStaleOrders(body?.limit))
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  return runSweep(request)
}

// Vercel Cron dispatches GET requests (vercel.json → /api/system/orders/
// expire-stale). Same auth, same sweep, no separate expiry system.
export async function GET(request: NextRequest) {
  return runSweep(request)
}
