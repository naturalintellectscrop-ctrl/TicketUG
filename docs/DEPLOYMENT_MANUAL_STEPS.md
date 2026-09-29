# TicketUG — manual deployment steps requiring NI account access

> Pair 5.1 revision (2026-09-29). Every Pair 5 claim was independently re-verified
> against the real Supabase project (schema 23 tables, ledger 8/8, TLS fingerprint
> match, anon-role privilege audit, production runtime smoke 8/8). The hosted
> boundary remains BLOCKED on NI account access — nothing is fabricated; every
> entry below states the exact dashboard location, exact setting, expected value,
> verification command and expected evidence. **Do not paste secret values into
> chat/Git** — set them in the provider's secret store.

## STATUS SNAPSHOT

```text
SUPABASE VERIFIED — Postgres connection (session pooler, strict TLS w/ pinned
                    Supabase Root CA — fingerprint re-matched against the live
                    chain in Pair 5.1), migrations 000→011 via the runner
                    (ledger 8/8, idempotent), schema (23 tables / 37 FKs /
                    82 indexes verified), PostgREST non-exposure (anon role has
                    NO privileges on ticketug), production runtime smoke 8/8
                    (health/readiness/401-fail-closed/forged-JWT-401/503
                    TEST_PAYMENT_DISABLED/CORS fail-closed), browser render
                    check (zero console errors)
LOCAL VERIFIED    — Supabase Auth integration on the GoTrue wire contract
                    (sign-up/sign-in/session/refresh-aware proxying/logout/
                    forged-credential rejection; HttpOnly Secure cookies);
                    remote-JWKS verification against the REAL project's
                    public JWKS (forged token → 401); payment production gate
                    (503 TEST_PAYMENT_DISABLED); boot fail-closed
BLOCKED           — GitHub push of a53fe34 + f8b22d5 (BLOCKER 0 — no push
                    credentials in the agent environment), live sign-up/sign-in
                    against HOSTED Supabase Auth (needs the project's
                    publishable/anon key — BLOCKER 2b), Vercel production
                    deploy (BLOCKERS 1–2), hosted API hosting (BLOCKER 3),
                    hosted browser pass (BLOCKER 5)
DATA NOTE         — ticketug.webhook_event holds 2 orphaned rows from Pair 5's
                    own verification run (provider 'test', 2026-09-29 08:37 &
                    08:40 UTC, orders ord_c878dc39aa3bc7496b866bc9 and
                    ord_14d6f2d112b6c5494c9c4aa5 which no longer exist). Safe
                    for NI to delete those exact rows; nothing else in the
                    project contains data rows.
```

---

## BLOCKER 0 — Push the pending commits to GitHub (gates everything else)

- **WHY IT MATTERS:** Vercel deploys FROM GitHub. `origin/main` = `16bc73d`
  (Pair 3), but the Supabase architecture lives in local commits `a53fe34`
  (Pair 4) + `f8b22d5` (Pair 5). Until these are pushed, Vercel cannot deploy
  the current product at all — BLOCKERS 1–5 are unexecutable against the
  correct code.
- **SERVICE:** GitHub → repository `naturalintellectscrop-ctrl/TicketUG`
  (private — keep it private).
