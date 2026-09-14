import { NextRequest, NextResponse } from 'next/server'

const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:4000'

export async function POST(request: NextRequest, context: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await context.params
  const response = await fetch(`${apiOrigin}/api/v1/public/orders/${publicId}/payment/test-complete`, {
    method: 'POST',
    headers: { 'x-order-access-token': request.headers.get('x-order-access-token') ?? '' },
  })
  return new NextResponse(await response.text(), { status: response.status, headers: { 'content-type': 'application/json' } })
}
