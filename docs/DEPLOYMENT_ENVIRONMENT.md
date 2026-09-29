# TicketUG deployment environment reference

> Pair 4 deliverable (2026-09-29). Every variable listed here was cross-checked
> against actual `process.env` usage in the repository (frontend `app/`+`lib/`,
> API `apps/api/src`) — nothing speculative. Values are placeholders only; real
> secrets live in the hosting provider's secret store and are NEVER committed.
> The machine-readable template is `.env.example` (keep both in sync).

## 1. Frontend (Next.js, Vercel)

| Variable | Required | Purpose | Example placeholder |
| --- | --- | --- | --- |
| `DATABASE_URL` | **YES** | Neon Postgres connection string. Every server component and Next route that queries events/orders/tickets goes through `lib/db.ts`. TLS is enforced at runtime in production (`ssl: { rejectUnauthorized: true }`) — the database must present a verifiable certificate (Neon does natively). | `postgres://user:pass@host/db?sslmode=require` |
| `BETTER_AUTH_SECRET` | **YES** (runtime, fail-closed) | ≥32 chars. Signs/verifies `__Secure-neon-auth.*` session cookies. Auth-dependent requests fail loudly without it (no fallback secret, sessions cannot be forged). **Not required at build time** — since the Pair-2/§15 lazy-auth refactor `next build` completes with an empty environment (proven; see CONTINUITY §15/§18). The hosted API tier still boot-fails without it by design. | `<set in hosting provider>` |
| `NEON_AUTH_BASE_URL` | **YES** | Base URL of the Neon Auth service. `VITE_NEON_AUTH_URL` is accepted as a fallback. The auth catch-all proxy forwards to `${baseUrl}/...` with NO `/api/auth` prefix. | `https://<neon-auth-project-base-url>` |
| `API_ORIGIN` | **YES** | Public base URL of the hosted NestJS API (Vercel does NOT deploy `apps/api`). Every thin proxy route (`lib/*proxy*`, `app/api/**`) forwards here. Default `http://localhost:4000` works ONLY in local development — never in a hosted deployment. | `https://api.your-domain.example` |
| `PAYMENT_WINDOW_MINUTES` | no | Order payment window in minutes, clamped 1..120 (default 15). | `15` |

No `NEXT_PUBLIC_*` variable exists in the codebase (verified by grep) — server
secrets cannot reach client bundles through the public-env mechanism.

### Build/runtime facts (verified)

- `next build` succeeds with a completely empty environment (lazy auth; no
  build-time DB access — all DB-backed pages are `force-dynamic` or fetch at
  request time).
- At runtime every DB/auth variable is read per request from `process.env`, so
  Vercel env changes apply on the next deployment/restart without a rebuild.

## 2. API (NestJS `apps/api`, hosted separately)

| Variable | Required | Purpose | Example placeholder |
| --- | --- | --- | --- |
| `DATABASE_URL` | **YES** | Same Postgres cluster as the frontend. `DatabaseService` pool (max 10). Add `?sslmode=verify-full` for TLS with certificate verification (Neon). | `postgres://user:pass@host/db?sslmode=verify-full` |
| `BETTER_AUTH_SECRET` | **YES** (boot fails closed) | Same value as the frontend. ≥32 chars enforced at module init in production — the process refuses to start otherwise. | `<set in hosting provider>` |
| `NEON_AUTH_BASE_URL` | **YES** | Same Neon Auth base URL as the frontend; the session guard resolves sessions against it. | same as frontend |
| `WEB_ORIGIN` | **YES** (browser-facing deployments) | CORS allow-list (comma-separated exact origins) + `credentials: true`. No wildcard is ever emitted. Unset → only `http://localhost:3000` is allowed (browser calls fail closed; server-to-server still works). | `https://your-frontend.example` |
| `API_PORT` | no (default 4000) | Listen port. | `4000` |
| `API_HOST` | no (default `0.0.0.0`) | Bind address. | `0.0.0.0` |
| `PAYMENT_PROVIDER` | no — **GATE** | Do NOT set until a live provider is approved (see CONTINUITY §12 row 6). Unset/`test` is refused in production runtime. | `<unset>` |
| `PAYMENT_MODE` | no | `test` enables the simulated pathway in non-production runtimes only. Production ignores it. | `<unset>` |
| `PAYMENT_TEST_WEBHOOK_SECRET` | no | Overrides the development-only default webhook secret for the simulated test provider. The development default is compiled out of production behavior. | `<set only in staging>` |
| `CRON_SECRET` | **YES when a scheduler is wired** | Guard for `POST /api/v1/system/orders/expire-stale`. Unset → endpoint 401s (fails closed). | `<set in hosting provider>` |

### Start command (proven)

```bash
pnpm --dir apps/api build   # or: pnpm api:build
NODE_ENV=production node apps/api/dist/main.js
# → /api/v1/health 200, /api/v1/readiness 200 (real SELECT 1), /api/v1/docs 200
```

No bundler, no tsx, no dev runner — plain `tsc` output started with plain Node
(Pair 3; re-proven in Pair 4, see CONTINUITY §18).

## 3. Database (PostgreSQL — Neon today)

| Item | Value |
| --- | --- |
| Connection | `DATABASE_URL` above; `ticketug` schema; `sslmode=verify-full` (Neon certificates verify natively) |
| Migrations | `docs/migrations/005→011`, forward-only SQL, applied **in order** with `psql -f`. There is NO formal migration runner in the repo (documented fact — do not pretend one exists). Migrations 001–004 predate repo tracking and are intentionally absent; a clearly-labelled verification stub exists at `scripts/staging-verify/001-stub-base.sql` and must NEVER touch production. |
| Reproducibility | Proven on a fresh PostgreSQL 18 instance: stub base (throwaway DBs only) + verbatim 005→011 → full 46-check harness green (CONTINUITY §18). |

## 4. Authentication (Neon Auth = Better Auth managed by Neon)

| Item | Value |
| --- | --- |
| Wire contract | `${NEON_AUTH_BASE_URL}/sign-in/email`, `/get-session`, … (no `/api/auth` prefix on the upstream) |
| Cookies | `__Secure-neon-auth.session_token` (HttpOnly, Secure, SameSite=Lax, 7d) + `__Secure-neon-auth.local.session_data` (HttpOnly, Secure, SameSite=Lax, 300 s TTL) |
| Secret | `BETTER_AUTH_SECRET` shared verbatim by BOTH tiers |
| Fail-closed floors | Frontend: request-time ≥32-char check (`lib/auth.ts`). API: boot-time ≥32-char check (`apps/api/src/auth/neon-auth.ts`). |

## 5. Tests (optional, never production)

| Variable | Purpose |
| --- | --- |
| `TEST_DATABASE_URL` | Enables the API integration suite (`pnpm api:test` integration file skips without it). THROWAWAY/staging DB only. |
| `STAGING_VERIFY_URL` | Alternative to `--url=` for `scripts/staging-verify/verify-gates.ts`. |
| `AUTH_DATABASE_URL` | Local auth stand-in only (`scripts/local-auth-standin/`); not a deployment variable. |
