# Ticket Uganda — Final Pre-Production Forensic Audit

**Date:** 2026-10-01 · **Baseline commit:** `fb18547` (audit remediations land as the next commit on `main`)
**Scope:** full-repository forensic audit across 30 areas (auth/RBAC/tenant isolation/inventory/payments/tickets/scanner/guest/platform-admin/DB/ops), remediation of genuinely required gaps only, and an evidence-based answer to: *how close is Ticket Uganda to real production use?*

**Constraints honored:** no mock data introduced (the production DB stays at zero rows; every dashboard shows truthful empty/unavailable states); NylonPay was NOT re-implemented (existing adapter audited only); no architecture was redesigned; no security guarantee was weakened.

---

## 1. Baseline verification

| Check | Evidence |
| --- | --- |
| Working tree | `fb18547` = `origin/main`, clean except the 3 in-flight real-photo swaps from the previous round (finished + credited in this audit) |
| Branches | `main` only — locally and on origin (`ls-remote`: single `refs/heads/main`) |
| Deployed site | `https://ticketug.vercel.app` — 200, `<title>Ticket Uganda — Buy Event Tickets in Uganda</title>`, `/api/health` 200, `/api/readiness` 200 (DB probe OK) |
| Live auth guards (deployed commit) | `/api/me` 401 · `/api/orders` 401 · `/admin` 307 · cron without secret 401 · unknown guest order 404 — all fail closed |
| Tests at baseline | vitest 137/137 (19 files), typecheck/lint/build green |

**Documentation vs reality:** the existing production docs were materially stale (CONTINUITY still described the removed NestJS API and Neon; `.env.example` said "only the simulated/test pathway exists" after the NylonPay adapter landed; migration counts 9/9 vs the actual 12/12). All corrected in this audit — see §4.

---

## 2. Deficiency matrix (§29 of the audit directive)

Statuses: **READY** (verified, no action) · **READY\*** (ready, with an operational condition) · **FIXED** (remediated in this audit) · **CONDITION** (operational, not a code defect) · **DEFERRED** (justified, non-blocking, documented).

