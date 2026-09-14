import type { IncomingHttpHeaders } from 'node:http'
import { getTicketUGContext, type TicketUGContext } from './request-context'

export type ApiAuthRequest = { headers: IncomingHttpHeaders | Headers }

export type ApiAuthContext = TicketUGContext

export async function authenticateApiRequest(_request: ApiAuthRequest): Promise<ApiAuthContext> {
  const context = await getTicketUGContext()
  if (!context) throw new Error('UNAUTHENTICATED')
  return context
}

export function requireApiRole(context: ApiAuthContext, roles: ApiAuthContext['roles']) {
  if (!roles.some((role) => context.roles.includes(role))) throw new Error('FORBIDDEN')
  return context
}
