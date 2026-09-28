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
