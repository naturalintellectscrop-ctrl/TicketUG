# ADR 0004: NestJS API identity boundary

> **SUPERSEDED (Pair 6):** the standalone NestJS API was removed; its
> authorization boundary moved into the Next.js server layer + PostgreSQL
> functions (see ADR 0005, docs/SUPABASE_NATIVE_ARCHITECTURE.md). Retained as
> history.

## Decision

NestJS validates the existing Neon Auth session cookie through `@neondatabase/auth` and maps the resulting Neon user ID to `ticketug.user_profile.auth_user_id`. The guard attaches only server-derived TicketUG identity, roles, and active organizer memberships to the request.

## Ownership

Neon Auth owns credentials, password hashing, authentication, sessions, expiry, and revocation. TicketUG owns application profiles, attendee profiles, organizers, memberships, platform roles, authorization, security events, and future business resources.

## Rationale

This preserves one authentication system and one database model. Client request bodies cannot choose identity, role, or organizer scope. Authorization remains database-backed and deny-by-default.

## Compatibility

Existing Next.js routes remain temporarily available for Phase 2/3 compatibility. New domain behavior must be implemented behind `apps/api`; compatibility routes should become thin clients or be retired after API parity and integration tests are complete.

## Limitation

The standalone API currently reuses the Neon Auth server package and the same cookie contract; production deployment must verify cross-origin cookie forwarding and configure a trusted web origin. No second token or session scheme is introduced.
