# TicketUG Phase 4

The canonical backend boundary is now a NestJS service at `apps/api`. Next.js Phase 2/3 routes remain compatibility paths while new backend work belongs in the versioned Nest API.

## Identity boundary

The API reads the existing Neon Auth session cookie and calls the installed `@neondatabase/auth` server API. It never accepts user IDs, roles, or organizer membership claims from request bodies. The resolved Neon Auth user ID is mapped to `ticketug.user_profile.auth_user_id`, then active memberships and platform roles are loaded from TicketUG tables.

Neon Auth owns credentials, password hashing, sessions, expiry, and revocation. TicketUG owns profiles, attendees, organizers, memberships, roles, authorization, and security events.

## Implemented API

- `GET /api/v1/health`
- `GET /api/v1/readiness`
- `GET /api/v1/users/me`
- `PATCH /api/v1/users/me`
- `GET /api/v1/organizers`
- `POST /api/v1/organizers`
- `GET /api/v1/organizers/:organizerId/members`
- Swagger: `/api/v1/docs`

All other domain modules are structural boundaries only.

## Security and testing

Validation is whitelist-based, CORS is explicit, Helmet is enabled, and the global guard fails closed for missing cookies, unknown identities, and missing TicketUG profiles. Database tests must use an isolated database URL; the connected development database is never reset by tests. Production distributed rate limiting and a full integration suite remain required before launch.