- **EXACT ACTION (any machine with NI's GitHub credentials):**

  ```bash
  git clone git@github.com:naturalintellectscrop-ctrl/TicketUG.git   # or HTTPS w/ PAT
  cd TicketUG
  git pull origin main                       # confirm at 16bc73d
  # if the two commits are NOT already on the machine:
  git fetch <source-of-the-commits> && git merge --ff-only <their-main>
  # on the machine that has them (agent sandbox / previous runs):
  git push origin main
  git log origin/main -1                     # must print f8b22d5
  ```

- **WHO:** NI (repository owner).
- **HOW TO VERIFY:** `git ls-remote origin main` → `<sha> refs/heads/main`
  where sha = `f8b22d5…`; GitHub → repository → Commits → the two newest
  commits are `feat: migrate ticketug infrastructure to supabase` and the
  Pair-4 docs commit.
- **EXPECTED EVIDENCE:** `origin/main` = `f8b22d5`; no force-push used; the
  two commits appear with Natural Intellects Ltd authorship.

## BLOCKER 1 — Vercel Production Branch is a stale backup branch

- **WHY IT MATTERS:** the Vercel project deploys `cron/round-10-settings`
  @ `85c22fc` (many commits behind `main`). Production does not contain the
  current product (or the Supabase migration).
- **SERVICE / DASHBOARD LOCATION:** Vercel → TicketUG project → Settings → Git.
- **EXACT SETTING:** `Production Branch`.
- **EXPECTED VALUE:** `main`.
- **WHO:** NI (Vercel account owner).
- **HOW TO VERIFY:** Project → Deployments → the latest **Production** deploy
  must show the current tip of `main` with branch `main`.
- **EXPECTED EVIDENCE:** screenshot/URL of the production deployment row; commit
  hash matches `git rev-parse origin/main`.

## BLOCKER 2a — Vercel environment variables (Supabase architecture)

- **WHY IT MATTERS:** without them the deploy renders marketing surfaces with
  auth/DB dead (fail-closed by design) — the product is non-functional.
- **SERVICE / DASHBOARD LOCATION:** Vercel → Project → Settings → Environment
  Variables (Production + Preview).
- **EXACT SETTINGS + EXPECTED VALUES** (placeholders; real values from NI's
  secret store — full reference: `docs/DEPLOYMENT_ENVIRONMENT.md`):

  ```text
  DATABASE_URL          = <set in hosting provider>  (Supabase session pooler URL — the one NI supplied for Pair 5)
  SUPABASE_URL          = https://<project-ref>.supabase.co   (Supabase Dashboard → Project Settings → General)
  SUPABASE_ANON_KEY     = <publishable key>          (Supabase Dashboard → Project Settings → API Keys — the anon/publishable key, NOT the service-role key)
  API_ORIGIN            = <set in hosting provider>  (public URL of the hosted API — see BLOCKER 3)
  PAYMENT_WINDOW_MINUTES = 15 (optional)
  ```

  Removed since Pair 4 (do NOT set anymore): `BETTER_AUTH_SECRET`,
  `NEON_AUTH_BASE_URL` / `VITE_NEON_AUTH_URL`.
- **WHO:** NI.
- **HOW TO VERIFY (after deploy):**
  - load `/events` in a browser: real event rows must appear (proves
    `DATABASE_URL` against Supabase).
  - Sign up a test account: cookie `sb-<project-ref>-auth-token` must be set,
    HttpOnly + Secure (proves `SUPABASE_URL` + `SUPABASE_ANON_KEY`).
- **EXPECTED EVIDENCE:** `/events` shows DB-backed cards; sign-up/sign-in
  works; browser console free of 5xx/CORS errors.

## BLOCKER 2b — Enable live Supabase Auth verification (the one Pair-5 BLOCKED item)

- **WHY IT MATTERS:** every GoTrue endpoint except the public JWKS requires
  the project's publishable/anon key. Pair 5 implemented and verified the full
  auth stack against the GoTrue wire contract and verified token verification
  against the real project's JWKS, but could not run live sign-up/sign-in
  against the HOSTED Supabase Auth without this key (it was not supplied and
  is not derivable). No code change is needed — this is configuration only.
- **SERVICE / DASHBOARD LOCATION:** Supabase Dashboard → Project Settings →
  API Keys → **anon / publishable** key. (Never use the service-role key in
  the frontend tier; TicketUG does not need it at all.)
- **EXACT ACTION:** set `SUPABASE_ANON_KEY` in Vercel (BLOCKER 2a) and, if
  desired for local runs, in the operator's local `.env`.
- **WHO:** NI (Supabase project owner).
- **HOW TO VERIFY:**

  ```bash
  curl -s "https://<project-ref>.supabase.co/auth/v1/health" -H "apikey: <anon key>"
  # → {"version":"...","name":"GoTrue",...}      (proves the key works)
  ```

  then sign up through the deployed frontend and confirm the
  `ticketug.user_profile` row appears with `auth_user_id` equal to the new
  Supabase user UUID (the §12 mapping).

- **EXPECTED EVIDENCE:** the health response above + one browser sign-up
  round-trip (session cookie set, `/api/me` 200, profile row in Supabase).
- **RECOMMENDED AUTH SETTINGS (same dashboard):** Auth → Sessions → Access
  Token TTL ≤ 3600 s (default) or lower for stricter post-signout revocation;
  confirm whether "Confirm email" is ON — with it ON, sign-up returns
  "check your email" until SMTP is configured (Supabase's built-in email
  service is rate-limited and production-unsuitable).

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
  Env vars:       DATABASE_URL, SUPABASE_URL, WEB_ORIGIN (the Vercel frontend
                  origin), CRON_SECRET (when a scheduler exists); optional
                  SUPABASE_CA_CERT. The API needs NO Supabase anon key
                  (JWKS verification is local). See docs/DEPLOYMENT_ENVIRONMENT.md §2
  ```

- **WHO:** NI.
- **HOW TO VERIFY (server-side, no browser):**

  ```bash
  curl -s https://<api-host>/api/v1/health
  # → {"status":"ok","service":"ticketug-api"}
  curl -s https://<api-host>/api/v1/readiness
  # → {"status":"ready","database":"ok"}   (real SELECT 1 against Supabase)
  curl -s -o /dev/null -w '%{http_code}' https://<api-host>/api/v1/docs
  # → 200
  curl -s -o /dev/null -w '%{http_code}' https://<api-host>/api/v1/users/me
  # → 401 (fail-closed, no credentials)
  curl -s -o /dev/null -w '%{http_code}' \
    https://<api-host>/api/v1/users/me -H "Authorization: Bearer <forged-token>"
  # → 401 (JWKS verification rejects forged signatures)
  ```

- **EXPECTED EVIDENCE:** the five responses above; then set Vercel `API_ORIGIN`
  to this URL (BLOCKER 2a) and confirm an authenticated frontend round-trip.

## BLOCKER 4 — Supabase security configuration check (5-minute dashboard pass)

- **WHY IT MATTERS:** TicketUG's data lives in the `ticketug` schema, which
  the API reaches with the `postgres` role. Supabase also auto-exposes the
  `public` schema via its REST Data API (PostgREST) to anyone holding the
  anon key. TicketUG leaves `public` empty, but the exposure should be
  confirmed/disabled as defense-in-depth.
- **SERVICE / DASHBOARD LOCATION:** Supabase Dashboard → Project Settings → API.
- **EXACT SETTINGS:**
  - `Exposed schemas in API` → remove `public` if it stays empty (or leave it;
    TicketUG writes nothing there).
  - Settings → API → disable "Enable PostgREST" only if no Supabase-side REST
    usage is planned (TicketUG needs none).
- **WHO:** NI.
- **HOW TO VERIFY:** `curl -s https://<ref>.supabase.co/rest/v1/ -H "apikey: <anon>" -H "Authorization: Bearer <anon>"`
  returns no `ticketug` tables (the schema is not in the exposed set).
- **EXPECTED EVIDENCE:** the REST root lists nothing from `ticketug`.

## BLOCKER 5 — Hosted browser verification pass (needs 0–3)

- **WHY IT MATTERS:** Pair 5's browser evidence comes from the local
  production stack (production-built Next + compiled API + REAL Supabase
  Postgres + a GoTrue wire-contract stand-in for auth). The hosted surfaces
  with the REAL hosted Supabase Auth remain unobserved.
- **SERVICE:** Vercel (frontend) + hosted API + Supabase (DB/Auth).
- **EXACT ACTION:** after BLOCKERS 1–3, run the standard journey matrix:
  sign-up → organizer onboarding → event → ticket types → gates → permissions →
  staff invite/accept → assignment → guest checkout → payment (simulated where
  permitted; production refuses it by design) → ticket → QR → PDF → scanner
  matrix (VALID / WRONG_GATE / ALREADY_CHECKED_IN / UNAUTHORIZED_SCANNER) at
  desktop + 390 px.
- **WHO:** NI or a future agent run with read-only dashboard access.
- **HOW TO VERIFY:** browser console free of errors; DB rows persist across
  reload and re-login; scanner decisions match the documented gate matrix
  (CONTINUITY §16/§17); PDFs download with `application/pdf; no-store`.
- **EXPECTED EVIDENCE:** screenshots + the deployment-readiness matrix in
  CONTINUITY §19 flipped from "SUPABASE/LOCAL" to "HOSTED" row by row.

## NON-BLOCKING RECOMMENDATIONS

1. **Scheduler wiring** (deployment, not code): an external cron must call
   `POST /api/v1/system/orders/expire-stale` with the `x-cron-secret` header so
   expired orders self-sweep; the lazy per-read expiry already bounds the blast
   radius until then.
2. **Add the hosted URLs** (frontend + API + Supabase project ref) to the
   internal handover log so future runs can observe the real deployments.
3. **CA rotation watch:** Supabase Root 2021 CA is pinned in
   `certs/supabase-root-2021-ca.pem` (fingerprint in `certs/README.md`). If
   Supabase ever rotates it, set `SUPABASE_CA_CERT` — no code change needed.
4. **Email delivery** (optional): SMTP for Supabase Auth emails (confirmation,
   recovery) before public launch if "Confirm email" stays enabled.
