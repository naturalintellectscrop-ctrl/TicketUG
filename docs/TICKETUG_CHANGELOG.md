# TicketUG Changelog (append-only)

> Every significant implementation run appends one entry: date · commit · objective · changes · tests · verification · known limitations · next step.
> Newest entries at the bottom. Never rewrite or delete entries.
> Pre-cron history (original team, phases 3–11): see `docs/PHASE_*.md`. Backfill of the 2026-09-26 cron rounds below is summarized from the sandbox handover log.

---

## 2026-09-26 — Cron round 1 · `f0559da`
- **Objective:** restore a broken baseline and unblock check-in.
- **Changes:** test-suite integrity restored; check-in schema correctness; guest payment 401 guard gap; migration 008 constraint repair; public event sold-out logic + checkout CTA; event staff assignment API + UI; scanner event visibility; sign-out button.
- **Tests:** root 24/1 after repair (baseline re-established). **Verification:** suite + typecheck + lint green.
- **Limitations:** DB-level verification still pending real Neon env.
- **Next:** lifecycle controls.

## 2026-09-26 — Cron round 2 · `43e4392`
- **Objective:** event lifecycle reachable from the product surface.
- **Changes:** lifecycle transition controls + thin Next→NestJS transition proxy (ADR-0004); guest order sale-window enforcement; issued-tickets PII gate (OWNER/MANAGER); ticket-type creation discoverability.
- **Tests:** suites green. **Verification:** suite level.
- **Next:** expiry.

## 2026-09-26 — Cron round 3 · `e53c687` + `84fba51`
- **Objective:** order/payment expiry correctness without operator intervention.
- **Changes:** `payment_expires_at` on both creation paths; transactional expiry engine (FOR UPDATE / SKIP LOCKED, guarded inventory restore, payment state machine asserts); operator sweep endpoint `POST /api/v1/system/orders/expire-stale` (x-cron-secret, fails closed); lazy single-order expiry on read paths; organizer sales summary (spec §19); payment-window UX copy.
- **Tests:** +3 rules tests → root 24/1, api 20/1. **Verification:** suite level.
- **Limitations:** sweep must be scheduled externally (deployment wiring).
- **Next:** guest orders.

## 2026-09-26 — Cron round 4 · `174f915`
- **Objective:** guest order lifecycle end-to-end.
- **Changes:** guest order status page (countdown, polling, status pills); guest self-service cancellation (token-authed, FOR UPDATE, guarded inventory restore, in-flight payment teardown); `assertOrderTransition` state machine guarding both cancel paths; lazy expiry on guest reads; guest ticket-list proxies; guest-create response-shape fix (was breaking payment calls); Nest production fail-closed on missing/short `BETTER_AUTH_SECRET`.
- **Tests:** +3 state-machine tests. **Verification:** suite level + runtime smoke.
- **Next:** recovery.

## 2026-09-26 — Cron round 5 · `04c4eca`
- **Objective:** guests must never lose access to a paid order.
- **Changes:** recovery links (`/guest/orders/:publicId?key=…`) with sessionStorage adoption + URL scrubbing; single-use re-key endpoint (invalidates all earlier links); zero-dependency RFC 5545 ICS builder + calendar export; centralized guest access-key storage; guest ticket page rebuild.
- **Tests:** +11 lib tests → root 38/1. **Verification:** suite level.
- **Next:** account checkout.

## 2026-09-26 — Cron round 6 · `634d827`
- **Objective:** authenticated attendee checkout.
- **Changes:** session-aware order page (prefilled, "Ordering as"); cookie-forwarding proxies POST /api/orders, GET/PATCH order status/cancel; dual-mode payment proxy (access-token header ⇒ guest path, else session path); Nest authenticated simulated-payment endpoint; account order page live actions; safe `?next=` handling (`lib/safe-redirect.ts`, internal paths only); sign-in/sign-up honour `next`.
- **Tests:** +6 → root 44/1. **Verification:** suite level.
- **Next:** invitations.

## 2026-09-26 — Cron round 7 · `5977651`
- **Objective:** close the organizer-side audit gaps.
- **Changes:** session-aware SiteHeader (anonymous vs signed-in, per-page `nextPath`); invitation management (GET list, PATCH revoke = expire-in-place — CHECK-constraint-safe) + InvitationManager UI; **invited-email binding enforced** (INVITATION_EMAIL_MISMATCH → 403; closes the documented Phase-3 takeover gap); team page roster pills; accept-page error surfacing; first runtime smoke of the app in the sandbox.
- **Tests:** +5 → root 48/1, api 23/1. **Verification:** suite + first live smoke (landing/accept/307 guards).
- **Next:** membership removal.

## 2026-09-26 — Cron round 8 · `ac1e3f3`
- **Objective:** team membership administration.
- **Changes:** `lib/members.ts` (removal DELETEs rows — CHECK-safe; authority ladder enforced for removals and role changes; FOR UPDATE row locks; OWNER_CANNOT_LEAVE; last-owner defense-in-depth; MEMBERSHIP_CHANGED audit events); PATCH/DELETE members endpoints (401/403/404/409 mapping, 10/min limits); RosterManager UI (UI can never offer a refused action); self-serve leave for non-owners; roster CSS system.
- **Tests:** +6 authority-matrix tests → root 54/1. **Verification:** suite + live smoke (401 before DB, 429 limiter, 307 redirects).
- **Limitations:** owner exit still guarded (transfer pending).
- **Next:** ownership transfer.

## 2026-09-26 — Cron round 9 · `5923a5c`
- **Objective:** ownership transfer (unlock owner exit).
- **Changes:** `assertOwnershipTransfer` + transactional `transferOwnership` (atomic owner↔manager swap, TARGET_OWNS_ORGANIZER guard mirroring one-organizer-per-owner, audit events both sides); POST transfer-ownership endpoint (auth before body parse, 10/min); RosterManager "Transfer ownership" action (distinct lime styling) with immediate role-flip refresh; OWNER_CANNOT_LEAVE copy now actionable.
- **Tests:** +3 → root 57/1. **Verification:** suite + live smoke.
- **Next:** workspace settings.

