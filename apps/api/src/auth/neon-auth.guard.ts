import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import type { Request, Response } from 'express'
import { neonAuth, neonAuthScope } from './neon-auth.js'
import { DatabaseService } from '../common/database.service.js'
import { ApiUser, API_USER } from './auth.types.js'

type Headers = Request['headers']

function firstHeader(headers: Headers, name: string): string | null {
  const value = headers[name.toLowerCase()]
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function resolveOrigin(headers: Headers): string {
  const origin = firstHeader(headers, 'origin')
  if (origin) return origin
  const referer = firstHeader(headers, 'referer')
  if (referer) {
    try {
      return new URL(referer).origin
    } catch {
      return ''
    }
  }
  return ''
}

@Injectable()
export class NeonAuthGuard implements CanActivate {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  async canActivate(context: ExecutionContext) {
    const http = context.switchToHttp()
    const request = http.getRequest<Request & { path?: string; [API_USER]?: ApiUser }>()
    const response = http.getResponse<Response>()
    // All /public/orders/* endpoints self-authenticate with the order's guest access
    // token (sha256-compared in the services), so they intentionally bypass cookie auth.
    if (request.path === '/api/v1/health' || request.path === '/api/v1/readiness' || request.path?.startsWith('/api/v1/docs') || request.path?.startsWith('/api/v1/public/events/') || request.path?.startsWith('/api/v1/public/orders/') || request.path?.startsWith('/api/v1/public/payments/webhooks/')) return true
    // System maintenance endpoints (order expiry sweeper) authenticate with a
    // shared operator secret instead of a user session. Fail closed when
    // CRON_SECRET is unset so the surface can never be silently unauthenticated.
    if (request.path?.startsWith('/api/v1/system/')) {
      const secret = process.env.CRON_SECRET
      if (!secret || request.headers['x-cron-secret'] !== secret) throw new UnauthorizedException('System endpoint authentication required')
      return true
    }
    const cookie = request.headers.cookie
    if (!cookie) throw new UnauthorizedException('Authentication required')
    // Run the SDK call inside the per-request AsyncLocalStorage scope so the
    // framework-agnostic Neon Auth context can read this request's cookies and
    // surface any refreshed session cookies on the response. (The SDK ignores
    // per-call fetchOptions for cookies — its context is the only cookie source.)
    const scope = { cookieHeader: cookie, origin: resolveOrigin(request.headers), getHeader: (name: string) => firstHeader(request.headers, name), responseCookies: [] }
    const session = await neonAuthScope.run(scope, () => neonAuth.getSession({}))
    for (const setCookie of scope.responseCookies) response.append('Set-Cookie', setCookie)
    const authUserId = session?.data?.user?.id
    if (!authUserId) throw new UnauthorizedException('Authentication required')
    const profile = await this.db.query<{ id: string }>('SELECT id FROM ticketug.user_profile WHERE auth_user_id = $1 LIMIT 1', [authUserId])
    if (!profile.rows[0]) throw new UnauthorizedException('TicketUG profile required')
    const [memberships, roles] = await Promise.all([
      this.db.query<{ organizer_id: string; role: ApiUser['roles'][number]; status: string }>('SELECT organizer_id, role, status FROM ticketug.organizer_member WHERE user_profile_id = $1 AND status = $2', [profile.rows[0].id, 'ACTIVE']),
      this.db.query<{ role: ApiUser['roles'][number] }>('SELECT role FROM ticketug.platform_role WHERE user_profile_id = $1', [profile.rows[0].id]),
    ])
    const user: ApiUser = { authUserId, profileId: profile.rows[0].id, roles: Array.from(new Set(['ATTENDEE', ...memberships.rows.map((row) => row.role), ...roles.rows.map((row) => row.role)])), organizerMemberships: memberships.rows.map((row) => ({ organizerId: row.organizer_id, role: row.role, status: row.status })) }
    request[API_USER] = user
    return true
  }
}
