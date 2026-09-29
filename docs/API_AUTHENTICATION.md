# API authentication boundary

TicketUG uses **Supabase Auth** as the sole credential and session authority.
Pair 6 removed the separately hosted NestJS API — there is no more Bearer
forwarding and no second verifier: the Next.js server resolves the session via
`@supabase/ssr` (`supabase.auth.getUser()`, which validates the token with
Supabase Auth and refreshes it server-side when expired) and maps the validated
Supabase user UUID to `ticketug.user_profile`, active organizer memberships, and
platform roles (`lib/request-context.ts`). Guest surfaces authenticate with the
order's access token, sha256-compared against `guest_access_token_hash` inside
the same SQL statement as the data read (or inside the mutating SQL function).

The server must never trust `userId`, `role`, `organizerId`, or membership
values from request bodies. Every protected handler derives identity from the
validated session (`getTicketUGContext`/`requireTicketUGContext`), and mutating
SQL functions re-verify authority internally (defense-in-depth).

## Fail-closed floors

- Frontend request-time config check (`lib/supabase-config.ts`) — production
  requests fail loudly without `SUPABASE_URL`/`SUPABASE_ANON_KEY`.
- Guest surfaces: missing/empty `x-order-access-token` → 401.
- System sweep: missing/unset `CRON_SECRET` → 401 (never silently open).
- Payment simulation: production runtime → 503 `TEST_PAYMENT_DISABLED`.

## Historical notes

- Pre-Pair-5: Neon Auth (Better Auth) session cookies — removed.
- Pair 5: NestJS guard verified Bearer/cookie tokens locally via the project
  JWKS (ES256, issuer-pinned, audience `authenticated`) — mechanism removed
  with the API host in Pair 6; `jose` is no longer a dependency.