## 2026-09-26 — Cron round 10 · `85c22fc`
- **Objective:** workspace identity self-service.
- **Changes:** `/organizer/[organizerId]/settings` (identity overview: name, slug chip, member/event counts); owner-only rename (`lib/organizer-settings.ts`, immutable slug, no invented columns/events); PATCH `/api/organizers/[organizerId]` (zod, rate-limited, 401/403/404); workspaces hub rebuild (role badges, slug chips, real buttons); stale copy fixes ("later phases" text removed).
- **Tests:** +2 → root 59/1. **Verification:** suite + live smoke.
- **Limitations:** migrations 001–004 still untracked; sweeper wiring pending; no live payments.

## 2026-09-26 — Reconciliation run (Hardening Directive Phase A+B) · `(this commit)`
- **Objective:** full branch/commit reconciliation, regression re-verification, continuity files, first Phase-C core fixes. Base: main @ `85c22fc`.
- **Changes:**
  - Re-cloned sandbox; verified all 10 `cron/round-*` backup branches are ancestors of main (nothing to merge); classified `v0/ticketug-sitewide-motion` (7 commits) as SUPERSEDED with two port candidates (contact page with real NI numbers, back-navigation) — do not merge.
  - Regression re-verified the 26-item previously-fixed list: **25 VERIFIED, 1 PARTIAL, 0 regressions** (evidence in `docs/TICKETUG_CONTINUITY.md` §5–6).
  - **FIX (security):** Next-side auth secret floor — new `lib/auth-secret.ts` (pure, unit-tested) now enforces the same ≥32-char production fail-closed rule as `apps/api/src/auth/neon-auth.ts`; `lib/auth.ts` uses it. Closes the one PARTIAL.
  - **FIX (copy):** order page no longer claims "Payment will be added in a later phase" (contradicted implemented payments) — accurate payment-window copy in both guest and account variants.
  - **FIX (admin):** removed fake nav items (non-link Users/Organizers/Events/Orders/Tickets spans) and the contradictory "Payments · unavailable" label; replaced with one honest muted note.
  - **Docs:** created `docs/TICKETUG_CONTINUITY.md` (architecture, branch reconciliation table, core gap matrix, migration status, roadmap position, must-not-undo list) and this changelog.
- **Tests:** +5 (`lib/auth-secret.test.ts`) → root **64 passed / 1 skipped**; api **23 / 1**. **Verification:** `pnpm test`, `pnpm api:test`, `pnpm typecheck`, `pnpm lint`, `pnpm api:build` all PASS.
- **Decision matrix (CASE):** architecture/auth/orders/payments/tickets/check-in = RETAIN; Next auth secret handling = REFACTOR (done); v0 branch = superseded (2 PORT candidates); PDF tickets, gate-level access, discovery page, moderation, KYC, notifications, live payments = BUILD (roadmap-gated); migrations 001–004 = BLOCKED (needs real DB).
- **Known limitations:** verification ceiling is Level 2 + live auth-guard smoke; discovery/browse surface missing; admin read-only; no runner; sandbox still lacks Neon credentials.
- **Next:** Phase C — real-env unblocking (deployment), public event discovery page, migration runner after DB snapshot access.

## 2026-09-28 — Push + full branch consolidation (user-requested) · `5e7f80b` + `f5e31de`
- **Objective:** push all work; merge all branches into main without reviving superseded content.
- **Changes:** push auth re-established on the clone (token lives in `.git/config` only — never in tracked files or logs); pushed `80f7936`; ported the two valuable v0 pieces — `/contact` page with the team's real call/WhatsApp numbers (+256752256576, +256762449504, carried verbatim) restyled for the light palette, + a Contact link in the shared session-aware SiteHeader (`.nav-always`, visible on mobile); then `git merge -s ours v0/ticketug-sitewide-motion` (`f5e31de`) — the branch is recorded as a TRUE ancestor of main while the tree stays byte-identical (superseded content NOT revived). Deliberately not taken: stale `apps/api/dist` artifacts, the superseded event-staff-assignment duplicate, unused motion-shell/back-button components, old dark-theme CSS.
- **Verification:** root 64/1, api 23/1, typecheck, lint, api:build — all green after the port.
- **State:** origin/main = `f5e31de` = local main; `git branch -r --no-merged origin/main` is EMPTY (every remote branch is merged).

## 2026-09-28 — Phase C core completion dependency audit · `(this commit)`
- **Objective:** directive-ordered dependency audit of the 20 remaining CORE production requirements BEFORE any new feature batch; determine the correct order from code, not assumptions.
- **Method:** evidence-based audit (file:line) across orders/payments/tickets/check-ins/events/auth/admin/migrations/env/tests + exhaustive absence searches (pdf, gate, moderation, kyc/agreement, notifications, refunds, settlement, ledger).
- **Deliverable:** CORE COMPLETION DEPENDENCY MATRIX (20 rows) + verified dependency chains (money / governance / access / foundation) + critical path + parallel-safe set + external blockers + numbered order — recorded in `docs/TICKETUG_CONTINUITY.md` §12.
- **Key verified facts:** issuance is webhook-only (`assertPaidOrder` requires order PAID + payment SUCCEEDED; idempotent via `ticket_issuance_event`); the provider seam is real (`PaymentProviderAdapter` + prod-refused test provider + HMAC webhook contract); the QR credential is a 256-bit opaque token (`ticketug:v1:<credential>`, sha256 lookup); the public visibility predicate EXISTS (`publication_state='PUBLIC' AND discoverable=true`, set on the PUBLISHED transition) but NO list surface exists anywhere; the scanner is event-level with `UNIQUE(ticket_id)` replay protection; platform admin is read-only with DB-seeded `platform_role`; refund/settlement/ledger/gate/moderation/KYC/notification code confirmed absent.
- **FIX (copy):** the new-event page claimed "Ticket configuration arrives in a later phase" while ticket-type creation is implemented — replaced with an accurate pointer to the event's Tickets page.
- **SINGLE NEXT BATCH (recommended):** public event discovery + visibility list architecture — shared list-query module over the existing predicate, `/events` index (SALES_OPEN first), landing "Upcoming events", honest empty states, tests. Zero external blockers.
- **Verification at `f5e31de` (re-run this round):** root 64/1, api 23/1, typecheck, lint, api:build — ALL GREEN.
- **Known limitations:** production readiness unchanged — **NOT READY** (provider GATE unresolved; Levels 3–6 unproven; 001–004 untracked; no runner). This run ships audit + docs + one copy fix; no feature batch implemented by design.

