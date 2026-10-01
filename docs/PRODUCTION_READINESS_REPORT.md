# TicketUG — Production Readiness Report

> Production deployment / verification gate (2026-09-29). Baseline: the
> post-migration forensic audit commit `41f01a3` (NestJS removal VERIFIED).
> This report distinguishes **VERIFIED** (actually tested, with evidence),
> **CONFIGURED** (set up but not behaviorally tested end-to-end) and
> **DEFERRED** (intentionally not built in this gate). Nothing is claimed
> production-ready merely because code exists. No secret values appear in
> this document.

## 1. VERIFIED (tested in this gate, real evidence)

### Repository / architecture

- **Baseline intact:** `git status` clean at `41f01a3`; branch `main`;
  `origin/main` = local `main` (0 unpushed commits at gate start).
- **NestJS removal re-proven from the working tree:** zero `@nestjs/*` /
  `NestFactory` / `API_ORIGIN` / `/api/v1` references in tracked code; zero
  tracked files under `apps/` (`git ls-files apps/` = 0); `package.json` has
  no Nest/Drizzle/jose dependencies; `pnpm-workspace.yaml` lists only the
  root package. Historical NestJS mentions survive only in `docs/` (records,
  intentionally untouched).
- **Residue REMOVED (§4):** untracked `apps/api/dist/` + `apps/api/node_modules/`
  build artifacts deleted from the sandbox working tree; obsolete
  `apps/api/dist/` rule removed from `.gitignore`; obsolete `API_ORIGIN` line
  removed from the local (git-ignored) `.env`.
- **Single-host request flow:** frontend → same-origin `/api/*` → Next.js
  server modules → PostgreSQL. No second API host, no `vercel rewrites` to
  external origins, no Docker/Railway/Render/Fly/VPS configuration.

### Database guarantees (real Supabase DB — `vmebmexwqfpnlioicqgj`)

- **SQL-function harness: 28/28 PASSED** — including the 6-way concurrent
  oversell barrier (exactly 1 winner, 5 clean rejections, capacity never
  negative), guest-token cancel denial, expiry + inventory restore,
  second-expiry no-op, `apply_payment_event` idempotency (same-event and
  new-event replays → DUPLICATE, no duplicate tickets), wrong-amount/wrong-
  order 422, lifecycle state machine incl. illegal-jump rejection.
- **Behavioral harness: 57/57 PASSED** — migration-011 objects, REAL issuance
  through the signed-webhook core, full scanner matrix (VALID /
  ALREADY_CHECKED_IN / WRONG_GATE / event-wide / disabled-gate /
  UNAUTHORIZED_SCANNER (disabled, unassigned, outsider) / WRONG_EVENT /
  INVALID_QR / INVALID_TICKET / EVENT_NOT_AVAILABLE / SUSPENDED-scannable /
  admin-bypass), gate-deletion CASCADE fail-closed, DB-backed owner+guest PDFs
  with wrong-token refusal.
