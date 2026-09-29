import { Injectable, CanActivate, ExecutionContext, Inject, UnauthorizedException } from '@nestjs/common'
import type { Request } from 'express'
import { createSupabaseTokenVerifier, extractRequestAccessToken, supabaseStorageKey, type SupabaseTokenVerifier } from './supabase-auth.js'
import { DatabaseService } from '../common/database.service.js'
import { ApiUser, API_USER } from './auth.types.js'

// Boot-time fail-closed (mirrors the previous Better Auth secret floor):
// a production API without a valid SUPABASE_URL refuses to start, so a
// deployment can never come up silently unable to authenticate anyone.
function resolveSupabaseUrl(): string {
  const url = process.env.SUPABASE_URL?.trim()
  if (url && /^https?:\/\//i.test(url)) return url.replace(/\/+$/, '')
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SUPABASE_URL must be set in production')
  }
  return ''
}

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private readonly verifier: SupabaseTokenVerifier | null
  private readonly storageKey: string

  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {
    const supabaseUrl = resolveSupabaseUrl()
    this.verifier = supabaseUrl ? createSupabaseTokenVerifier(supabaseUrl) : null
    this.storageKey = supabaseUrl ? supabaseStorageKey(supabaseUrl) : 'sb-unconfigured-auth-token'
  }

  async canActivate(context: ExecutionContext) {
    const http = context.switchToHttp()
    const request = http.getRequest<Request & { path?: string; [API_USER]?: ApiUser }>()
    // All /public/orders/* endpoints self-authenticate with the order's guest access
    // token (sha256-compared in the services), so they intentionally bypass session auth.
    if (request.path === '/api/v1/health' || request.path === '/api/v1/readiness' || request.path?.startsWith('/api/v1/docs') || request.path?.startsWith('/api/v1/public/events/') || request.path?.startsWith('/api/v1/public/orders/') || request.path?.startsWith('/api/v1/public/payments/webhooks/')) return true
    // System maintenance endpoints (order expiry sweeper) authenticate with a
    // shared operator secret instead of a user session. Fail closed when
    // CRON_SECRET is unset so the surface can never be silently unauthenticated.
    if (request.path?.startsWith('/api/v1/system/')) {
      const secret = process.env.CRON_SECRET
      if (!secret || request.headers['x-cron-secret'] !== secret) throw new UnauthorizedException('System endpoint authentication required')
      return true
    }
    if (!this.verifier) throw new UnauthorizedException('Authentication is not configured')
    const token = extractRequestAccessToken(request.headers, this.storageKey)
    if (!token) throw new UnauthorizedException('Authentication required')
    // Local JWKS verification (signature + expiry + issuer + audience). Any
    // forged, expired, cross-project or anonymous token fails closed here.
    const claims = await this.verifier(token)
    if (!claims?.sub) throw new UnauthorizedException('Authentication required')
    const authUserId = claims.sub
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
