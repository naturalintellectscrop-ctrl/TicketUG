// Server-layer error type + HTTP mapping.
//
// Replaces the removed NestJS exception layer. Two sources of errors exist in
// the Supabase-native backend:
//   1. lib/server code raising ApiError directly (validation, authz, provider);
//   2. PostgreSQL functions raising exceptions whose MESSAGES mirror the exact
//      strings the NestJS services produced (migration 012) — parity contract,
//      so responses keep the same bodies/statuses the UI already handles.
// Unknown errors never leak internals: the response is a generic 500.

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export const badRequest = (message: string) => new ApiError(400, message)
export const unauthorized = (message = 'Authentication required') => new ApiError(401, message)
export const forbidden = (message = 'Forbidden') => new ApiError(403, message)
export const notFound = (message = 'Not Found') => new ApiError(404, message)
export const conflict = (message: string) => new ApiError(409, message)
export const unprocessable = (message: string) => new ApiError(422, message)
export const serviceUnavailable = (message: string) => new ApiError(503, message)

// message → HTTP status for errors raised by the ticketug SQL functions
// (migration 012). The strings mirror the previous NestJS exceptions exactly.
const SQL_ERROR_STATUS: Array<[RegExp, number]> = [
  [/^Authentication required$/, 401],
  [/^Guest access token required$/, 401],
  [/^Ticket type not found$/, 404],
  [/^Event not found$/, 404],
  [/^Order not found$/, 404],
  [/^Ticket not found$/, 404],
  [/^Unknown provider transaction$/, 404],
  [/^PAYMENT_ATTEMPT_NOT_FOUND$/, 404],
  [/^At least one order item is required$/, 400],
  [/^Quantity must be a positive integer$/, 400],
  [/^Each ticket type may appear once per order$/, 400],
  [/^Order total exceeds supported range$/, 400],
  [/^Invalid order total$/, 400],
  [/^Guest email is required$/, 400],
  [/^Invalid event lifecycle transition$/, 409],
  [/^Unknown lifecycle state$/, 400],
  [/^Invalid unit price$/, 400],
  [/^Invalid quantity$/, 400],
  [/^Ticket sales have not started$/, 409],
  [/^Ticket sales have ended$/, 409],
  [/^Ticket type is inactive$/, 409],
  [/^Event is not accepting orders$/, 409],
  [/^Insufficient ticket inventory$/, 409],
  [/^Guest idempotency key was already used/, 409],
  [/^ORDER_STATE_TRANSITION_INVALID/, 409],
  [/^PAYMENT_STATE_TRANSITION_INVALID/, 409],
  [/^PAYMENT_ALREADY_SUCCEEDED$/, 409],
  [/^ORDER_EXPIRED$/, 409],
  [/^TICKETS_REQUIRE_VERIFIED_PAYMENT$/, 409],
  [/^Duplicate payment initiation$/, 409],
  [/^INVALID_PAYMENT_AMOUNT$/, 422],
  [/^INVALID_PAYMENT_CURRENCY$/, 422],
  [/^INVALID_PAYMENT_ORDER$/, 422],
  [/^RAW_WEBHOOK_BODY_REQUIRED$/, 422],
  [/^INVALID_WEBHOOK_SIGNATURE$/, 400],
  [/^Malformed webhook$/, 400],
  [/^PROVIDER_NOT_CONFIGURED$/, 503],
  [/^TEST_PAYMENT_DISABLED$/, 503],
  [/^Organizer access denied$/, 403],
  [/^Scanner is not authorized for this event$/, 403],
  [/^Scanner is not assigned to this event$/, 403],
  [/^Venue does not belong to organizer$/, 400],
  [/^Event end must be after start$/, 400],
]

export function apiErrorFromUnknown(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  const message = error instanceof Error ? error.message : String(error)
  for (const [pattern, status] of SQL_ERROR_STATUS) {
    if (pattern.test(message)) return new ApiError(status, message)
  }
  // Postgres invalid-input casts (e.g. '3.5'::int) surface as 22P02.
  const code = (error as { code?: string })?.code
  if (code === '22P02' || code === '22023') return new ApiError(400, 'Invalid request')
  if (code === '23505') return new ApiError(409, 'Duplicate request')
  return new ApiError(500, 'Internal server error')
}

// NestJS-compatible body shape: the UI reads `message` (and some legacy
// clients read `error`/`statusCode`) — keep all three keys with the exact
// reason phrases the previous API emitted.
const REASON: Record<number, string> = {
  400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found',
  409: 'Conflict', 422: 'Unprocessable Entity', 429: 'Too Many Requests',
  500: 'Internal Server Error', 503: 'Service Unavailable',
}

export function apiErrorResponse(error: unknown): Response {
  const apiError = apiErrorFromUnknown(error)
  return Response.json(
    { message: apiError.message, error: REASON[apiError.status] ?? 'Error', statusCode: apiError.status },
    { status: apiError.status },
  )
}
