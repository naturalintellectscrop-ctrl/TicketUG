# TicketUG — manual deployment steps requiring NI account access

> Pair 4 deliverable (2026-09-29). During Pair 4's hosted-verification pass the
> following services were **NOT reachable from the working environment** (no
> dashboards, no API tokens, no deployment URLs anywhere in the repo or
> handover log). Nothing was fabricated; every locally-provable step was
> verified instead (see `docs/TICKETUG_CONTINUITY.md` §18).
>
> Rule: each entry below states the exact dashboard location, exact setting,
> expected value, verification command and expected evidence. **Do not paste
> secret values into chat/Git** — set them in the provider's secret store.

## STATUS SNAPSHOT

```text
LOCAL VERIFIED   — frontend build, compiled API runtime, migrations, auth,
                   guest ticketing + PDF, CORS/cookies, secrets hygiene,
                   readiness (positive + negative), payment production gate
HOSTED VERIFIED  — (nothing yet; no hosted URL or credential is available)
BLOCKED          — Vercel production deploy, hosted API hosting, real Neon
                   staging DB/auth application, hosted browser journeys
```

---

## BLOCKER 1 — Vercel Production Branch is a stale backup branch

- **WHY IT MATTERS:** the Vercel project deploys `cron/round-10-settings`
  @ `85c22fc` (4+ commits behind `main` and missing Pairs 1–3). Production does
  not contain the current product.
- **SERVICE / DASHBOARD LOCATION:** Vercel → TicketUG project → Settings → Git.
- **EXACT SETTING:** `Production Branch`.
- **EXPECTED VALUE:** `main`.
- **WHO:** NI (Vercel account owner).
- **HOW TO VERIFY:** Project → Deployments → the latest **Production** deploy
  must show commit `16bc73d` (or the current tip of `main`) with branch `main`.
- **EXPECTED EVIDENCE:** screenshot/URL of the production deployment row; commit
  hash matches `git -C TicketUG rev-parse origin/main`.

## BLOCKER 2 — Vercel environment variables

- **WHY IT MATTERS:** without them the deploy renders marketing surfaces with
  auth/DB dead (fail-closed by design) — the product is non-functional.
- **SERVICE / DASHBOARD LOCATION:** Vercel → Project → Settings → Environment
  Variables (Production + Preview).
- **EXACT SETTINGS + EXPECTED VALUES** (placeholders; real values from NI's
  secret store — full reference: `docs/DEPLOYMENT_ENVIRONMENT.md`):

  ```text
  BETTER_AUTH_SECRET   = <set in hosting provider>   (≥32 chars)
  DATABASE_URL         = <set in hosting provider>   (Neon Postgres, sslmode=require)
  NEON_AUTH_BASE_URL   = <set in hosting provider>   (Neon Auth base URL)
  API_ORIGIN           = <set in hosting provider>   (public URL of the hosted API — see BLOCKER 3)
  PAYMENT_WINDOW_MINUTES = 15 (optional)
  ```

- **WHO:** NI.
- **HOW TO VERIFY (after deploy):**
  - `curl -s https://<frontend-domain>/api/health`-style proxy target returns
    the API's JSON (proves `API_ORIGIN`), or simply load `/events` in a browser:
    real event rows must appear (proves `DATABASE_URL`).
  - Sign up a test account: session cookie `__Secure-neon-auth.session_token`
    must be set (proves `NEON_AUTH_BASE_URL` + `BETTER_AUTH_SECRET`).
- **EXPECTED EVIDENCE:** `/events` shows DB-backed cards; sign-up/sign-in works;
  browser console free of 5xx/CORS errors.

## BLOCKER 3 — Host the NestJS API (`apps/api`) outside Vercel

- **WHY IT MATTERS:** Vercel does not deploy `apps/api`. Every ticket/order/
  scanner/PDF feature proxies to it. Without a hosted API the product cannot run.
- **SERVICE:** Railway / Render / Fly / VPS — any Node 20+ host.
- **DASHBOARD LOCATION:** provider's "New service from GitHub repo" flow →
  root directory `apps/api` (monorepo) — or use the repo-root scripts.
- **EXACT SETTINGS:**

  ```text
  Build command:  pnpm install --frozen-lockfile && pnpm --dir apps/api build
  Start command:  NODE_ENV=production node apps/api/dist/main.js
  Port:           provider-injected port is honored via API_PORT/API_HOST
                  (defaults: 4000 on 0.0.0.0)
  Env vars:       DATABASE_URL, BETTER_AUTH_SECRET, NEON_AUTH_BASE_URL,
                  WEB_ORIGIN (the Vercel frontend origin), CRON_SECRET (when a
                  scheduler exists); see docs/DEPLOYMENT_ENVIRONMENT.md §2
  ```

