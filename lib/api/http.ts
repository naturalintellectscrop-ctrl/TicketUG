import { NextResponse } from 'next/server'
import { logServerError } from '@/lib/server/errors'

/**
 * HTTP plumbing for the TicketUG Developer API (/api/v1).
 *
 * The developer API has its own response envelope — distinct from the
 * internal app routes' `{message, error, statusCode}` shape:
 *   success: { data: ..., pagination?: { total, limit, offset } }
 *   error:   { error: { code, message } }
 * The envelope is part of the v1 contract documented on /developers.
 */

export class V1Error extends Error {
  readonly status: number
  readonly code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'V1Error'
    this.status = status
    this.code = code
  }
}

export const v1BadRequest = (code: string, message: string) => new V1Error(400, code, message)
export const v1Unauthorized = (code: string, message: string) => new V1Error(401, code, message)
export const v1NotFound = () => new V1Error(404, 'NOT_FOUND', 'No matching resource within your organizer scope.')
export const v1RateLimited = (retryAfterSec: number) =>
  new V1Error(429, 'RATE_LIMITED', `Rate limit exceeded. Retry after ${retryAfterSec} second${retryAfterSec === 1 ? '' : 's'}.`)
export const v1Unavailable = (code: string, message: string) => new V1Error(503, code, message)

export type V1Pagination = { total: number; limit: number; offset: number }

export function v1Ok(data: unknown, pagination?: V1Pagination, headers?: Record<string, string>): Response {
  const body = pagination ? { data, pagination } : { data }
  return NextResponse.json(body, { status: 200, headers })
}

export function v1ErrorResponse(error: unknown, headers?: Record<string, string>): Response {
  if (error instanceof V1Error) {
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status, headers })
  }
  // Postgres "relation does not exist" — migration 016 (or the whole developer
  // API registry) has not been provisioned on this deployment yet. Honest 503,
  // never a fabricated empty success.
  const code = (error as { code?: string })?.code
  if (code === '42P01') {
    return NextResponse.json(
      { error: { code: 'API_NOT_PROVISIONED', message: 'The developer API registry is not provisioned on this deployment yet. The operator must apply migration 016.' } },
      { status: 503, headers },
    )
  }
  if (code === '22P02' || code === '22023') {
    return NextResponse.json({ error: { code: 'INVALID_REQUEST', message: 'Invalid request.' } }, { status: 400, headers })
  }
  // Server-side ops breadcrumb only — never log request details or payloads.
  logServerError('api:v1', error)
  // Never leak internals to external callers.
  return NextResponse.json({ error: { code: 'INTERNAL', message: 'Internal server error.' } }, { status: 500, headers })
}

export type V1PaginationInput = { limit: number; offset: number }

/** Parses `limit`/`offset` search params. Absent params get the defaults;
 * present-but-invalid values are a 400 — silently "fixing" them would hide
 * client bugs. */
export function parseV1Pagination(params: URLSearchParams): V1PaginationInput {
  const rawLimit = params.get('limit')
  const rawOffset = params.get('offset')
  let limit = 25
  if (rawLimit !== null) {
    if (!/^\d+$/.test(rawLimit)) throw v1BadRequest('INVALID_PAGINATION', 'limit must be a non-negative integer.')
    limit = Number(rawLimit)
    if (limit < 1 || limit > 100) throw v1BadRequest('INVALID_PAGINATION', 'limit must be between 1 and 100.')
  }
  let offset = 0
  if (rawOffset !== null) {
    if (!/^\d+$/.test(rawOffset)) throw v1BadRequest('INVALID_PAGINATION', 'offset must be a non-negative integer.')
    offset = Number(rawOffset)
    if (offset > 1_000_000) throw v1BadRequest('INVALID_PAGINATION', 'offset is too large.')
  }
  return { limit, offset }
}