## 2026-09-28 — Feature Pair 1: public event discovery + gate-level ticket access · `(this commit)`
- **Objective:** directive Pair 1 only — (A) public discovery + shared visibility architecture; (B) gate model + scanner enforcement. Hard STOP after.
- **PART A (BUILD):** `lib/public-events.ts` — single `PUBLIC_EVENT_VISIBILITY_SQL` predicate (matches the public detail page exactly; CANCELLED/SUSPENDED remain listable per the existing lifecycle design), pure units `resolveListParams`/`escapeLikePattern`/`summarizeEventAvailability`/`mapPublicEventRow` (deterministic ordering: SALES_OPEN first, then starts_at, then id); `/events` index (search + pagination + loading/empty/error states, `force-dynamic`, honest copy); shared `components/event-card.tsx`; landing "Upcoming events" section consuming the same module (honest empty/fallback, browse-all CTA). No fake data anywhere.
- **PART B (BUILD on the RETAINED scanner):** migration `011-gates.sql` (`event_gate`, `ticket_type_gate`, `event_staff_assignment.gate_id` nullable; CASCADE on gate delete = fail-closed); `apps/api/src/check-ins/gate.rules.ts` shared pure rules imported by BOTH tiers; Nest + Next scan flows enforce gate permission server-side (the scanner's gate is derived from the authenticated staff assignment — never the client); `WRONG_GATE` outcome with permitted-gate names; staff assignment API + UI accept an optional gate scope; organizer `GateManager` UI (create/rename/enable-disable/delete gates, ticket-type ↔ gate permission chips, transactional replace-set PUT); scanner UI shows Event + Gate context and distinguishes wrong-gate from invalid/already-used.
- **FIX:** mapping gap #16 — a cancelled event now answers `EVENT_NOT_AVAILABLE` (was `UNAUTHORIZED_SCANNER`); `lib/db.ts` no longer crashes uncaught when `DATABASE_URL` is unset/misconfigured (stub pool + `connectionTimeoutMillis` + idle-error handler) — enables honest error states.
- **Deployment diagnosis (user-reported failing Vercel build):** the project is building the WRONG BRANCH (`cron/round-10-settings` @ 85c22fc) and lacks env vars — `BETTER_AUTH_SECRET` is required by design (fail-closed, ≥32 chars). Runbook in `docs/TICKETUG_CONTINUITY.md` §13; `.env.example` added. No security weakening.
- **Tests:** root 64→**97**/1 (+33: public-events, gates, gate.rules matrix incl. the directive §15 regression cases); api 23→**32**/1 (+9). **Verification:** `pnpm test`, `pnpm api:test`, `pnpm typecheck`, `pnpm lint`, `pnpm api:build` — ALL GREEN.
- **Browser (DB-less sandbox):** `/` 200 honest fallback, `/events` 200 honest error state, `/events?q=` 200, `/scanner` `/organizer` `/admin` 307 guards intact. **DATABASE VERIFICATION: BLOCKED** (migration 011 not applied; no Neon). All DB-backed journeys (real cards, gate UI, scans) explicitly blocked, not claimed.
- **Known limitations:** 011 not production-applied; gate journeys unverified beyond the pure rule matrix; the sandbox inherits a non-postgres `DATABASE_URL` from the control room (TicketUG dev must unset it).
- **STOP:** Pair 1 complete; no further features this run. Next recommended: Pair 2 = PDF tickets (+ 011 first-run DB verification when staging exists).

## 2026-09-28 — Root-route (landing page) investigation + deployment-failure correction · `(this commit)`
- **Trigger:** product review could not see the intended TicketUG marketing homepage at `/`; the previous round's "HTTP 200" evidence was judged insufficient. Targeted investigate-and-fix run; no feature pair.
- **Diagnosis (root route):** `app/page.tsx` is and has always been the marketing homepage (hero, "The rhythm" pillars, Upcoming events, organizer banner, footer) — the ONLY root page in the repo. No `src/app`, no route groups, no duplicate `page.tsx`, no `middleware.*`, no rewrites/redirects in `next.config.ts`, no `vercel.json`. Git history (`107cd31 → 888621f → 4327e73 → 6622e40 → d35735f → e91c819 → 5977651 → 3ad8873`) shows continuous evolution, NOT replacement. **Pair 1 did not regress it:** it only swapped a static "Coming together" banner for the real discovery section with try/catch isolation — the DB-less sandbox renders the full marketing page with only the events section degraded (browser-verified, snapshot + screenshot).
- **Actual cause of the "missing" homepage:** the broken Vercel deployment — Production Branch pointing at stale `cron/round-10-settings` @ `85c22fc`, and the build aborting at "Collecting page data" because `lib/auth.ts` evaluated `resolveAuthSecret()` at module import and the auth route constructed `auth.handler()` at module scope, so `next build`'s page-data collection threw `BETTER_AUTH_SECRET is required in production` before any page could deploy. The site never went down because of the landing page; no deployment went live at all.
- **Corrective action 1 (deployments):** auth is now constructed LAZILY (`getAuth()` in `lib/auth.ts`; the auth catch-all builds handlers on first request; `lib/request-context.ts` updated). The identical 32-character fail-closed check runs at request time — auth-dependent requests still fail loudly with the same error, no fallback secret, sessions cannot be forged; only the BUILD no longer requires the secret. Zero security weakening. Proven with a full `next build` under an EMPTY environment (no `BETTER_AUTH_SECRET`/`DATABASE_URL`) — green. `themeColor` moved from `metadata` to the `viewport` export (Next 16 warning gone).
- **Corrective action 2 (landing quality, directive §10):** removed the "System status" nav link that opened raw `/api/health` JSON; reworded the contradictory "No gatekeeping" hero note to the factual "Secure QR tickets, verified at the gate."; primary "Find an event" CTA now points to `/events` (marketing `/` vs discovery `/events` separation per the intended IA); added an honest "Why TicketUG" trust band (server-verified QR check-in exactly once, gate-scoped tickets, order recovery links — all shipped capabilities; no invented stats/testimonials); footer gained a Contact link. New `.trust-*` styles in `globals.css` matching the existing design language.
- **Deployment note (unchanged, still REQUIRED):** Vercel must still be switched to Production Branch `main` and given the §13 env vars; the code change only guarantees a build no longer fails merely because `BETTER_AUTH_SECRET` is unset — auth remains dead (fail-closed) until it IS set.
- **Verification:** root 97/1, api 32/1, `tsc --noEmit`, `eslint .`, api build — ALL GREEN; env-less `next build` green. Browser: `/` desktop + 390px mobile rendered fully (header/hero/pillars/events/organizers/trust/footer), zero console errors/warnings after fresh session, "Why TicketUG" anchor scrolls to the trust band, `/events` remains the separate discovery page with search + honest DB-less error state, `/sign-in` 200, `/account` `/organizer` `/admin` 307 to sign-in, `/scanner` 307 with `next=/scanner`.
- **Known limitations:** DB-backed event cards on `/` and `/events` remain UNVERIFIED (no Neon in sandbox) — honest fallbacks proven only; production readiness unchanged (NOT READY: migration 011 unapplied, provider GATE, Levels 3–6 unproven).
- **STOP:** landing-page correction complete. Pair 2 (PDF tickets) NOT started, per directive.

## 2026-09-28 — Feature Pair 2: PDF tickets + first real DB verification of gates/migration 011 · `(this commit)`
- **Objective:** Pair 2 only — (1) production PDF ticket generation; (2) first real-Postgres verification of migration 011 + gate/scanner system. Hard STOP after.
- **FEATURE 1 (BUILD on retained architecture):** pdfkit A5 ticket (brand palette, timezone-honest dates incl. multi-day, honest venue/attendee fallbacks, gate block only when gates exist, SAME `ticketug:v1:<credential>` QR via new `ticketQrPng`, "verified at entry / scans once", REAL support numbers from /contact — nothing invented); `GET tickets/:publicId/pdf` (owner) + `GET public/orders/:orderPublicId/tickets/:ticketPublicId/pdf` (guest token) with `no-store` + sanitized `ticketug-ticket-<ref>.pdf` filename; Next-tier proxies with a shared relay contract (tests cover content-type/filename/no-cache-leak); `DownloadTicketPdfButton` (single-flight, honest errors) on both ticket pages; status-honest printouts (cancelled/refunded/void "will not pass the gate", checked-in noted).
- **FEATURE 2:** `scripts/staging-verify/` harness (README + labelled stub base + rerun-safe runner with a non-local safety guard). **46/46 checks green on REAL Postgres 18** (throwaway local staging): 011 objects/indexes/CASCADEs; real issuance incl. idempotency; the full scanner decision matrix incl. WRONG_GATE with permitted-gate names, disabled-gate fail-closed, CANCELLED → EVENT_NOT_AVAILABLE, SUSPENDED scannable-by-design (documented rule), admin bypass; gate-deletion CASCADE removes permissions/assignments (former gate scanner → UNAUTHORIZED_SCANNER, never widened); real DB-backed PDFs (owner + guest + wrong-token refused).
- **TWO production-blocking bugs found by real verification and FIXED:** (1) `rowsForOrder` ORDER BY used a qualified SELECT alias (`t.ticket_type_name`) — Postgres rejects it; every real issuance would 500. (2) `OrdersService` + `TicketTypesService` missing `@Injectable()` — Nest DI injected `undefined` for the DB handle; every order/ticket-type route would 500. Both dormant until now because all DB-backed journeys were blocked.
- **Documented packaging limitation:** api dist (ESM/Bundler resolution) is not startable via `node dist/main.js` and `@neondatabase/auth/next/server` fails under strict Node resolution — E2E ran the compiled dist under tsx's resolver; recommended NodeNext/bundler fix recorded for a future pair (not rushed here).
- **Tests:** root 97→**109**/1 (+12), api 32→**41**/1 (+9); typecheck, lint, api:build, env-less `next build` — ALL GREEN; staging harness **46/46**.
- **Browser/DB E2E:** real cards on /events (incl. CANCELLED chip), guest `?key=` recovery, guest ticket page, "Download PDF ticket" click → 8.6 KB `%PDF-1.3` download with correct headers; HTTP authz matrix (403/404/404); 390px mobile verified; console clean. Authenticated-cookie PDF flow verified at service level only (no Neon Auth session in sandbox).
- **STOP:** Pair 2 complete. Payments/provider, refunds, settlement, notifications, moderation, KYC, offline scanning, hardware scanners — NOT started.

## 2026-09-28 — Feature Pair 3: API production runtime + real-browser organizer gate verification · `(this commit)`
- **Objective:** Pair 3 only — (1) fix and PROVE the API production runtime/package (`node dist/main.js`); (2) verify organizer gate management + staff assignment through a REAL browser against a REAL PostgreSQL staging DB. Hard STOP after; no payments/refunds/KYC/notifications work.
- **FEATURE 1 (CASE C — REFACTOR, minimal):** root causes reproduced, not assumed. (a) Packaging: `module: ESNext`+`moduleResolution: Bundler` emitted Node-unrunnable ESM (extensionless relative imports) and the package lacked `"type"` → `node dist/main.js` died with `ERR_MODULE_NOT_FOUND: ./app.module`; dist also shipped compiled `*.test.js` artifacts (no tsconfig exclude). (b) Auth: `@neondatabase/auth/next/server` imports `next/headers`/`next/server` — unresolvable under pnpm isolation from the API and unusable outside a Next request scope; SDK source audit proved `createAuthServer` ignores per-call `fetchOptions` and reads cookies ONLY from its injected framework `context`, so the old guard could never authenticate on a standalone Node host.
  - **Fix:** `"type": "module"` + `module/moduleResolution: NodeNext` + explicit `.js` relative extensions across `apps/api/src` (40 files; verified compatible with root typecheck/Bundler, vitest, and bun) + tsconfig `exclude` for tests (dist stops shipping them). tsc stays the only compiler — no bundler, no tsx in production, no new deps. Auth swapped to the framework-agnostic `createAuthServer` (`@neondatabase/auth/server`) with an Express/Nest `RequestContext` via `AsyncLocalStorage` (the SDK-documented adapter pattern), Set-Cookie refresh propagation, and the UNCHANGED fail-closed `BETTER_AUTH_SECRET ≥32` floor. Next-tier auth untouched.
  - **Proof:** `node dist/main.js` (NODE_ENV=production) → Nest boots; smoke matrix 8/8 — health 200, readiness 200 (real `SELECT 1`), DB-backed public event 200 with staging rows, 404/401/401 fail-closed, docs 200. Start script unchanged. Authenticated lifecycle transitions later flowed through the NEW guard in the browser journey (201s) — the rework preserves the real session contract end-to-end.
- **FEATURE 2 (real browser × real Postgres):** embedded PostgreSQL 18 staging DB (stub + verbatim 005→011); local **Better Auth engine `1.6.23`** (exact pinned dependency of `@neondatabase/auth@0.5.0-beta`) hosted as the Neon Auth stand-in on the identical wire contract (base-URL endpoints, `__Secure-neon-auth.*` cookies, same secret) — a real engine, not a mock; `scripts/local-auth-standin/` committed as reference. Full journey in agent-browser: sign-up → organizer onboarding → create event → publish → open sales (transitions proxied to the compiled API) → ticket types Regular/VIP/VVIP (201×3) → gates Main/VIP/VVIP (201×3) → rename/disable/enable (persisted, DB-verified) → permission chips Regular→Main / VIP→VIP / VVIP→VVIP (PUT×3, hard-reload UI↔DB match) → real invitation + acceptance through the UI (EVENT_STAFF ACTIVE) → staff assignment Event+Gate (201; reload + DB row confirm; reassignment propagates).
- **THREE genuine bugs surfaced only because the journey ran (FIXED):** (1) create-event form sent raw `datetime-local` strings against `z.string().datetime({offset:true})` → 400 for every organizer (fixed with the sibling form's established `toISOString()` pattern); (2) create-event SQL bound 9 params while referencing `$10` → Postgres `08P01` on every call (fixed); (3) staging stub lacked `organizer_member.updated_at` + `UNIQUE(organizer_id,user_profile_id)` and four untracked-001–004 tables (`platform_role`, `security_event`, `organizer_invitation`, `attendee_profile`) — stub corrected (app code unchanged; production Neon already has the real schema).
- **Security matrix (real sessions, browser-context):** WRONG_GATE with permitted-gate names; VALID + check_in row; ALREADY_CHECKED_IN on replay; INVALID_QR (malformed); WRONG_EVENT (other event's ticket); 403 UNAUTHORIZED_SCANNER on an event without an assignment (cross-event isolation); gate authorization follows the LIVE assignment (VIP→Main reassignment flips the same Regular ticket from WRONG_GATE to VALID); staff blocked from management routes (403); foreign gateId in assignment POST → 400; foreign ticketTypeId in permission PUT → 400 with DB unchanged; foreign-event gate create/PATCH/DELETE → 403×3; role-based UI (EVENT_STAFF sees no GateManager). Mobile 390px clean (no horizontal scroll), scanner manual-entry renders honest outcomes, browser console zero errors.
- **Verification:** root **109**/1, api **41**/1, `tsc --noEmit`, `eslint .`, api build, env-less `next build` — ALL GREEN; staging harness re-run on a separate throwaway DB with the updated stub: **46/46**.
- **STOP:** Pair 3 complete. Managed Neon Auth + Neon-hosted Postgres remain environment-blocked (local engines are contract-identical stand-ins, documented as such). Payments/provider, refunds, settlement, notifications, moderation, KYC, offline/hardware scanning — NOT started.

## 2026-09-29 — Feature Pair 4: hosted/staging deployment verification + production-path hardening · `(this commit)`
- **Objective:** Pair 4 only — (1) real hosted/staging deployment verification, (2) production-path hardening. Hard STOP after; no payments/KYC/notifications/refunds/settlement work.
- **Environment reality (determined, not assumed):** sandbox had been reset since Pair 3 — repo re-cloned fresh at exactly `16bc73d` (verified `main` = `origin/main`, clean tree; NI repo-local identity re-set). External access audit: GitHub read-only OK (push credentials absent); **Vercel/Railway/Neon: NO tokens, NO URLs anywhere in repo or handover log → hosted observation impossible.** Every hosted item classified `BLOCKED BY EXTERNAL ACCESS` with exact manual actions; **nothing local was presented as hosted verification.**
- **Staging rebuilt, production-faithful:** embedded PostgreSQL 18 (fresh instance) with **TLS 1.3 via a locally-generated CA** (`ssl=on`, `sslmode=verify-full` on the API, `ssl:{rejectUnauthorized:true}` web pool against the CA) — mirroring Neon's mandatory-TLS posture with ZERO repo code changes (the existing production SSL enforcement was discovered working as designed: plaintext local connections fail, which surfaced as the honest events error state until staging gained real TLS). Auth = the committed Pair-3 recipe: real Better Auth `1.6.23` engine on the Neon wire contract. Topology = the intended hosted topology: production Next (`next start`) ⇄ compiled API (`node dist/main.js`) ⇄ TLS Postgres.
- **API production runtime re-proven + extended (all RETAIN; zero code changes):** production smoke 8/8 (health/readiness/DB-backed endpoint/404/401/docs; literal `node apps/api/dist/main.js`); NEW readiness negative proof — dead-DB instance: `/health` 200 while `/readiness` 500 with a clean body (no stack/credentials); NEW payment-boundary proof — production runtime refuses the simulated payment with 503 `TEST_PAYMENT_DISABLED`.
- **Migrations (§8):** NO formal migration runner exists (documented as fact). Reproducibility proven: brand-new PG 18 → labelled throwaway stub → verbatim `005→011` in order → verification harness **46/46 GREEN** (011 objects/CASCADE/uniqueness; real issuance + idempotency; full scanner matrix incl. WRONG_GATE/ALREADY_CHECKED_IN/UNAUTHORIZED_SCANNER/EVENT_NOT_AVAILABLE; gate-deletion fail-closed; real DB-backed PDFs).
- **Full-stack production-mode browser journeys (real browser, real DB, real auth engine):** `/` + `/events` + event detail render DB-backed rows (timezone-honest Africa/Kampala); guest checkout → PAID → 2× ISSUED → ticket QR page → **PDF verified twice** (UI download 8,523-byte `%PDF-1.3`; in-page fetch `200/application/pdf`), wire headers `content-type: application/pdf` + `no-store` + safe filename; wrong access token → 404 (no existence leak); reload persistence cross-checked against real DB rows (UI ↔ DB agree); auth journey sign-up → session cookies → authenticated `/api/me` 200 → sign-out → 401 + cookies cleared; **fail-closed matrix at the compiled API** (forged token+JWT 401, garbage signature 401, no-cookie 401); cookie audit `HttpOnly; Secure; SameSite=Lax` + `__Secure-` prefix (7d token / 300 s session_data); CORS fail-closed (disallowed origin → no ACAO; no wildcard with credentials); guards `/scanner /organizer /account /admin` → 307; 390 px mobile no horizontal scroll with QR + PDF present; console zero errors/warnings.
- **Hardening (WS2):** secret-safety audit clean (tracked-tree key/URL scan → only localhost fallback + usage placeholders; `.gitignore` enforced via `git check-ignore`; **no `NEXT_PUBLIC_*` anywhere**; `BETTER_AUTH_SECRET` server-only; API logs + readiness errors scanned clean). NEW `docs/DEPLOYMENT_ENVIRONMENT.md` — all 17 `process.env` variables documented per tier against actual usage; one real gap fixed: `PAYMENT_TEST_WEBHOOK_SECRET` added to `.env.example` (commented). NEW `docs/DEPLOYMENT_MANUAL_STEPS.md` — 5 blockers (Vercel production branch → `main`; Vercel env vars; API hosting incl. exact start command + curl proofs; `011-gates.sql` application to staging Neon; hosted browser pass), each with dashboard path, setting, expected value, verification command, expected evidence; plus non-blocking recommendations (migration runner, scheduler wiring, recording hosted URLs).
- **Vercel path:** env-less `next build` re-proven green (no build-time secret evaluation; floor unchanged at request time); no `vercel.json` (dashboard-managed); hosted build observation BLOCKED (§13 misconfiguration stands until NI executes BLOCKERS 1–2).
- **Verification:** root **109**/1, api **41**/1, `tsc --noEmit`, `eslint .`, api build, env-less `next build` — ALL GREEN (re-run on the changed tree); staging harness 46/46; production smoke 8/8; readiness negative proof; payment gate proof.
- **STOP:** Pair 4 complete. All hosted rows remain BLOCKED BY EXTERNAL ACCESS pending NI manual actions (`docs/DEPLOYMENT_MANUAL_STEPS.md`). Payments/provider, refunds, settlement, ledger, notifications, moderation, KYC, offline/hardware scanning — NOT started.


---

## Pair 5 — Neon → Supabase migration: PostgreSQL + Auth (2026-09-29)

**Scope:** migrate TicketUG's infrastructure from Neon PostgreSQL/Neon Auth to Supabase PostgreSQL/Supabase Auth, preserving the architecture (Next.js ⇄ NestJS ⇄ PostgreSQL), the security model, all business logic and the UX. Starting commit `a53fe34`; hard stop after.

**Changed**

- **Auth (REFACTOR/REPLACE):** `@neondatabase/auth` removed from both tiers. Frontend: server-side `@supabase/ssr` client (`lib/supabase/server.ts`), new `app/api/auth/sign-in|sign-up|sign-out` route handlers (same UI, same 10/min rate limits, HttpOnly+Secure+SameSite=Lax session cookies `sb-<ref>-auth-token[.N]`), config floor moved to `lib/supabase-config.ts` (fail-closed in production; builds stay env-less). API: `supabase-auth.ts` + `supabase-auth.guard.ts` verify access tokens locally via the project's public JWKS (ES256; `iss` project-pinned; `aud=authenticated`; HS256/anonymous/forged rejected), Bearer-first with an exact `@supabase/ssr`-format cookie fallback. `scripts/local-auth-standin/` (Neon recipe) removed.
- **User mapping (BUILD):** `lib/user-profile.ts` — idempotent `auth_user_id` profile provisioning at first session (§12; previously out-of-repo Neon-side behavior).
- **Proxy refresh-awareness (BUILD):** `lib/api-forward.ts` — authenticated proxies attach a fresh Bearer access token (8 routes updated); short-lived JWTs never strand a signed-in user.
- **TLS (COMPLETE):** Supabase Root 2021 CA pinned — bundled `certs/supabase-root-2021-ca.pem` (+`certs/README.md` with fingerprint + rotation path), consumed by `lib/db.ts`, `apps/api` DatabaseService, and the migration runner; `SUPABASE_CA_CERT` override; `rejectUnauthorized` never weakened.
- **Migration runner (BUILD, §9 CASE B):** `scripts/migrate.mjs` (`pnpm migrate` / `migrate:status`) — ordered, ledgered (`ticketug.migration`), checksum-drift detection, transactional where permitted, idempotent, non-destructive; plus `docs/migrations/000-base-foundation.sql` — the audited reconstruction of the untracked 001-004 base (stub columns + the columns code provably uses).
- **Env/docs (§17/§31):** `.env.example` + `docs/DEPLOYMENT_ENVIRONMENT.md` rewritten for Supabase (browser-safe vs server-only split; no `NEXT_PUBLIC_*`); `DEPLOYMENT_MANUAL_STEPS.md` restated (Supabase blockers incl. the anon-key step); `API_AUTHENTICATION.md` rewritten; `ADR 0005` added; `ADR 0002` marked superseded; continuity §19 added.

**Verification (no fake claims)**

- Supabase DB: connection (session pooler, strict TLS), project audited EMPTY before writes, migrations 8/8 applied in order (idempotent re-run proven), schema 74/74 checks, 46/46 behavioral harness (issuance, scanner matrix, CASCADE, DB-backed PDFs), readiness real-SELECT-1, browser journeys (guest checkout→PAID→ISSUED→QR→PDF; organizer create→configure→invite→assign→publish; 5-scan scanner matrix; 390 px mobile) all against the REAL Supabase database; test data purged afterwards (0 rows, ledger intact).
- Auth: full wire+browser matrix on the GoTrue wire contract (sign-up/in/out, session persistence, forged/garbage/no-credential 401s, mapping proven in-DB); live remote-JWKS rejection proven against the REAL project; hosted live sign-up/sign-in BLOCKED by the missing anon key (config-only; exact manual step provided).
- Payment boundary intact: production runtime refuses simulated payments (503 TEST_PAYMENT_DISABLED).
- Tests: baseline (fresh worktree @ a53fe34) root 109|1, api 41|1 → after: root **121|1**, api **52|1**; typecheck, lint, api:build, env-less `next build` all green.

**Status:** infrastructure migration COMPLETE and verified to the boundary of what this environment can reach (see CONTINUITY §19.8). NOT "production ready": hosted frontend/API/auth remain BLOCKED by NI dashboard work (Vercel env+branch, API hosting, Supabase anon key).

---

## Pair 5.1 — Hosted deployment readiness audit + operator handoff (2026-09-29)

**Scope:** take Pair 5's Supabase migration toward the hosted boundary (GitHub → Vercel → hosted NestJS API → hosted Supabase Auth) per the Pair 5.1 directive. AUDIT FIRST: every Pair 5 claim re-verified against the actual repository and the real Supabase project; hosting surfaces audited for reachability. Starting commit `f8b22d5`; hard stop after.

**Audit results (all re-measured, not assumed)**

- **Repository:** HEAD = `f8b22d5`, clean tree; `origin/main` = `16bc73d` — Pairs 4+5 commits (`a53fe34`, `f8b22d5`) still unpushed (push BLOCKED: no GitHub credentials in this environment — `could not read Username`); no stale `cron/round-10-settings` branch locally or on the remote; no unexpected commits.
- **Baseline re-run (§5):** root **121 passed | 1 skipped**; api **52 passed | 1 skipped**; `tsc --noEmit` PASS; `eslint .` PASS; api build PASS; env-less `next build` PASS — Pair 5's numbers independently reproduced.
- **Supabase project (§7):** PostgreSQL 17.6 via session pooler; 23 `ticketug` tables; migration ledger 8/8 (`000-base-foundation` + `005→011`); 37 FKs, 82 indexes, 292 constraints, 2 behavioral triggers; RLS off (by design); extensions pgcrypto + uuid-ossp present; `auth.users`/`sessions`/`refresh_tokens`/`identities` all 0 (hosted auth never used).
- **000-base-foundation.sql (§8):** CASE A — RETAIN. Every file-defined base column exists in the live schema with matching type + length; all 17 FK references from later migrations resolve; the provenance claims (columns used by `apps/api/src/users/users.controller.ts` + `app/api/profile/route.ts`) verified in committed code.
- **TLS (§15):** strict verification functionally proven (all audit connections ran `rejectUnauthorized: true` against ONLY the bundled CA) AND the bundled CA's SHA-256 fingerprint re-matched against the live chain today (leaf → intermediate → **Supabase Root 2021 root**, fp `80:70:25:AD:…:CA:FA` — matches `certs/README.md`).
- **PostgREST exposure (§16):** REST root key-gated (401 without apikey; 401 with garbage key); SQL defense-in-depth: the `anon` role has **NO USAGE on the `ticketug` schema and zero table grants**; `public` schema empty → nothing exposed. `ticketug` is not browser-reachable.
- **Supabase Auth surfaces (§10):** public JWKS reachable without a key (ES256 / P-256, exactly what the API guard consumes); GoTrue health/settings key-gated; email-confirmation + site-URL settings remain dashboard-only checks (manual steps).

**Fixed**

- `apps/api/src/integration/database.integration.test.ts` (REFACTOR, test-only): the Neon-era integration test still asserted the `neon_auth` schema MUST exist — contradicted the migrated architecture (inert since the test skips without `TEST_DATABASE_URL`). Now asserts the Supabase reality: `ticketug` present, Supabase `auth` schema present, `neon_auth` ABSENT. Re-run green **against the real Supabase DB** with strict TLS (`sslmode=verify-full&sslrootcert=certs/supabase-root-2021-ca.pem`).

**Re-verification at the current tree (real Supabase, local production stack)**

- Compiled API (`NODE_ENV=production node apps/api/dist/main.js`): `/health` 200; `/readiness` 200 (real SELECT 1); `/docs` 200; no-credentials 401; garbage bearer 401; forged JWT (real issuer, fake signature) 401; production payment gate `503 TEST_PAYMENT_DISABLED`; disallowed-origin preflight emits no ACAO.
- Production `next start`: landing 200 with Upcoming/Find-an-event sections; `/events` 200 with `<h1>Events in Uganda</h1>` + honest empty state (DB is empty); `/scanner` 307 → `/sign-in?next=/scanner`; `/organizer` 307 → `/sign-in`; **zero browser console errors/warnings** (agent-browser).

**Known data finding (documented, NOT deleted)**

- `ticketug.webhook_event` contains **2 orphaned rows** from Pair 5's own browser-verification run (provider `test`, 08:37/08:40 2026-09-29, 20,000 + 50,000 UGX; referenced orders no longer exist; no FK on `provider_reference`). Left untouched per the pre-existing-records rule; safe for NI to delete by the two exact IDs.

**Hosted boundary — BLOCKED (no credentials in this environment; nothing fabricated)**

- GitHub push, Vercel project config/env, hosted NestJS API hosting, live hosted Supabase Auth flows (anon key) — all require NI actions; exact step-by-step checklists in `docs/DEPLOYMENT_MANUAL_STEPS.md` (new BLOCKER 0 = push Pairs 4+5 commits).
- Local `.env` still contains Pair 5's STAND-IN `SUPABASE_URL` (`http://localhost:5998`) + stand-in anon key — must be replaced with the real values (in the hosting secret stores, never in git).

**Status:** hosted deployment **BLOCKED** pending NI actions; everything verifiable from this environment is now verified (see CONTINUITY §20 matrix). NOT "production ready" — no hosted surface has been observed.

---

## Pair 6 — NestJS removal & Supabase-native backend (2026-09-29)

**Scope:** remove the separately hosted NestJS API (`apps/api`) and relocate its responsibilities to Next.js server modules + PostgreSQL functions, preserving the product's security model, transactional integrity and browser contract. Starting commit `7bd1c11`; design-first (audit + architecture docs before any deletion); hard stop after.

**Changed**

- **SQL functions (BUILD, migration 012):** `ticketug.create_order` (atomic guest/user orders: idempotency, deterministic lock order, sale-window/state checks, guarded decrement, snapshots), `cancel_order` (ownership re-verified, inventory restore, payment teardown), `expire_order_if_due` + `expire_stale_orders` (lazy + SKIP LOCKED sweep), `apply_payment_event` (webhook dedupe, amount/currency/order checks, state machines, ticket issuance), `transition_event_lifecycle` (centralized state machine, membership/owner rules inside). All `security definer`, EXECUTE revoked from PUBLIC/anon/authenticated.
- **Next server layer (BUILD):** `lib/server/{orders,payments,tickets,check-ins,events,errors}.ts` — session-resolved, zod-validated, authorization-in-SQL reads; payment initiation keeps the provider call inside one transaction; QR/PDF rendering moved to `lib/tickets/*`; shared pure rules moved to `lib/rules/*` (git-mv, history preserved); scanner extracted to `lib/server/check-ins.ts` (route now thin).
- **Routes:** all 15 NestJS-backed proxies rewritten to call the new layer — identical URLs/methods/rate limits/response shapes; NEW `app/api/public/payments/webhooks/[provider]` (HMAC-verified raw body) and `app/api/system/orders/expire-stale` (x-cron-secret, fail-closed); readiness upgraded to a real SELECT 1; guest order creation unified onto `create_order`.
- **Removed:** `apps/api` (59 files), Nest deps (@nestjs/*, class-validator/transformer, reflect-metadata, rxjs, helmet, drizzle-orm, jose), `lib/api-forward.ts`, `lib/ticket-pdf-proxy.ts`, API_ORIGIN/WEB_ORIGIN/API_PORT/API_HOST; ADR-0004 superseded by ADR-0006.
- **Docs:** `NESTJS_REMOVAL_AUDIT.md` (52-endpoint matrix), `SUPABASE_NATIVE_ARCHITECTURE.md`, rewritten `ARCHITECTURE.md`/`API_AUTHENTICATION.md`/`DEPLOYMENT_ENVIRONMENT.md`/`DEPLOYMENT_MANUAL_STEPS.md` (old API-host blocker OBSOLETE), `.env.example` for the new shape.

**Verification (real Supabase DB throughout)**

- SQL-function matrix 28/28 incl. the **6-way concurrent oversell barrier** (1 winner, 5 clean 409s, capacity never negative), idempotent issuance (same-event + new-event replays → DUPLICATE), wrong amount/order 422, lifecycle walk + illegal-jump rejection.
- Behavioral harness refactored onto the new modules: **57/57** (signed-webhook issuance, full scanner/gate matrix, CASCADE fail-closed, owner/guest PDFs incl. wrong-token refusal).
- Wire guest journey: order → PROCESSING → PROCESSED → PAID → 2× ISSUED → QR → PDF (application/pdf, no-store, safe filename, %PDF magic) → wrong-token 404 → replays idempotent. Webhook route: PROCESSED/DUPLICATE/garbage-400. Sweep: fail-closed 401, 200 with secret.
- Production gate **stronger**: 503 TEST_PAYMENT_DISABLED on every production runtime even with PAYMENT_MODE=test (the gate lives in the Next process now).
- Browser (production build, desktop + 390 px, console clean): landing, /events, detail, guest order page (recovery-link adoption), guest ticket page with QR.
- Suites: root vitest **103 passed** (0 failed, 0 skipped), typecheck PASS, lint PASS, `next build` PASS.

**Data safety:** all verification records marked + removed; final census 0 data rows, ledger 9/9, `auth.users` = 0.

**Status:** NestJS removal COMPLETE and verified to this environment's boundary (SERVER VERIFIED against real Supabase; hosted deploy still BLOCKED on NI's GitHub/Vercel actions — BLOCKER 0 now gates everything).

## Production gate — final deployment readiness (2026-09-29)

**Scope:** take the verified post-migration implementation (`41f01a3`) through
the final production deployment/readiness gate. Audit first; change only what
the evidence requires; no features, no schema changes, no live payments.

**Verified (real evidence, real Supabase DB)**

- Baseline intact: clean tree at `41f01a3`, `main` = `origin/main`.
- NestJS removal re-proven from the working tree (0 tracked `apps/` files; no
  `@nestjs/*` / `NestFactory` / `API_ORIGIN` / `/api/v1` in code; clean
  `package.json` + workspace).
- SQL-function harness **28/28** + behavioral harness **57/57** re-run against
  the real database (oversell barrier, idempotent issuance, scanner matrix,
  CASCADE fail-closed, PDFs); post-harness census **0 data rows, ledger 9/9,
  `auth.users` = 0** — zero test artifacts.
- Pipeline: vitest **103/103**, typecheck PASS, lint PASS, `next build` PASS.
- Key architecture confirmed CASE C: `SUPABASE_URL` + `SUPABASE_ANON_KEY`
  (publishable) server-side only; **no secret key required** (privileged work
  is PostgreSQL via `DATABASE_URL`); no `NEXT_PUBLIC_*` anywhere.

**Changed / Built**

- **BUILD:** expiry sweep wired for production — `vercel.json` Vercel Cron
  (`*/5 * * * *`) → `/api/system/orders/expire-stale`; route now accepts
  Vercel Cron's `Authorization: Bearer <CRON_SECRET>` alongside
  `x-cron-secret` and adds a GET handler (Vercel Cron dispatches GET);
  fail-closed 401 without `CRON_SECRET` — unchanged.
- **REMOVE:** untracked `apps/api/{dist,node_modules}` residue deleted;
  obsolete `apps/api/dist/` `.gitignore` rule removed; obsolete `API_ORIGIN`
  dropped from the local (untracked) `.env`.
- **DOCS:** `PRODUCTION_READINESS_REPORT.md` (NEW — VERIFIED/CONFIGURED/
  DEFERRED/BLOCKED + env matrix); `DEPLOYMENT_MANUAL_STEPS.md` BLOCKER 2a/2b
  rewritten for the NEW Supabase API keys (`sb_publishable_…` →
  `SUPABASE_ANON_KEY`; do NOT set `SUPABASE_SECRET_KEY`; add `CRON_SECRET`);
  CONTINUITY §22 gate record.

**Deferred:** live payment provider (fail-closed boundary retained), refunds,
settlements, ledger/reconciliation, notifications, legacy-key retirement
(after hosted auth pass), Vercel Pro/external scheduler if 5-minute sweep
cadence is needed on Hobby.

**Blocked (NI secret-store actions only):** hosted auth verification +
hosted browser journey pass — gated on the Vercel environment-variable pass
(new publishable key), not on code.
