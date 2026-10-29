import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Real database connectivity (upgraded in Pair 6 to match the removed API's
// readiness semantics: a genuine SELECT 1, not merely configuration presence).
// The `commit` field is deployment verification without dashboard access:
// Vercel injects VERCEL_GIT_COMMIT_SHA into every runtime, so
// `curl /api/readiness` answers "which commit is production serving?"
// definitively. Locally (and in any non-Vercel runtime) it reports 'local'.
export async function GET() {
  try {
    await pool.query('SELECT 1')
    return NextResponse.json({
      status: 'ready',
      database: 'ok',
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? 'local',
    })
  } catch {
    return NextResponse.json({ status: 'not_ready', database: 'unavailable' }, { status: 503 })
  }
}
