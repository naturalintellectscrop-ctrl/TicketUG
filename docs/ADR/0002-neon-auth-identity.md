# ADR 0002: Neon Auth identity boundary

## Decision
Neon Auth remains TicketUG's sole credential and session authority. TicketUG maps the immutable Neon Auth user identifier to `ticketug.user_profile.auth_user_id`; it never copies passwords or mutates `neon_auth` tables.

## Boundaries
Neon Auth owns email/password authentication, password hashing, sessions, expiration, revocation, and auth HTTP handlers. TicketUG owns application profiles, attendee profiles, organizer memberships, platform roles, resource authorization, and security events. Next.js reads the validated Neon Auth session through `@neondatabase/auth/next/server`; future API services must validate the same Neon Auth session/token rather than trust a frontend-supplied user ID.

## Roles
`ATTENDEE` is the default application capability. Organizer roles are explicit active memberships. Platform roles are separate records. A user may have multiple organizer memberships; organization context is required whenever a resource is organization-scoped.

## Guest purchases
Future orders may have either a nullable `user_profile_id` or a guest contact/claim reference. Claiming must require a short-lived, single-use verification challenge sent to the verified transaction contact, plus matching transaction evidence; order ID alone is insufficient.

## Consequences
Existing `neon_auth` schemas are not renamed, deleted, or migrated. TicketUG migrations are isolated under the `ticketug` schema. A NestJS API adapter must be added before API extraction; until then, the protected Next.js route demonstrates the server-side boundary.
