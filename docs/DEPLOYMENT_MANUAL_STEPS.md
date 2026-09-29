# TicketUG — manual deployment steps requiring NI account access

> Pair 6 revision (2026-09-29). The separately hosted NestJS API was REMOVED —
> the deployment shape is now **Vercel (Next.js) + Supabase only** (the old
> BLOCKER 3 "host the API" is obsolete). Every Pair 5/5.1 claim was
> independently re-verified against the real Supabase project, and the Pair 6
> migration was verified end-to-end (57-check behavioral harness + 28-check
> SQL-function matrix + full guest journey) against the real database.
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

## BLOCKER 2a — Vercel environment variables

- **SERVICE / DASHBOARD LOCATION:** Vercel → Project → Settings → Environment
  Variables (Production + Preview).
- **EXACT SETTINGS** (full reference: `docs/DEPLOYMENT_ENVIRONMENT.md`):

  ```text
  DATABASE_URL           = <Supabase session-pooler URL>   (the one NI supplied)
  SUPABASE_URL           = https://vmebmexwqfpnlioicqgj.supabase.co
  SUPABASE_ANON_KEY      = <publishable key>               (see BLOCKER 2b)
  PAYMENT_WINDOW_MINUTES = 15 (optional)
  ```

  Do NOT set `API_ORIGIN` (obsolete since Pair 6 — there is no API host any
  more). Do NOT set `PAYMENT_MODE` or `PAYMENT_PROVIDER` in Production.
- **HOW TO VERIFY (after deploy):** `/events` shows real event rows;
  sign-up works (`sb-<ref>-auth-token` cookie, HttpOnly + Secure);
  `POST /api/public/orders/…/payment/test-complete` → 503 TEST_PAYMENT_DISABLED.

## BLOCKER 2b — Enable live Supabase Auth verification

- Unchanged from Pair 5: copy the **anon/publishable** key from Supabase
  Dashboard → Project Settings → API into Vercel `SUPABASE_ANON_KEY`
  (secret store only). Verify:

  ```bash
  curl -s "https://vmebmexwqfpnlioicqgj.supabase.co/auth/v1/health" -H "apikey: <anon key>"
  # → {"version":"...","name":"GoTrue",...}
  ```

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

1. **Scheduler wiring:** an external cron calling
   `POST /api/system/orders/expire-stale` with `x-cron-secret: <CRON_SECRET>`
   so expired orders self-sweep (lazy per-read expiry already bounds the blast
   radius).
2. **CA rotation watch:** Supabase Root 2021 CA pinned in
   `certs/supabase-root-2021-ca.pem` (fingerprint in `certs/README.md`); if
   rotated, set `SUPABASE_CA_CERT`.
3. **Email delivery:** SMTP for Supabase Auth emails before public launch if
   "Confirm email" stays enabled.
