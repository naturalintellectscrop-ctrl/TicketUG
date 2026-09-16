# Phase 3 identity workflows

## Scope

Phase 3 establishes profile completion, attendee delivery contact fields, organizer onboarding, organizer membership administration, invitation lifecycle foundations, and the API authentication contract. Event, ticket, checkout, payment, scanner, settlement, refund, analytics, and full admin functionality remain deferred.

## Identity boundary

Neon Auth owns credentials, password hashing, authentication, sessions, expiration, and revocation. TicketUG owns `user_profile`, `attendee_profile`, organizers, memberships, platform roles, security events, and authorization. `auth_user_id` is the immutable mapping key; no client-supplied user or role value is trusted.

## Invitations

Invitation tokens are generated as high-entropy values and persisted only as SHA-256 hashes. Invitations are bound to an organizer, target email, role, inviter, seven-day expiry, and lifecycle status. Acceptance requires an authenticated user and atomically creates or reactivates the bound membership, then consumes the invitation.

Production email delivery is intentionally deferred. The returned token is a development/workflow primitive and must be delivered through a future transactional email provider, never logged.

## Rate limiting

Sensitive auth routes use an in-process limiter for development. Production must replace this with a distributed provider before public launch; the current limiter is not sufficient across multiple instances.

## NestJS API boundary

No NestJS service exists yet. `lib/api-auth.ts` defines the framework-neutral contract: resolve the existing Neon Auth session, map it to TicketUG context, and fail closed for unauthenticated or unauthorized requests. A future Nest guard should attach this context to the request without creating a second session system.
