import { NextRequest, NextResponse } from 'next/server'

const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:4000'

async function forward(request: NextRequest, context: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await context.params
  const token = request.headers.get('x-order-access-token') ?? ''
  const init: RequestInit = { method: request.method, headers: { 'content-type': 'application/json', 'x-order-access-token': token } }
  if (request.method !== 'GET') init.body = await request.text()
  const response = await fetch(`${apiOrigin}/api/v1/public/orders/${publicId}/payment`, init)
  return new NextResponse(await response.text(), { status: response.status, headers: { 'content-type': 'application/json' } })
}

export async function GET(request: NextRequest, context: { params: Promise<{ publicId: string }> }) { return forward(request, context) }
export async function POST(request: NextRequest, context: { params: Promise<{ publicId: string }> }) { return forward(request, context) }
