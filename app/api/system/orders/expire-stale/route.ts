import { NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { apiErrorResponse, logServerError } from '@/lib/server/errors'
import { expireStaleOrders } from '@/lib/server/orders'

// Operator/cron sweep (Pair 6, Supabase-native). The sweep uses FOR UPDATE SKIP
// LOCKED in ticketug.expire_stale_orders and is idempotent (a second call for
// already-expired orders is a no-op — verified in the SQL harness), so repeated
// scheduled execution is safe.
//
// Authentication is fail-closed: when CRON_SECRET is unset the endpoint 401s
// unconditionally, so it can never be silently unauthenticated. Two header
// forms are accepted, both compared to the same secret (constant-time):
//   * x-cron-secret: <CRON_SECRET>          — operator/external schedulers
//   * Authorization: Bearer <CRON_SECRET>   — Vercel Cron (its automatic form
//     when the CRON_SECRET environment variable is configured)
function secretMatches(secret: string, presented: string | null): boolean {
  if (!presented) return false
  const a = Buffer.from(secret, 'utf8')
  const b = Buffer.from(presented, 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}

async function runSweep(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const header = request.headers.get('x-cron-secret')
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null
  if (!secret || !(secretMatches(secret, header) || secretMatches(secret, bearer))) {
    return Response.json({ message: 'System endpoint authentication required' }, { status: 401 })
  }
  try {
    const body = (await request.json().catch(() => ({}))) as { limit?: number }
    return Response.json(await expireStaleOrders(body?.limit))
  } catch (error) {
    logServerError('cron:expire-stale', error)
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
