# TicketUG deployment environment reference

> Pair 5 revision (2026-09-29) — Supabase architecture. Every variable listed
> here was cross-checked against actual `process.env` usage in the repository
> (frontend `app/`+`lib/`, API `apps/api/src`) — nothing speculative. Values
> are placeholders only; real secrets live in the hosting provider's secret
> store and are NEVER committed. The machine-readable template is
> `.env.example` (keep both in sync). The pre-Pair-5 Neon layout is historical
> (see TICKETUG_CHANGELOG.md).

## 1. Frontend (Next.js, Vercel)

| Variable | Required | Purpose | Example placeholder |
| --- | --- | --- | --- |
| `DATABASE_URL` | **YES** | Supabase Postgres connection string (session pooler `*.pooler.supabase.com:5432`; the `ticketug` schema lives in this database). TLS is strict at runtime: `lib/db.ts` pins the bundled Supabase Root CA (`certs/supabase-root-2021-ca.pem`) with `rejectUnauthorized: true` — never weakened. `SUPABASE_CA_CERT` overrides the CA path. | `postgresql://postgres.<ref>:<pass>@aws-0-<region>.pooler.supabase.com:5432/postgres` |
| `SUPABASE_URL` | **YES** (runtime, fail-closed) | Supabase project URL. `lib/supabase/server.ts` builds the server-side auth client per request (sessions in HttpOnly `Secure` `SameSite=Lax` cookies `sb-<ref>-auth-token[.N]`). Auth-dependent requests fail loudly without it in production (no fallback identity; builds do not evaluate it). | `https://<project-ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | **YES** (runtime, fail-closed) | Supabase publishable/anon key (Dashboard → Project Settings → API). **Server-side only by design** — no `NEXT_PUBLIC_*` variable exists anywhere (verified by grep), so the browser never sees it. Kept out of client bundles regardless of its publishable nature. | `<set in hosting provider>` |
| `API_ORIGIN` | **YES** | Public base URL of the hosted NestJS API (Vercel does NOT deploy `apps/api`). Every thin proxy route (`app/api/orders/**`, `app/api/tickets/**`, transition) forwards here with a fresh `Authorization: Bearer` access token (refresh-aware, `lib/api-forward.ts`) plus the original cookie header. Default `http://localhost:4000` is local-only. | `https://api.your-domain.example` |
| `PAYMENT_WINDOW_MINUTES` | no | Order payment window in minutes, clamped 1..120 (default 15). | `15` |
| `SUPABASE_CA_CERT` | no | Path to a CA PEM overriding the bundled `certs/supabase-root-2021-ca.pem` (for CA rotation without a code change). Set-but-unreadable fails loudly. | `/etc/ssl/supabase-root.pem` |

No `NEXT_PUBLIC_*` variable exists in the codebase (verified by grep) — server
secrets cannot reach client bundles through the public-env mechanism.

### Build/runtime facts (verified in Pair 5)

- `next build` succeeds with a completely empty environment (lazy auth; no
  build-time DB access — all DB-backed pages are `force-dynamic` or bail out to
  dynamic rendering via `cookies()`).
- At runtime every DB/auth variable is read per request from `process.env`, so
  Vercel env changes apply on the next deployment/restart without a rebuild.
- `next build` re-proven green in Pair 5 after the Supabase migration.

## 2. API (NestJS `apps/api`, hosted separately)

| Variable | Required | Purpose | Example placeholder |
| --- | --- | --- | --- |
| `DATABASE_URL` | **YES** | Same Supabase Postgres connection string as the frontend. `DatabaseService` pool (max 10) pins the bundled Supabase Root CA for `*.supabase.co`/`*.supabase.com` hosts (`rejectUnauthorized: true` — never weakened); non-Supabase hosts keep `sslmode` handling from the URL (e.g. staging `verify-full`). | same as frontend |
| `SUPABASE_URL` | **YES** (boot fails closed) | Supabase project URL. The auth guard verifies access tokens LOCALLY against the project's public JWKS (`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`, ES256) — no shared secret, no service-role key, no per-request network hop. Production refuses to boot without it. | `https://<project-ref>.supabase.co` |
| `WEB_ORIGIN` | **YES** (browser-facing deployments) | CORS allow-list (comma-separated exact origins) + `credentials: true`. No wildcard is ever emitted. Unset → only `http://localhost:3000` is allowed (browser calls fail closed; server-to-server still works). | `https://your-frontend.example` |
| `API_PORT` | no (default 4000) | Listen port. | `4000` |
| `API_HOST` | no (default `0.0.0.0`) | Bind address. | `0.0.0.0` |
| `PAYMENT_PROVIDER` | no — **GATE** | Do NOT set until a live provider is approved (see CONTINUITY §12 row 6). Unset/`test` is refused in production runtime (proven again in Pair 5: `POST …/payment/test-complete` → 503 `TEST_PAYMENT_DISABLED`). | `<unset>` |
| `PAYMENT_MODE` | no | `test` enables the simulated pathway in non-production runtimes only. Production ignores it. | `<unset>` |
| `PAYMENT_TEST_WEBHOOK_SECRET` | no | Overrides the development-only default webhook secret for the simulated test provider. The development default is compiled out of production behavior. | `<set only in staging>` |
| `CRON_SECRET` | **YES when a scheduler is wired** | Guard for `POST /api/v1/system/orders/expire-stale`. Unset → endpoint 401s (fails closed). | `<set in hosting provider>` |
| `SUPABASE_CA_CERT` | no | Same CA override as the frontend. | |

The API does **not** need `SUPABASE_ANON_KEY`: token verification is local
(JWKS), and the API never calls authenticated Supabase endpoints.

### Start command (proven)

```bash
pnpm --dir apps/api build   # or: pnpm api:build
NODE_ENV=production node apps/api/dist/main.js
# → /api/v1/health 200, /api/v1/readiness 200 (real SELECT 1 against Supabase), /api/v1/docs 200
```

No bundler, no tsx, no dev runner — plain `tsc` output started with plain Node
(Pair 3; re-proven against Supabase in Pair 5).

## 3. Database (PostgreSQL — **Supabase** since Pair 5)

| Item | Value |
| --- | --- |
| Connection | `DATABASE_URL` above; `ticketug` schema; **session pooler** (`*.pooler.supabase.com:5432`) — session-level semantics preserved for the raw-`pg` pools (transactions, `FOR UPDATE`, triggers). TLS: strict verification with the pinned Supabase Root 2021 CA (fingerprint + rotation in `certs/README.md`). |
| Migrations | `docs/migrations/000→011` (forward-only SQL) applied by the NEW migration runner: `pnpm migrate` (status: `pnpm migrate:status`). Ledger table `ticketug.migration` (name, sha256 checksum, applied_at). Deterministic ordering, no reapplication, checksum-drift detection, no destructive statements. |
| Schema | `ticketug.*` — 23 tables (see `docs/migrations/`). Supabase system schemas (`auth`, `storage`, `realtime`, `vault`, …) coexist untouched; TicketUG does not depend on them. |
| RLS | Deliberately NOT enabled on `ticketug.*` (§19 CASE A): the NestJS API + Next server enforce authorization server-side; the database is reachable only through the app's pooled connections. Supabase's auto-REST Data API does not expose the `ticketug` schema (only `public`, which TicketUG leaves empty). |
| Reproducibility | Proven on the real Supabase project: fresh DB → `pnpm migrate` → 8 migrations → 74/74 schema checks → 46/46 behavioral harness (issuance, scanner matrix, CASCADE, DB-backed PDFs) → browser journeys → cleanup. |

## 4. Authentication (Supabase Auth = hosted GoTrue)

| Item | Value |
| --- | --- |
| Provider | Supabase Auth (GoTrue), asymmetric signing keys (ES256 / P-256, public JWKS at `/auth/v1/.well-known/jwks.json`). |
| Frontend | Server-side only: sign-in/sign-up/sign-out route handlers (`app/api/auth/*`) call Supabase Auth through `@supabase/ssr`; the session (access + refresh tokens) lives in **HttpOnly, Secure, SameSite=Lax** cookies (`sb-<ref>-auth-token`, `base64-`-encoded JSON, chunked ≤3180 chars). The browser never sees tokens. |
| API verification | Local JWT verification (jose): signature via cached JWKS, `exp`, `iss` pinned to `${SUPABASE_URL}/auth/v1`, `aud === 'authenticated'`. HS256/anonymous/cross-project tokens fail closed. |
| User mapping | Supabase Auth user UUID → `ticketug.user_profile.auth_user_id` (text, UNIQUE). The profile row is created idempotently server-side at first session (`lib/user-profile.ts` — the §12 mapping mechanism). |
| Sign-out | Revokes the refresh token server-side and clears the HttpOnly cookies. The access token is a short-lived JWT (≤1 h default) — browser-side it dies with the cleared cookies; recommend lowering the access-token TTL in Dashboard → Auth → Sessions for stricter revocation. |
| Secrets | None shared with the app: no JWT secret, no service-role key needed by either tier. |
| Fail-closed floors | Frontend: request-time config check (`lib/supabase-config.ts`, ≥1 check, no fallback). API: boot-time check (`SUPABASE_URL`, production refuses to start). |

## 5. Migrations / tests (optional or operational)

| Variable | Purpose |
| --- | --- |
| `TEST_DATABASE_URL` | Enables the API integration suite (`pnpm api:test` integration file skips without it). THROWAWAY/staging DB only. |
| `STAGING_VERIFY_URL` | Alternative to `--url=` for `scripts/staging-verify/verify-gates.ts` (46-check behavioral harness). |
| `SUPABASE_CA_CERT` | CA override for the migration runner (`scripts/migrate.mjs`), matching both app tiers. |
