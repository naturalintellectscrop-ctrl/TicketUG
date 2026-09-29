# API authentication boundary

TicketUG uses **Supabase Auth** as the sole credential and session authority
(Pair 5; the pre-Pair-5 Neon Auth layout is historical — see
TICKETUG_CHANGELOG.md). The API boundary verifies Supabase access tokens
locally against the project's public JWKS, then maps the validated Supabase
user UUID to `ticketug.user_profile`, active organizer memberships, and
platform roles. No shared secret, JWT secret, or service-role key is needed by
either tier.

The API must never trust `userId`, `role`, `organizerId`, or membership values
from request bodies. Controllers receive an `ApiAuthContext` produced by the
`SupabaseAuthGuard`; authorization predicates then enforce resource scope.

## Token verification (apps/api)

`apps/api/src/auth/supabase-auth.ts` + `supabase-auth.guard.ts`:

1. Extract the access token — `Authorization: Bearer <token>` first (fresh,
   refresh-aware token forwarded by the Next proxy layer), then the Supabase
   session cookie (`sb-<ref>-auth-token[.N]`, `base64-`-encoded JSON session,
   `@supabase/ssr` chunking contract) for direct browser calls.
2. Verify locally with `jose` against `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`
   (ES256/RS256/PS256/EdDSA only — symmetric tokens are never accepted),
   checking signature, `exp`, `iss === ${SUPABASE_URL}/auth/v1`, and
   `aud === 'authenticated'` (anonymous tokens rejected).
3. Map `sub` (Supabase Auth user UUID) → `ticketug.user_profile.auth_user_id`
   → memberships + platform roles → `ApiUser`.

Unauthenticated requests fail closed with 401; authenticated users without the
requested role fail with FORBIDDEN. A production API without `SUPABASE_URL`
refuses to boot.

## Frontend session flow

`lib/supabase/server.ts` (server-side only; `@supabase/ssr`) + `app/api/auth/*`:

- `POST /api/auth/sign-up` — Supabase `signUp`; seeds the TicketUG profile
  (`lib/user-profile.ts`, idempotent `auth_user_id` mapping). When the project
  enforces email confirmation the response says so instead of issuing a session.
- `POST /api/auth/sign-in` — `signInWithPassword`; vague failure (never reveals
  account existence); profile ensured.
- `POST /api/auth/sign-out` — revokes the refresh token and clears the
  HttpOnly cookies.
- Sessions live in HttpOnly, Secure, SameSite=Lax cookies; the browser never
  sees tokens. 10/min per-IP rate limits on sign-in/sign-up (as before).
- Proxied API calls attach a fresh Bearer token (`lib/api-forward.ts`,
  refresh-aware) so short-lived access tokens never strand a signed-in user.

## System maintenance endpoints

`POST /api/v1/system/orders/expire-stale` is an operator/cron surface for the
order expiry sweeper (expires unpaid reservations past `payment_expires_at`
and restores ticket inventory). It does not use user sessions:

- Authenticate with the `x-cron-secret` request header; the value must equal
  the `CRON_SECRET` environment variable of the API deployment.
- The guard fails closed: if `CRON_SECRET` is unset, every `/api/v1/system/*`
  request is rejected with 401.
- Optional JSON body `{ "limit": 100 }` caps how many orders are expired per
  invocation (1–500). Response: `{ expiredCount, windowMinutes, orders: [...] }`.
- Schedule it externally (e.g. every 5 minutes) against the API deployment.
  Read paths (`payment status`, `initiate payment`) also expire single stale
  orders lazily, so correctness does not depend on the sweep alone.

Payment window duration is controlled by `PAYMENT_WINDOW_MINUTES` (default 15,
clamped 1–120) on both the Next.js guest order path and the NestJS order path.