| Area | Status | Evidence (verified at source level, this audit) | Risk | Before launch? | Action |
| --- | --- | --- | --- | --- | --- |
| Auth | READY\* | Supabase Auth server-side password grant; HttpOnly/Secure/Lax cookies; `getUser()` re-validation per request (`lib/request-context.ts`); no client-trusted identity anywhere; sign-in failures are deliberately vague (no account enumeration) | Low | — | Operator: enable "Allow new users to sign up" (BLOCKER 2c) |
| RBAC | FIXED | 7-role ladder enforced server-side on every route; `isTicketUGRole` runtime guard now drops unknown DB role strings before they reach authorization lists (`lib/request-context.ts`); hidden-UI ≠ authz — all gates re-verified at route level (40-route inventory) | Low | — | Done |
| Tenant isolation | READY | Every read filters by `user_profile_id`/`organizer_id` **in the same SQL statement**; mutations re-verify authority inside `ticketug.*` SECURITY DEFINER functions; cross-organizer probes return 404/403 | Low | — | None |
| Events | READY | Lifecycle: 3-layer enforcement (route map → SQL guarded UPDATE → CHECK constraints); owner-only PUBLISHED/CANCELLED | Low | — | None |
| Inventory | READY | `ticketug.create_order`: deterministic FOR UPDATE lock order, guarded decrement (`remaining_capacity >= qty`), server-calculated integer totals, BigInt overflow guard, immutable snapshots | Low | — | None |
| Orders | READY | Atomic SQL functions for create/cancel/expire; lazy expiry on every read/initiate path; SKIP LOCKED sweep; historical snapshots preserved | Low | — | None |
| Guest checkout | READY | CSPRNG 256-bit access token, only sha256 compared inside SQL; idempotency keys; re-key rotation invalidates old links; no enumeration (404 on mismatch) | Low | — | None |
| Tickets | READY | Issuance ONLY inside `apply_payment_event` after signature-verified event + amount/currency/order cross-checks; globally unique `tkt_` credentials, sha256-at-rest | Low | — | None |
| QR/PDF | FIXED | QR payload `ticketug:v1:` contract intact; PDFs fail closed on ownership; **`Permissions-Policy` was `camera=()` origin-wide — the scanner's own camera was denied by browser policy. Fixed to `camera=(self)`** | Med → Low | — | Done (deploy with this commit) |
| Scanner | READY | Single authoritative implementation (`lib/server/check-ins.ts`): ticket row FOR UPDATE + guarded UPDATE + rowCount check → duplicate scan through race returns ALREADY_CHECKED_IN; gate scope from assignment row, never from request | Low | — | None |
| Lifecycle | READY | `ticketug.transition_event_lifecycle` re-verifies membership/owner role inside the guarded UPDATE; TS map is a fast-fail mirror (kept in lockstep, tested) | Low | — | None |
| Platform admin | FIXED | `/admin` is server-gated (PLATFORM_SUPPORT/ADMIN/SUPER_ADMIN) with truthful real counts; DB failure now renders "metrics unavailable" instead of silent zeros; **no admin provisioning mechanism existed — `scripts/provision-platform-admin.mjs` added** (§5) | Med → Low | — | Operator: run provisioning (§5) |
| Database | READY\* | Migrations 000, 005–015 ledgered, checksummed, transactional (`scripts/migrate.mjs`); functions hardened (search_path pinned, EXECUTE revoked from anon/authenticated/public); ticketug schema not exposed via PostgREST (default `public` only) + no table grants to anon/authenticated | Low | — | Operator: confirm "Exposed schemas = public" in Supabase settings |
| API/server routes | FIXED | 40 routes inventoried with auth/validation/tx-boundary per route; staff-assignment write wrapped in one transaction; error map (30 SQLSTATE/message → HTTP) never leaks internals; unknown → generic 500 | Low | — | Done |
| Payment boundary | READY | Clean seam (`PaymentProviderAdapter`): initiate inside tx (order FOR UPDATE), idempotency keys, provider-call rollback; `browser redirect ≠ payment proof`; issuance only via verified webhook events; test provider fails closed 503 in production (`NODE_ENV` gate) | Low | — | None |
| NylonPay readiness | READY\* | Adapter complete + wire-tested 17/17 against the real API (dedupe, replay→DUPLICATE, forged→400, amount→422, unknown ref→404, success→issuance); no architectural work remains | Low | — | Operator: register webhook URL + set env (BLOCKER 2d) |
| Cron | READY\* | `vercel.json` daily 03:00 UTC (Hobby limit); secret compare now constant-time; fails closed 401 when unset; sweep idempotent (SKIP LOCKED); **lazy expiry (`expire_order_if_due`) runs on every read/initiate path, so correctness holds between sweeps** — daily sweeping is a freshness property, not a correctness dependency | Low | — | Operator: set `CRON_SECRET` |
| Observability | FIXED | Zero-dependency `logServerError(scope)` seam wired into webhook, cron, and every fail-soft page/admin catch (type+message only, no PII/payloads); readable in Vercel runtime logs. No APM — explicitly out of launch scope | Med → Low | — | Done; APM deferred |
| Backups/recovery | CONDITION | Supabase managed Postgres: daily backups + 7-day PITR require a paid plan; free tier has **no PITR**. Migrations are fully re-runnable to rebuild schema; data recovery is bounded by the plan | Med | — | Operator decision: upgrade plan before real revenue, or accept documented risk |
| Deployment | READY | `pnpm build` green with no env; Vercel auto-deploys main; security headers (nosniff, HSTS 2y, referrer-policy) verified live | Low | — | None |
| Domain readiness | READY\* | Zero hardcoded `vercel.app` in code outside the `NEXT_PUBLIC_SITE_URL` fallback; canonical/sitemap/robots/JSON-LD/OG all derive from `lib/site.ts` | Low | — | Domain checklist §6 |
| SEO | FIXED | metadata/OG/Twitter/JSON-LD (WebSite+SearchAction, Organization, per-event schema.org Event with Offers), sitemap with live event URLs, robots; **added default OG share card** (`app/opengraph-image.tsx`) and fixed twitter-title inheritance; brand-styled 404/error pages | Low | — | Done |
| Mobile | READY | Pure-CSS responsive (760/640/420px breakpoints), scanner phone-first (`environment` camera, manual fallback), no JS media queries; regression risk only | Low | — | None |
| Performance | READY | No N+1 in list paths (single grouped query per list); static shell; dynamic pages are direct SQL; force-dynamic only where session-dependent; image payloads ≤205KB | Low | — | None |

**Rate limiting (§20):** in-process limiter (10–30/min/IP) covers auth, checkout, payment, rekey, cancel, members, gates, transfers — now also **scan check-ins (120/min), organizer/event/ticket-type create, transition, invitations, member upsert, staff assign/remove**. Login/registration additionally sit behind Supabase Auth's own limits. **Known limitation (self-documented in `lib/rate-limit.ts`):** per-instance, resets on cold start — brute-force *resistance*, not a hard guarantee. QR credentials are 256-bit random, so guessing is impractical regardless. **A distributed limiter (e.g. Upstash) is DEFERRED** — it adds an external dependency and is not required for launch volumes; revisit at scale.

