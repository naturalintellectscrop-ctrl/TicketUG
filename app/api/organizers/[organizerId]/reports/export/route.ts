import { NextRequest, NextResponse } from 'next/server'
import { requireTicketUGContext } from '@/lib/request-context'
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit'
import { pool } from '@/lib/db'
import { isApiAuthError, apiErrorResponse, logServerError } from '@/lib/server/errors'
import { csvFileName, toCsv } from '@/lib/csv'
import { loadOrdersByState, loadSalesByEvent } from '@/lib/organizer-reports'
import { labelOf, LIFECYCLE_LABELS, ORDER_PAYMENT_STATE_LABELS } from '@/lib/platform/format'

export const dynamic = 'force-dynamic'

// Exports must respect the same tenant + permission boundaries as the pages
// they mirror (spec §5.9): session → owner/manager of THIS workspace → the
// loaders' own membership-scoped SQL → hard row cap.
const ROW_CAP = 5000
const REPORT_TYPES = ['sales-by-event', 'orders-by-state'] as const
type ReportType = (typeof REPORT_TYPES)[number]

function isReportType(value: string | null): value is ReportType {
  return !!value && (REPORT_TYPES as readonly string[]).includes(value)
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ organizerId: string }> }) {
  const limited = checkRateLimit(rateLimitKey(request, 'report-export'), 10)
  if (!limited.allowed) return NextResponse.json({ error: 'Too many exports. Please wait a minute and try again.' }, { status: 429, headers: { 'retry-after': String(Math.ceil((limited.retryAfterMs ?? 60_000) / 1000)) } })

  try {
    const auth = await requireTicketUGContext()
    const { organizerId } = await params
    const type = new URL(request.url).searchParams.get('type')
    if (!isReportType(type)) return NextResponse.json({ error: 'Unknown report type' }, { status: 400 })

    // Owner/manager gate — one scoped query, fail closed.
    const manager = await pool.query(
      `SELECT 1 FROM ticketug.organizer_member
        WHERE organizer_id = $1 AND user_profile_id = $2 AND status = 'ACTIVE'
          AND role IN ('ORGANIZER_OWNER', 'ORGANIZER_MANAGER')`,
      [organizerId, auth.profileId],
    )
    if (!manager.rows[0]) return NextResponse.json({ error: 'Organizer access denied' }, { status: 403 })

    let headers: string[]
    let rows: Array<Array<string | number | null>>
    let truncated = false

    if (type === 'sales-by-event') {
      // ROW_CAP + 1 probes for overflow: more rows than the cap exist → the
      // export says so instead of silently pretending it is complete.
      const sales = await loadSalesByEvent(organizerId, auth.profileId, ROW_CAP + 1)
      if (!sales) return NextResponse.json({ error: 'Report data could not be loaded' }, { status: 503 })
      headers = ['Event', 'Lifecycle', 'Starts (local)', 'Paid orders', 'Gross paid value (UGX, pre-fee)', 'Tickets issued', 'Checked in', 'Capacity', 'Remaining']
      rows = sales.map((row) => [
        row.title,
        labelOf(LIFECYCLE_LABELS, row.lifecycle_state),
        row.starts_at,
        row.paidOrders,
        Number(row.grossPaidMinor),
        row.ticketsIssued,
        row.checkedIn,
        Number(row.capacity),
        Number(row.remaining),
      ])
    } else {
      const states = await loadOrdersByState(organizerId, auth.profileId)
      if (!states) return NextResponse.json({ error: 'Report data could not be loaded' }, { status: 503 })
      headers = ['Payment state', 'Orders', 'Order value (UGX)']
      rows = states.map((entry) => [labelOf(ORDER_PAYMENT_STATE_LABELS, entry.state), entry.count, entry.totalMinorUnits])
    }

    if (rows.length > ROW_CAP) {
      truncated = true
      rows = rows.slice(0, ROW_CAP)
      logServerError('report:export-truncated', new Error(`${type} exceeded ${ROW_CAP} rows for organizer ${organizerId}`))
    }

    const csv = toCsv(headers, rows)
    const responseHeaders: Record<string, string> = {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${csvFileName(type)}"`,
      'cache-control': 'no-store',
    }
    if (truncated) responseHeaders['x-report-truncated'] = `1;rows=${ROW_CAP}`
    return new NextResponse(csv, { status: 200, headers: responseHeaders })
  } catch (error) {
    if (isApiAuthError(error)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return apiErrorResponse(error)
  }
}
