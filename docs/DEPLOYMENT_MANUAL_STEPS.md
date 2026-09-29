# TicketUG — manual deployment steps requiring NI account access

> Production-gate revision (2026-09-29). The separately hosted NestJS API was REMOVED —
> the deployment shape is now **Vercel (Next.js) + Supabase only** (the old
> BLOCKER 3 "host the API" is obsolete). Every Pair 5/5.1 claim was
> independently re-verified against the real Supabase project, the Pair 6
> migration was verified end-to-end (57-check behavioral harness + 28-check
> SQL-function matrix + full guest journey) against the real database, and the
> production gate re-ran the full harness suite + local build pipeline.
> **BLOCKER 2a now carries the NEW Supabase API-key configuration**
> (`sb_publishable_…` → `SUPABASE_ANON_KEY`; do NOT add `sb_secret_…`).
> **Do not paste secret values into chat/Git** — set them in the provider's
> secret store.

## STATUS SNAPSHOT

```text
SUPABASE VERIFIED — Postgres (session pooler, strict TLS, pinned CA fingerprint
                    re-matched), migrations 000→012 (ledger 9/9, idempotent),
                    SQL functions (28/28 checks incl. 6-way concurrent
                    oversell barrier), behavioral harness (57/57: issuance via
                    the signed webhook core, full scanner/gate matrix, CASCADE
                    fail-closed, DB-backed PDFs), production-build browser
                    journey (guest checkout → payment → tickets → QR → PDF;
                    desktop + 390 px; console clean)
BLOCKED           — GitHub push (BLOCKER 0 — no credentials in the agent
                    environment), Vercel production deploy (BLOCKERS 1–2),
                    hosted Supabase Auth live flows (BLOCKER 2b — anon key),
                    hosted browser pass (BLOCKER 5)
OBSOLETE          — the old BLOCKER 3 (host apps/api): Pair 6 removed the
                    separate API host; Vercel + Supabase is the entire stack
```

---

## BLOCKER 0 — Push the pending commits to GitHub (gates everything else)

- **WHY IT MATTERS:** Vercel deploys FROM GitHub. `origin/main` = `16bc73d`
  (Pair 3); the Supabase migration + the Pair 6 Supabase-native backend live
  in local commits (`a53fe34`, `f8b22d5`, `7bd1c11`, + the Pair 6 commit).
- **SERVICE:** GitHub → repository `naturalintellectscrop-ctrl/TicketUG`
  (private — keep it private).
