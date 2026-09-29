# ADR 0005: Supabase Auth identity boundary

> Pair 5 (2026-09-29). Supersedes ADR 0002 (Neon Auth) — which remains in the
> repository as a historical record, clearly marked.

## Decision

Supabase Auth is TicketUG's sole credential and session authority after the
Neon → Supabase infrastructure migration. TicketUG maps the immutable Supabase
Auth user UUID to `ticketug.user_profile.auth_user_id`; it never copies
passwords, mutates Supabase `auth` schema tables, or holds Supabase secrets
(no JWT secret, no service-role key is needed by any tier).

## Boundaries

- **Supabase Auth owns** email/password authentication, password hashing,
  token lifecycle (short-lived ES256 access tokens + refresh tokens), email
  verification where configured, and the auth HTTP surface.
- **TicketUG owns** application profiles, attendee profiles, organizer
  memberships, platform roles, resource authorization, tenant isolation,
  staff assignments, and security events — enforced server-side in the NestJS
  API and Next.js server code. Supabase RLS is deliberately NOT enabled on
  `ticketug.*` (the database is reachable only through the app's pooled
  connections; Supabase's auto-REST Data API does not expose the `ticketug`
  schema).

## Wire model

- **Frontend (Next.js):** server-side only via `@supabase/ssr`; sign-in /
  sign-up / sign-out route handlers (`app/api/auth/*`); the session lives in
  HttpOnly, Secure, SameSite=Lax cookies (`sb-<ref>-auth-token[.N]`). No
  browser Supabase client, no `NEXT_PUBLIC_*` variables.
- **API (NestJS):** local JWT verification via the project's public JWKS
  (`jose`): signature + `exp` + `iss` (project-pinned) + `aud=authenticated`.
  Bearer-first (fresh token forwarded by `lib/api-forward.ts`), Supabase-cookie
  fallback.
- **Mapping:** Supabase user UUID → `user_profile.auth_user_id` (text, UNIQUE),
  created idempotently at first session (`lib/user-profile.ts`).

## Consequences

- Access tokens are stateless short-lived JWTs: after sign-out the refresh
  token is revoked and cookies are cleared, but an already-issued access token
  remains technically valid until expiry (≤1 h default). Operators can tighten
  revocation via the Supabase dashboard (shorter access-token TTL). This is a
  documented, deliberate difference from the previous Better Auth
  session-server model.
- Email-confirmation behavior follows the project's Supabase Auth settings;
  the sign-up response surfaces "confirmation required" instead of a session.
- Existing Neon-era users cannot be migrated automatically (the Supabase
  project starts with an empty `auth.users`; the Neon Auth data was never
  accessible to this environment). Users re-register; controlled recovery is
  an operator decision (Pair 5 §13 note).

## Roles (unchanged)

`ATTENDEE` is the default application capability. Organizer roles are explicit
active memberships. Platform roles are separate records. A user may have
multiple organizer memberships; organization context is required whenever a
resource is organization-scoped.

## Guest purchases (unchanged)

Orders may have a nullable `user_profile_id` with a guest contact/claim
reference. Claiming requires the short-lived, single-use order access token
plus matching transaction evidence; order ID alone is insufficient.