- **WHO:** NI.
- **HOW TO VERIFY (server-side, no browser):**

  ```bash
  curl -s https://<api-host>/api/v1/health
  # → {"status":"ok","service":"ticketug-api"}
  curl -s https://<api-host>/api/v1/readiness
  # → {"status":"ready","database":"ok"}   (real SELECT 1)
  curl -s -o /dev/null -w '%{http_code}' https://<api-host>/api/v1/docs
  # → 200
  curl -s -o /dev/null -w '%{http_code}' https://<api-host>/api/v1/users/me
  # → 401 (fail-closed, no cookies)
  ```

- **EXPECTED EVIDENCE:** the four responses above; then set Vercel `API_ORIGIN`
  to this URL (BLOCKER 2) and confirm an authenticated frontend round-trip.

## BLOCKER 4 — Apply migration 011 (gates) to the real staging Neon DB

- **WHY IT MATTERS:** gates, ticket-type gate permissions and gate-scoped staff
  assignments do not exist in the hosted DB until 011 is applied; every
  gate-dependent feature degrades (by design: fail-closed) without it.
- **SERVICE:** Neon console (SQL editor) or any psql with the staging branch URL.
- **EXACT ACTION:** apply **verbatim, in order** — the repo's migrations are
  forward-only SQL with no runner:

  ```bash
  psql "$STAGING_DATABASE_URL" -f docs/migrations/011-gates.sql
  ```

  005→010 are already applied to production/staging history (011 is the only
  pending one). Do NOT apply `scripts/staging-verify/001-stub-base.sql` to any
  real database — it is a labelled throwaway verification stub.
- **WHO:** NI (Neon project owner).
- **HOW TO VERIFY:**

  ```bash
  psql "$STAGING_DATABASE_URL" -c "\d ticketug.event_gate"
  psql "$STAGING_DATABASE_URL" -c "\d ticketug.ticket_type_gate"
  psql "$STAGING_DATABASE_URL" -c "\d ticketug.event_staff_assignment"
  ```

- **EXPECTED EVIDENCE:** the three tables exist with the 011 definitions; then
  in the organizer UI create Main/VIP/VVIP gates on a staging event and watch
  them persist across reload (the Pair-3 journey, now against real Neon).

## BLOCKER 5 — Hosted browser verification pass (needs 1–4)

- **WHY IT MATTERS:** all browser evidence in Pairs 1–4 is from the local
  staging stack (real Postgres 18 engine, real Better Auth engine on the Neon
  wire contract). The managed Neon Auth service and the hosted surfaces remain
  unobserved.
- **SERVICE:** Vercel (frontend) + hosted API + Neon (DB/Auth).
- **EXACT ACTION:** after BLOCKERS 1–4, run the standard journey matrix:
  sign-up → organizer onboarding → event → ticket types → gates → permissions →
  staff invite/accept → assignment → guest checkout → payment (simulated where
  permitted) → ticket → PDF → scanner matrix (VALID / WRONG_GATE /
  ALREADY_CHECKED_IN / UNAUTHORIZED_SCANNER) at desktop + 390 px.
- **WHO:** NI or a future agent run with read-only dashboard access.
- **HOW TO VERIFY:** browser console free of errors; DB rows persist across
  reload and re-login; scanner decisions match the documented gate matrix
  (CONTINUITY §16/§17); PDFs download with `application/pdf; no-store`.
- **EXPECTED EVIDENCE:** screenshots + the deployment-readiness matrix in
  CONTINUITY §18 flipped from "LOCAL" to "HOSTED" row by row.

## NON-BLOCKING RECOMMENDATIONS

1. **Migration runner** (future pair): a tiny ordered runner
   (`scripts/migrate.ts` reading `docs/migrations/*.sql` + a
   `schema_migrations` ledger) would remove the manual `psql -f` step above.
   Do not retro-write migrations 001–004; record their state instead.
2. **Scheduler wiring** (deployment, not code): an external cron must call
   `POST /api/v1/system/orders/expire-stale` with the `x-cron-secret` header so
   expired orders self-sweep; the lazy per-read expiry already bounds the blast
   radius until then.
3. **Add the hosted URLs** (frontend + API + Neon project id) to the internal
   handover log so future runs can observe the real deployments.