- **EXACT ACTION (any machine with NI's GitHub credentials):**

  ```bash
  git clone git@github.com:naturalintellectscrop-ctrl/TicketUG.git   # or HTTPS w/ PAT
  cd TicketUG
  git pull origin main
  # obtain the local commits from the agent sandbox (bundle or patch series), then:
  git push origin main
  git log origin/main -1                     # must print the Pair 6 commit
  ```

  A GitHub fine-grained PAT with **Contents: Read/Write** on this one
  repository is sufficient (supplied via the environment, never pasted into
  source).
- **WHO:** NI (repository owner).
- **HOW TO VERIFY:** `git ls-remote origin main` shows the Pair 6 tip; the
  commits appear with Natural Intellects Ltd authorship
  (`naturalintellectsltd@gmail.com`).

## BLOCKER 1 — Vercel Production Branch

- **SERVICE / DASHBOARD LOCATION:** Vercel → TicketUG project → Settings → Git.
- **EXACT SETTING:** `Production Branch` → **`main`**.
- **HOW TO VERIFY:** Deployments → latest Production deploy shows branch
  `main` at the pushed tip (the old stale `cron/round-10-settings` target must
  no longer be referenced).

## BLOCKER 2a — Vercel environment variables (NEW Supabase API keys)

- **SERVICE / DASHBOARD LOCATION:** Vercel → Project → Settings → Environment
  Variables (Production + Preview + Development as desired; Production is
  what matters).
- **WHERE THE VALUES COME FROM:** Supabase Dashboard → Project Settings →
  **API Keys** — the NEW key system: **Publishable key** (`sb_publishable_…`)
  and **Secret keys** (`sb_secret_…`). Copy values with each row's copy
  button; never paste them into chat, Git or docs.
- **EXACT SETTINGS** (full reference: `docs/DEPLOYMENT_ENVIRONMENT.md`):

  ```text
  DATABASE_URL           = <Supabase session-pooler URL>   (Project Settings →
                                                           Database → Connect;
                                                           unchanged by the key
                                                           migration)
  SUPABASE_URL           = https://vmebmexwqfpnlioicqgj.supabase.co
  SUPABASE_ANON_KEY      = sb_publishable_…                (the NEW publishable
                                                           key — this variable
                                                           name is the slot the
                                                           app reads; its role
                                                           IS the publishable
                                                           key)
  CRON_SECRET            = <long random string>            (guards the expiry
                                                           sweep; e.g. openssl
                                                           rand -hex 32)
  PAYMENT_WINDOW_MINUTES = 15 (optional)
  ```

  **Environment column:** tick Production (and Preview/Development if wanted).
  **Do NOT add any `NEXT_PUBLIC_` variable** — the browser never talks to
  Supabase directly in this architecture; every Supabase/auth call is
  server-side inside Next.js.
  **Do NOT set `SUPABASE_SECRET_KEY` (sb_secret_…)** — the application has no
  code path that uses privileged Supabase REST access; all privileged work
  terminates in PostgreSQL via `DATABASE_URL` (SECURITY DEFINER functions).
  Adding it would only widen the secret surface.
  Do NOT set `API_ORIGIN` (obsolete since Pair 6 — there is no API host any
  more). Do NOT set `PAYMENT_MODE` or `PAYMENT_PROVIDER` in Production —
  their absence IS the production payment fail-closed boundary
  (503 TEST_PAYMENT_DISABLED).
- **AFTER SAVING:** Deployments → ⋯ on the latest Production deploy →
  **Redeploy** (env-var changes do not apply to already-built deployments).
- **HOW TO VERIFY (after deploy):** `/events` shows real event rows;
  sign-up works (`sb-<ref>-auth-token` cookie, HttpOnly + Secure);
  `POST /api/public/orders/…/payment/test-complete` → 503 TEST_PAYMENT_DISABLED.

## BLOCKER 2b — Enable live Supabase Auth verification (NEW publishable key)

- Copy the NEW **publishable key** (`sb_publishable_…`) from Supabase
  Dashboard → Project Settings → **API Keys** into Vercel `SUPABASE_ANON_KEY`
  (secret store only; the app passes it to `@supabase/ssr` server-side).
  Supported natively by `@supabase/ssr@0.12.7` / `@supabase/supabase-js@2.117.2`
  — no code change required. Verify:

  ```bash
  curl -s "https://vmebmexwqfpnlioicqgj.supabase.co/auth/v1/health" -H "apikey: sb_publishable_…"
  # → {"version":"...","name":"GoTrue",...}
  ```

- Legacy `anon` / `service_role` JWT keys are NOT needed by this application;
  once Vercel runs on the publishable key they can be retired in the Supabase
  dashboard (do this only AFTER the hosted auth pass is green).
- Recommended dashboard settings: Auth → Sessions → Access Token TTL ≤ 3600 s;
  confirm "Confirm email" state (SMTP before public launch if enabled).

## BLOCKER 4 — Supabase security configuration check

- **SERVICE / DASHBOARD LOCATION:** Supabase Dashboard → Project Settings → API.
- **VERIFY:** `Exposed schemas in API` — `ticketug` must NOT be listed
  (SQL already proves the `anon` role holds zero privileges on it);
  optionally remove `public` if it stays empty (TicketUG writes nothing there).
- **EXPECTED EVIDENCE:** `curl -s https://vmebmexwqfpnlioicqgj.supabase.co/rest/v1/ -H "apikey: <anon>" …`
  lists nothing from `ticketug`.

## BLOCKER 5 — Hosted browser verification pass (needs 0–2b)

- Run the standard journey matrix against the hosted deployment: sign-up →
  organizer onboarding → event → ticket types → gates → staff → guest checkout
  → payment boundary (production refuses simulation) → ticket → QR → PDF →
  scanner matrix at desktop + 390 px; console clean.
- Server-side parity is already proven (57/57 + 28/28 + guest journey vs the
  real database); the hosted pass flips CONTINUITY §21's BLOCKED rows to HOSTED.

## NON-BLOCKING RECOMMENDATIONS

1. **Expiry sweep — WIRED (production gate):** `vercel.json` schedules
   Vercel Cron **daily at 03:00 UTC** against
   `/api/system/orders/expire-stale` (the most frequent cadence the Vercel
   Hobby plan permits — more frequent schedules reject the deployment).
   This is safe by design: every order/payment READ path already lazily
   expires due orders (`ticketug.expire_order_if_due` in the order and
   payment flows), so the cron is only a background backstop for orders
   nobody ever touches again. The route accepts both `x-cron-secret`
   (operator/external schedulers) and Vercel Cron's automatic
   `Authorization: Bearer <CRON_SECRET>`; it stays fail-closed (401) when
   `CRON_SECRET` is unset. **To tighten the cadence to every 5 minutes:**
   upgrade the Vercel project to Pro and change the schedule to `*/5 * * * *`,
   or point an external scheduler (cron-job.org, GitHub Actions) at the same
   endpoint with `x-cron-secret: <CRON_SECRET>` — no code change needed.
2. **CA rotation watch:** Supabase Root 2021 CA pinned in
   `certs/supabase-root-2021-ca.pem` (fingerprint in `certs/README.md`); if
   rotated, set `SUPABASE_CA_CERT`.
3. **Email delivery:** SMTP for Supabase Auth emails before public launch if
   "Confirm email" stays enabled.
