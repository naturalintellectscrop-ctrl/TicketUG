# TicketUG deployment environment reference

> Pair 6 revision (2026-09-29) — Supabase-native architecture. The separately
> hosted NestJS API was REMOVED; the only application host is Next.js (Vercel).
> Every variable listed here was cross-checked against actual `process.env`
> usage — nothing speculative. Real secrets live in the hosting provider's
> secret store and are NEVER committed. The machine-readable template is
> `.env.example` (keep both in sync).

## 1. Next.js (Vercel) — the only application host

| Variable | Required | Purpose | Example placeholder |
| --- | --- | --- | --- |
| `DATABASE_URL` | **YES** | Supabase Postgres connection string (session pooler `*.pooler.supabase.com:5432`; the `ticketug` schema + SQL functions live in this database). TLS is strict at runtime: `lib/db.ts` pins the bundled Supabase Root CA (`certs/supabase-root-2021-ca.pem`) with `rejectUnauthorized: true` — never weakened. `SUPABASE_CA_CERT` overrides the CA path. | `postgresql://postgres.<ref>:<pass>@aws-0-<region>.pooler.supabase.com:5432/postgres` |
| `SUPABASE_URL` | **YES** (runtime, fail-closed) | Supabase project URL. `lib/supabase/server.ts` builds the server-side auth client per request (sessions in HttpOnly `Secure` `SameSite=Lax` cookies `sb-<ref>-auth-token[.N]`). Auth-dependent requests fail loudly without it in production; builds do not evaluate it. | `https://<project-ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | **YES** (runtime, fail-closed) | Supabase publishable/anon key (Dashboard → Project Settings → API). **Server-side only by design** — no `NEXT_PUBLIC_*` variable exists anywhere. | `<set in hosting provider>` |
| `PAYMENT_WINDOW_MINUTES` | no | Order payment window in minutes, clamped 1..120 (default 15). | `15` |
| `PAYMENT_PROVIDER` | Selects the live payment provider adapter (`nylonpay`). Unset/unknown → live initiation fails closed 503 `PROVIDER_NOT_CONFIGURED` | Server | yes (live) | n/a | set to `nylonpay` for production |
| `NYLONPAY_API_KEY` | NylonPay merchant API key | Server | yes (live) | n/a | from the NylonPay merchant dashboard |
| `NYLONPAY_API_SECRET` | NylonPay merchant API secret | Server | yes (live) | n/a | from the NylonPay merchant dashboard |
| `NYLONPAY_WEBHOOK_SECRET` | Secret NylonPay signs webhooks with (HMAC-SHA256, raw body) | Server | yes (live) | n/a | from the NylonPay merchant dashboard |
| `NYLONPAY_BASE_URL` | Optional API host override | Server | no | n/a | leave unset unless NylonPay changes hosts |
| `NYLONPAY_WEBHOOK_TOLERANCE_SECONDS` | Optional webhook replay window (default 300) | Server | no | n/a | leave unset |
| `NEXT_PUBLIC_SITE_URL` | Canonical public origin for metadata/canonical/sitemap/JSON-LD/OG | Browser+Server | no | `https://ticketug.vercel.app` | set once the production domain exists |
| `SUPABASE_CA_CERT` | no | Path to a CA PEM overriding the bundled one (CA rotation without a code change). Set-but-unreadable fails loudly. | `/etc/ssl/supabase-root.pem` |
| `PAYMENT_MODE` | no — **staging only** | `test` enables the simulated payment pathway ONLY in non-production runtimes. Production (`next start`/Vercel) refuses it: 503 `TEST_PAYMENT_DISABLED`. | `<unset in production>` |
| `PAYMENT_TEST_WEBHOOK_SECRET` | no | Overrides the development-only default webhook secret for the simulated test provider (non-production only). | `<set only in staging>` |
| `CRON_SECRET` | no (needed when a scheduler is wired) | Guard for `POST /api/system/orders/expire-stale`. Unset → endpoint 401s (fails closed). | `<set in hosting provider>` |

No `NEXT_PUBLIC_*` variable exists in the codebase — server secrets cannot
reach client bundles.

### Removed variables (do NOT set)

| Variable | Removed in | Reason |
| --- | --- | --- |
| `API_ORIGIN` | Pair 6 | the separately hosted NestJS API no longer exists |
| `WEB_ORIGIN` / `API_PORT` / `API_HOST` | Pair 6 | CORS/listen config of the removed API host (same-origin now) |
| `BETTER_AUTH_SECRET`, `NEON_AUTH_BASE_URL` | Pair 5 | Neon Auth mechanism removed |

## 2. Runtime facts

- `next build` succeeds with a completely empty environment (lazy auth; all
  DB/auth variables are read per request from `process.env` — Vercel env
  changes apply on the next deployment/restart without a rebuild).
- Health surfaces: `GET /api/health` (process), `GET /api/readiness` (real
  `SELECT 1` against the database; 503 when the database is unavailable).
- Migrations: `pnpm migrate` / `pnpm migrate:status` — ledger
  `ticketug.migration`, files `docs/migrations/000, 005→015`, forward-only,
  checksum-pinned, non-destructive.

## 3. Database (Supabase PostgreSQL)

| Item | Value |
| --- | --- |
| Connection | `DATABASE_URL`; session pooler; strict TLS with the pinned Supabase Root 2021 CA (fingerprint + rotation in `certs/README.md`). |
| Schemas | `ticketug.*` (23 tables + migration-012 SQL functions). Supabase system schemas coexist untouched. |
| SQL functions | `create_order`, `cancel_order`, `expire_order_if_due`, `expire_stale_orders`, `apply_payment_event`, `transition_event_lifecycle` (+ private helpers). `security definer`; EXECUTE revoked from PUBLIC/anon/authenticated — server-pool-only. |
| RLS | Deliberately NOT enabled (unchanged access path: only the trusted server pool connects as the postgres role; the anon role has zero privileges on `ticketug` and the schema is not exposed via PostgREST — verified Pair 5.1). Re-audit before any non-server consumer. |
| PostgREST | `public` schema is empty; `ticketug` is not exposed. |

## 4. Authentication (Supabase Auth = hosted GoTrue)

| Item | Value |
| --- | --- |
| Provider | Supabase Auth (GoTrue), asymmetric keys (ES256 / P-256, public JWKS). |
| Frontend | Server-side only: sign-in/sign-up/sign-out route handlers call Supabase Auth through `@supabase/ssr`; sessions live in HttpOnly, Secure, SameSite=Lax cookies (`sb-<ref>-auth-token`, chunked). The browser never sees tokens and never talks to Supabase directly. |
| Identity mapping | `supabase.auth.getUser()` (server-validated, refresh-aware) → `ticketug.user_profile.auth_user_id` (text, UNIQUE), created idempotently at first session (`lib/user-profile.ts`). |
| Guest access | Order access token (sha256 at rest) — compared inside SQL; single-use re-key rotation supported. |
| Fail-closed floors | Request-time config check on the web tier; missing guest token → 401; sweep without `CRON_SECRET` → 401; production payment simulation → 503. |

## 5. Tests (optional)

| Variable | Purpose |
| --- | --- |
| `TEST_DATABASE_URL` | Enables the DB integration suite + SQL-function harnesses. THROWAWAY/staging DB only. |
| `STAGING_VERIFY_URL` | Alternative to `--url=` for `scripts/staging-verify/verify-gates.ts` (57-check behavioral harness; `verify-sql-functions.ts` = 28-check SQL matrix). |
| `PAYMENT_MODE=test` | Non-production runtime flag enabling the simulated provider for those harnesses. |
