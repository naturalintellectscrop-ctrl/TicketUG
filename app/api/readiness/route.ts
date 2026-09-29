import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Real database connectivity (upgraded in Pair 6 to match the removed API's
// readiness semantics: a genuine SELECT 1, not merely configuration presence).
export async function GET() {
  try {
    await pool.query('SELECT 1')
    return NextResponse.json({ status: 'ready', database: 'ok' })
  } catch {
    return NextResponse.json({ status: 'not_ready', database: 'unavailable' }, { status: 503 })
  }
}
