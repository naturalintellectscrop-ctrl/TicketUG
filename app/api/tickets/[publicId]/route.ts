import { NextRequest, NextResponse } from 'next/server'
const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:4000'
export async function GET(request: NextRequest, context: { params: Promise<{ publicId: string }> }) { const { publicId } = await context.params; const response = await fetch(`${apiOrigin}/api/v1/tickets/${publicId}`, { headers: { cookie: request.headers.get('cookie') ?? '' } }); return new NextResponse(await response.text(), { status: response.status, headers: { 'content-type': 'application/json' } }) }
