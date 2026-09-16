import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { neonAuth } from './neon-auth'
import { DatabaseService } from '../common/database.service'
import { ApiUser, API_USER } from './auth.types'

@Injectable()
export class NeonAuthGuard implements CanActivate {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; path?: string; [API_USER]?: ApiUser }>()
    if (request.path === '/api/v1/health' || request.path === '/api/v1/readiness' || request.path?.startsWith('/api/v1/docs') || request.path?.startsWith('/api/v1/public/events/') || request.path?.startsWith('/api/v1/public/orders/guest') || request.path?.startsWith('/api/v1/public/payments/webhooks/')) return true
    const cookie = request.headers.cookie
    if (!cookie) throw new UnauthorizedException('Authentication required')
    const session = await neonAuth.getSession({ fetchOptions: { headers: { cookie } } })
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