- **Pre-launch data state confirmed before harness runs:** all ticketug data
  tables 0 rows, migration ledger 12/12 (000, 005–015) as of 2026-10-01, `auth.users` = 0 until the owner creates the platform-admin account.
  **Post-harness census re-verified:** 0 data rows, ledger untouched,
  `auth.users` untouched — zero test artifacts (harness records were
  truncated using the harness's own documented reset list).

### Automated pipeline (this gate, this commit)

- **Tests:** vitest **137/137 passed** (19 files) at `fb18547`; re-baselined at 126/126 (18 files) in the 2026-10-01 audit after dead test-code removal
- **Typecheck:** PASS (`tsc --noEmit`)
- **Lint:** PASS (`eslint .`)
- **Build:** PASS (`next build` — all routes compiled)

### Payment boundary (code-level, production runtime)

- `lib/server/payments.ts` refuses the simulated pathway whenever the server
  runs in production mode (503 `TEST_PAYMENT_DISABLED`) regardless of
  `PAYMENT_MODE`; issuance happens ONLY through `ticketug.apply_payment_event`
  (HMAC-verified webhook path); webhooks are deduped by event id; amount,
  currency and order-reference mismatches are rejected (verified in the SQL
  harness). Browser redirect cannot mark payment successful.

## 2. CONFIGURED (set up; behaviorally verified only after NI's Vercel env pass)

- **Supabase API keys (NEW system):** the app reads `SUPABASE_URL` +
  `SUPABASE_ANON_KEY` (the publishable-key slot, server-side only via
  `@supabase/ssr`; supported natively by `@supabase/ssr@0.12.7` /
  `supabase-js@2.117.2`). **No `SUPABASE_SECRET_KEY` (`sb_secret_…`) is
  required** — CASE C: no code path uses privileged Supabase REST access; all
  privileged operations are PostgreSQL via `DATABASE_URL` + SECURITY DEFINER
  functions. No `NEXT_PUBLIC_*` Supabase variables are used — the browser
  never talks to Supabase directly. Vercel-side values are set by NI
  (docs/DEPLOYMENT_MANUAL_STEPS.md, BLOCKER 2a).
- **Expiry sweep / cron (§8 — BUILD completed):** `vercel.json` schedules
  Vercel Cron **daily at 03:00 UTC** → `GET /api/system/orders/expire-stale`
  (the most frequent cadence the Vercel Hobby plan allows — `*/5 * * * *`
  rejects the deployment on Hobby, which was observed live). This is safe by
  design: order/payment read paths lazily expire due orders
  (`expire_order_if_due`), so the cron is a backstop for abandoned orders.
  The route accepts `x-cron-secret` (operator/external schedulers) AND Vercel
  Cron's automatic `Authorization: Bearer <CRON_SECRET>`; fail-closed 401
  when `CRON_SECRET` is unset; sweep is idempotent (SKIP LOCKED + verified
  no-op on repeat). Tighter cadence documented (Pro upgrade or external
  scheduler).
- **Vercel deployment:** GitHub-connected auto-deploy on push to `main`
  (previously observed ~20 s); production URL `https://ticketug.vercel.app`.

## 3. DEFERRED (intentionally not implemented in this gate)

- ~~Live payment provider~~ — **CLOSED 2026-09-30:** NylonPay approved and integrated (`c69e968`); merchant-side registration of the webhook URL + production env vars remain operator steps (DEPLOYMENT_MANUAL_STEPS BLOCKER 2d). ~~(Flutterwave/MTN MoMo/etc.)~~ — the production
  fail-closed boundary stays until NI approves a provider (CONTINUITY §12
  row 6); an Edge Function for its webhook is the documented extension point.
- **Refunds, settlements, ledger/reconciliation, notifications** — documented
  extension points; outside this gate.
- **Legacy key retirement in Supabase** — only after the hosted auth pass is
  green on the publishable key.
- **Vercel Pro upgrade or external scheduler** — needed only if 5-minute
  sweep cadence is required on Hobby (daily clamp).

## 4. BLOCKED (requires NI action — none are code defects)

- **Hosted authentication verification** (register/login/logout on the deployed
  URL) requires NI to set the NEW publishable key + `SUPABASE_URL` +
  `DATABASE_URL` (+ `CRON_SECRET`) in Vercel, then redeploy. This was the
  previous audit's remaining hosted gap and remains gated on NI's secret
  store, not on code.
- **Hosted browser journey pass** (§13 of the gate directive) runs after the
  env pass; the server-side parity for every journey is already re-proven
  locally against the real database.

## 5. Environment variable matrix (§5)

| Variable | Required? | Runtime | Public/Secret | Source | Status |
| --- | --- | --- | --- | --- | --- |
| `DATABASE_URL` | REQUIRED (production fails closed without it) | Server (Next.js) | Secret | Supabase → Connect → session pooler | set locally; NI sets in Vercel |
| `SUPABASE_URL` | REQUIRED (production auth fails closed without it) | Server (Next.js) | Public (URL) | `https://vmebmexwqfpnlioicqgj.supabase.co` | set locally; NI sets in Vercel |
| `SUPABASE_ANON_KEY` | REQUIRED (production auth fails closed without it) | Server (Next.js) | Publishable (safe by design; kept server-side) | NEW `sb_publishable_…` from Supabase API Keys | NI sets in Vercel |
| `SUPABASE_SECRET_KEY` | **NOT REQUIRED** — no privileged REST usage | n/a | Secret (never expose) | n/a | do NOT set |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_*` | NOT REQUIRED — browser never calls Supabase | n/a | n/a | n/a | do NOT set |
| `CRON_SECRET` | RECOMMENDED (sweep 401s without it) | Server (Next.js) | Secret | generated (`openssl rand -hex 32`) | NI sets in Vercel |
| `PAYMENT_WINDOW_MINUTES` | Optional (clamped 1..120, default 15) | Server | Public | operator choice | optional |
| `PAYMENT_MODE` / `PAYMENT_TEST_WEBHOOK_SECRET` | MUST BE UNSET in production (test provider is refused in production runtimes regardless) | Server | n/a | n/a | do NOT set |
| `PAYMENT_PROVIDER` / `NYLONPAY_API_KEY` / `NYLONPAY_API_SECRET` / `NYLONPAY_WEBHOOK_SECRET` | REQUIRED for live payments (`PAYMENT_PROVIDER=nylonpay` + the three NylonPay secrets; fail-closed 503 `PROVIDER_NOT_CONFIGURED` without them) | Server | n/a | n/a | set from the NylonPay merchant dashboard |
| `SUPABASE_CA_CERT` | Optional override | Server | Public (path) | only on CA rotation | unset |
| `TEST_DATABASE_URL` | Tests only (never production) | Test | Secret | throwaway DB | unset |
| `API_ORIGIN` / `WEB_ORIGIN` / `API_PORT` / `API_HOST` | OBSOLETE (removed since Pair 6) | n/a | n/a | n/a | removed from local `.env`; do NOT set |

Database URL multiplicity check: exactly one database connection variable is
used at runtime — `DATABASE_URL` (session pooler, strict TLS with the pinned
Supabase Root 2021 CA, `rejectUnauthorized` never disabled). `DIRECT_DATABASE_URL`
and `POSTGRES_URL` do not appear anywhere in the repository.

## 6. Changes made in this gate (commit scope)

1. `app/api/system/orders/expire-stale/route.ts` — shared auth helper; accepts
   `Authorization: Bearer <CRON_SECRET>` (Vercel Cron) alongside
   `x-cron-secret`; added GET handler for Vercel Cron dispatch; fail-closed
   behavior unchanged.
2. `vercel.json` — NEW: Vercel Cron schedule (daily 03:00 UTC — Hobby-plan
   maximum) for the sweep.
3. `.gitignore` — removed obsolete `apps/api/dist/` rule.
4. `docs/DEPLOYMENT_MANUAL_STEPS.md` — BLOCKER 2a/2b rewritten for the NEW
   Supabase API keys; scheduler recommendation upgraded to WIRED status.
5. `docs/PRODUCTION_READINESS_REPORT.md` — this report.
6. `docs/TICKETUG_CONTINUITY.md`, `docs/TICKETUG_CHANGELOG.md` — gate record.
7. Sandbox-only (untracked): deleted `apps/api/{dist,node_modules}` residue,
   removed obsolete `API_ORIGIN` from local `.env`.

No product code, schema, transactional logic, RLS policy or security
boundary was changed.