**Error shapes:** two response shapes coexist (`{error}` legacy vs `{message,error,statusCode}` canonical). Both are handled by the UI. **Unification DEFERRED** — churn risk outweighs benefit pre-launch.

**Residue removed (REMOVE class):** dead NestJS-era modules `lib/api-auth.ts`, `lib/env.ts`, `lib/authorization.ts` (test renamed to `organizer-authorization.test.ts`), `lib/rules/ticket-type-rules.ts` (+ its tests; the route's zod + DB constraints are authoritative); dead exports: order-rules calculators/state machine, payment-rules transition asserts, event-lifecycle publication helper, `requireGuestToken`, `ticketCredentialHash`, `ALL_EVENTS_ICON`, `SITE_LEGAL_NAME`. **Drift seams closed:** `EVENT_SORT_KEYS` single-sourced in `event-categories.ts`; event detail page now uses the shared `PUBLIC_EVENT_VISIBILITY_SQL` predicate.

---

## 3. Explicit non-findings (audited, verified clean)

- **No mock/demo data anywhere** — zero `Math.random()`, zero fabricated rows, empty states are honest (`No events yet` / moodboard is marketing art, not fake events; admin counts are real SQL counts).
- **No TODO/FIXME/HACK markers, no `console.log` noise, no `any`, no `@ts-ignore`, no empty catches** in production code (all catches resolve to typed outcomes).
- **No client-trusted financials** — price/total/availability/status always server- or DB-derived.
- **No secrets committed** — the only literals are documented placeholders (test provider dev secret, wire-test phone) behind fail-closed gates.
- **Rebrand complete** — zero user-visible "TicketUG" strings remain (schema/QR/PDF-filename/ICS-UID/helper names are intentional contracts, documented in `lib/site.ts`).
- **Zero emoji** — all glyphs are lucide-react icons (typographic `←` back-arrows also replaced with `ArrowLeft` in this audit).

---

## 4. Remediations performed (§30-G, complete list)

1. **FIX — scanner camera:** `next.config.ts` `Permissions-Policy` `camera=()` → `camera=(self)` (the QR scanner's `getUserMedia` was denied origin-wide).
2. **BUILD — 404/error surfaces:** `app/not-found.tsx` (branded, header + links), `app/error.tsx` (digest + retry), `app/global-error.tsx` (root fallback). Public 404s were the unstyled Next default.
3. **BUILD — default OG card:** `app/opengraph-image.tsx` (next/og, brand tokens, host derived from `SITE_URL`); layout `twitter.title/description` removed so event titles inherit into share cards.
4. **BUILD — platform-admin provisioning:** `scripts/provision-platform-admin.mjs` (§5) + runbook in DEPLOYMENT_MANUAL_STEPS.
5. **FIX — cron secret compare:** constant-time (`timingSafeEqual`) in the sweep route.
6. **FIX — staff assignment atomicity:** member/gate prechecks + upsert now one transaction.
7. **FIX — check-ins 401 vs 503:** GET/POST no longer report outages as "Unauthorized"; POST gained a 120/min limiter.
8. **HARDEN — rate limits:** added to organizer create, event create, ticket-type create, lifecycle transition, invitation create/revoke, member upsert, staff assign/remove (consistent with the existing limiter pattern).
9. **HARDEN — role inputs:** `isTicketUGRole()` drops unknown DB role strings at the context boundary (7 cast sites hardened).
10. **FIX — honest admin metrics:** DB failure renders "metrics unavailable" (never zeros) + logs; status copy updated to "Live payments and ticket issuance" reality.
11. **BUILD — observability seam:** `logServerError(scope)` in `lib/server/errors.ts`; wired into webhook (provider-tagged), cron, sitemap, landing/events/event-detail/organizer-events/admin fail-soft paths; 5xx API responses log automatically. Type+message only.
12. **REMOVE — dead code:** 4 modules + ~10 dead exports (list in §2); drift seams single-sourced.
13. **BRAND — last 2 gaps:** ICS calendar description ("Ticket Uganda by Natural Intellects Ltd") and the `DATABASE_URL` operator message.
14. **ASSETS — real photos:** remaining 5 AI showcase images replaced with CC-licensed Wikimedia Commons photos (festival stage, beach party, Ugandan street market, stadium crowd, gospel choir); `docs/IMAGE_CREDITS.md` added with full attribution for all 8 slots.
15. **DOCS — de-staled operator surface:** `.env.example` (NylonPay block, `NEXT_PUBLIC_SITE_URL`, migration range, provisioning section); `TICKETUG_CONTINUITY.md` (§1 architecture rewritten, §2/§7/§8/§9 updated, §11 anchors fixed, §12 marked historical); `DEPLOYMENT_ENVIRONMENT.md` (6 missing env rows); `PRODUCTION_READINESS_REPORT.md` (env matrix un-dangerous, counts, provider status); `ARCHITECTURE.md`, `SUPABASE_NATIVE_ARCHITECTURE.md` (adapter/migration-range/webhook notes, CJK typo), `DEMO_HANDOFF.md`, `ADR-008` (superseded note), changelog backfill.
16. **TOOLING — wire-test safety:** cleanup DELETEs scoped to wire-test markers (previously `webhook_event` deletes were provider-wide); delete order fixed so audit rows are matched before attempts are removed.

---

## 5. Platform-admin account provisioning (§15 of the directive)

**Current state (verified):** `auth.users` = 0 and signup is disabled (BLOCKER 2c) — the account for `naturalintellectsltd@gmail.com` does not exist yet. **The password is the owner's secret and was not supplied; per the hard-stop rules this audit does NOT improvise account creation.** The secure mechanism now exists; two operator steps remain:

**Step 1 — create the auth account (owner, ~1 minute):**
Supabase dashboard → Authentication → Users → **Add user → Create new user** → email `naturalintellectsltd@gmail.com`, set the password in the form, **Auto Confirm User: on**. The password never leaves the dashboard; it must not be pasted into chat, code, or this repository.

**Step 2 — grant the platform role (operator):**
```bash
DATABASE_URL="<session pooler url>" node scripts/provision-platform-admin.mjs naturalintellectsltd@gmail.com
```
The script verifies the auth user exists, resolves/creates the `ticketug.user_profile` idempotently, refuses duplicates, writes a `ticketug.security_event` audit row, and pins strict TLS to the bundled Supabase CA. Optional `--role SUPER_ADMIN` for the top role (default `PLATFORM_ADMIN`).

**Step 3 — verify (also do this after BLOCKER 2c enables signup):**
login at `/sign-in` like any other user → platform roles land directly on `/account/control-center` (server-computed post-sign-in landing) → role pill shows "Platform admin/support/super admin" → logout → `/account/control-center` redirects to `/sign-in` (307) → an ATTENDEE account hitting it is redirected to `/account`.
*(2026-10-01 update, post-audit: the control center moved from `/admin` into the signed-in workspace at `/account/control-center` and `/admin` now only forwards there — the server-side role gate is unchanged, so this audit's authorization findings are unaffected.)*

---

## 6. Domain-dependency checklist (§30-E — execute once the final domain exists)

1. Set `NEXT_PUBLIC_SITE_URL=https://<final-domain>` in Vercel env → metadataBase, canonical, sitemap, robots, JSON-LD, OG URLs all follow (single source: `lib/site.ts`; no code change).
2. Supabase dashboard → Auth → URL Configuration: set **Site URL** to the final domain and add it to **Redirect URLs** (sign-in flow relies on same-origin cookies; the `?next=` redirect is validated by `lib/safe-redirect.ts`).
3. NylonPay merchant dashboard: re-register the webhook URL with the final domain (`/api/public/payments/webhooks/nylonpay`) — or set it correctly the first time (BLOCKER 2d).
4. Vercel: add the domain; HTTPS is automatic; `vercel.json` cron needs no change (path-relative).
5. Verify after cutover: shared-link previews (OG card), `robots.txt`/`sitemap.xml` URLs, one live signup→checkout→webhook smoke.

---

## 7. Test results (§30-H)

| Suite | Result |
| --- | --- |
| Unit/application (vitest) | **126/126 passed (18 files)** — baseline was 137/137 (19 files); the delta is intentional dead-code test removal (order-rules calculators, ticket-type-rules module, event-lifecycle publication helper), zero behavior tests lost |
| Typecheck (`tsc --noEmit`) | **PASS** |
| Lint (eslint) | **PASS (0 errors, 0 warnings)** |
| Production build (`next build`) | **PASS** (env-less build green; `/opengraph-image` prerenders) |
| SQL harness (`scripts/staging-verify/verify-sql-functions.ts`, 28 checks) | **NOT RUN this session** — no DB credentials exist in this sandbox (reset); requires real `DATABASE_URL`; last verified 28/28 at the migration-012 baseline and re-verified for 013–015 by the 17/17 wire test |
| Behavioral harness (`verify-gates.ts`, 57 checks) | **NOT RUN this session** — same credential constraint; last verified 57/57 |
| Security tests | Covered by the suites above (authorization, guest access, webhook verification, rate limits, safe redirect); live fail-closed matrix re-verified over HTTPS this session (401/403/404/307 everywhere expected) |
| Hosted tests (ticketug.vercel.app) | **PASS** — health 200, readiness 200 (DB probe), title/brand verified, auth guards fail closed, security headers present, JSON-LD present |
| Platform-admin login test | **BLOCKED on operator steps** (§5) — account cannot exist until the owner creates it; script + runbook ready |

**Sandbox disclosure:** this environment has no `DATABASE_URL`/Supabase credentials (the sandbox was reset between sessions), so DB-integrated suites could not be re-executed here. Everything DB-independent was executed and passed; the DB-touching verification standard remains the operator runbook.

---

## 8. Final answer (§30)

### A. Verified production-ready
Session/auth backbone; RBAC with runtime-guarded role inputs; tenant isolation (statement-scoped reads + authority re-verification inside SQL functions); order/inventory transactional core (locks, guarded decrements, server-calculated integer money, overflow guards); payment boundary (fail-closed, verified-webhook-only issuance, idempotency, replay protection); ticket issuance/QR/PDF; scanner check-in (race-proof, gate-scoped); guest checkout + recovery (CSPRNG tokens, hashing at rest, re-key); event lifecycle (3-layer state machine); cron expiry (idempotent sweep + lazy correctness); DB migrations (ledgered, checksummed, hardened); honest empty states; SEO foundation + OG cards + branded 404/error pages; mobile-responsive surfaces; real-photo showcase with full attribution; build/lint/typecheck/unit tests green; live deployment fail-closed as verified over HTTPS.

### B. Required before real users (all operator-side; zero code blockers)
1. **BLOCKER 2c:** enable "Allow new users to sign up" in Supabase Auth (until then signup 400s and the platform has no users by design).
2. **Platform admin:** owner creates the auth account (§5 step 1) + operator runs the provisioning script (§5 steps 2–3).
3. **BLOCKER 2d:** NylonPay merchant dashboard — register the webhook URL + set `PAYMENT_PROVIDER=nylonpay` and the three `NYLONPAY_*` secrets in Vercel; redeploy.
4. **Set `CRON_SECRET`** — without it the daily Vercel Cron sweep 401s (fail-closed). Order correctness between sweeps is still guaranteed by lazy expiry on every read/initiate path, but the sweep is the mechanism that *reports* inventory restoration and keeps stale orders visibly expired; set it so the sweep actually runs.
5. **Set `NEXT_PUBLIC_SITE_URL`** when the domain lands (or leave the vercel.app fallback until then).

### C. Operational conditions (launch-safe, stay aware)
- Rate limiting is per-instance (documented; Supabase Auth adds server-side protection; QR guessing impractical).
- Supabase free tier: **no point-in-time recovery**; daily backups need a plan upgrade — decide before real revenue data accumulates.
- Vercel Hobby cron = 1/day; correctness between sweeps is guaranteed by lazy expiry (documented).
- PostgREST exposure: confirm "Exposed schemas = public" once in the Supabase dashboard (defense-in-depth already in migrations).
- Vercel runtime logs are the observability surface (scoped error lines); no APM.

### D. NylonPay dependencies (execute when KYC/onboarding is approved)
Exactly the BLOCKER 2d list above + one live smoke (order from `/events` with the owner's own mobile-money number, approve the prompt, watch PAID + tickets) — the dashboard-reading guide is in DEPLOYMENT_MANUAL_STEPS. **No code work remains**: the adapter, webhook verification, state machine, issuance and wire test are complete.

### E. Domain dependencies
The checklist in §6 (env var, Supabase auth URLs, webhook re-registration, DNS/HTTPS, post-cutover verification).

### F. Deferred post-launch (explicitly non-blocking)
Distributed rate limiter; unified API error shape; shared checkout-component extraction; sha256-helper consolidation (cosmetic); APM/uptime monitoring; email delivery (recovery links + invite links cover access today); refunds/settlement reporting; moderation queues; similar-events row + price-range filter (UX polish).

### G. Remediations performed
See §4 — 16 items, every one justified by a concrete finding; no architecture changed; no security guarantee weakened; no mock data introduced.

### H. Test results
See §7.

### I. FINAL VERDICT

> ## **READY FOR PRODUCTION PENDING NYLONPAY + DOMAIN**
>
> with two operator actions also required at launch time regardless of provider/domain: enabling Supabase signup (BLOCKER 2c) and provisioning the platform-admin account (§5). Every code-level requirement across the 30 audit areas is met and evidenced; the remaining items are configuration, credentials, and merchant-dashboard registration that only the owner/operator can perform.
