# TicketUG — Continuity Document

> **Current source of truth for future agents.** Read this file BEFORE touching the codebase.
> Maintained under the NI Master Production-Hardening Directive (see §References at the bottom).
> Companion append-only history: `docs/TICKETUG_CHANGELOG.md`.

---

## 1. Current architecture (verified at source level)

Monorepo, pnpm@10.34.3 workspaces:

```
/                        Next.js 16.3.5 App Router frontend (React 19, TS 5.8)
  app/                   Public/attendee/organizer/admin/scanner surfaces (server components + thin client islands)
  app/api/               Next route handlers — the SECURITY BOUNDARY (session-aware, rate-limited proxies into Nest + direct raw-pg paths)
  lib/                   Shared Next-side modules: auth, authorization ladder, invitations, members, organizer-settings,
                         guest-order-access, safe-redirect, rate-limit, ics, request-context, db (raw pg pool) — each pure module ships its own vitest suite
components/              Client islands (scanner-client, roster-manager, event-staff-manager, workspace-rename-form, …)
apps/api/                NestJS 11 API (port per env; global prefix /api/v1)
  src/ modules: audit, auth, check-ins, common, events, integration, orders, organizers, payments,
                ticket-types, tickets, users, future-domains (empty placeholder manifest — NOT wired)
docs/                    PHASE_3…PHASE_11 specs + audits, migrations/, API_AUTHENTICATION.md, ADRs
```

- **Database**: Neon Postgres via raw `pg` (NO ORM). Schema lives in `ticketug.*`. Prisma is FORBIDDEN (a stale spec mentioned it; decision stands).
- **Auth**: Neon Auth (Better Auth compatible). Next side `lib/auth.ts` + `lib/auth-secret.ts`; Nest side `apps/api/src/auth/neon-auth.ts`. Roles: `ticketug.platform_role` (PLATFORM_SUPPORT < PLATFORM_ADMIN < SUPER_ADMIN) and organizer roles (`ORGANIZER_OWNER` > `ORGANIZER_MANAGER` > `EVENT_STAFF`) in `organizer_member`.
- **Authorization ladder**: pure functions in `lib/authorization.ts` (`canManageOrganizer`, `canManageMemberRole`) — imported directly into client components so the UI can never offer an action the API would refuse.
- **Payments**: provider-agnostic abstraction + dev simulated/test pathway + webhook processing. **No live provider selected yet — provider selection is a GATE (directive §15).**

## 2. Current branch / commit / canonical state

- **Canonical branch: `main`** on `https://github.com/naturalintellectscrop-ctrl/TicketUG`.
- **HEAD: Pair 1 (this commit) — local main = origin/main (push auth lives only in the clone's `.git/config`, never in tracked files).**
- Pair-1 chain: `dbca44c` (dependency audit) → **this commit** (public event discovery + gate-level access; see §14 + CHANGELOG).
- Working tree policy: main is always pushed after every verified round; backup branches `cron/round-N-*` exist per round.

### Branch reconciliation table (directive §4 — completed 2026-09-26)

| Branch / commit | Contains | Status | Action |
|---|---|---|---|
| `origin/main` @ 85c22fc | All 10 cron rounds + original phase work | Current canonical | RETAIN (base) |
| `cron/round-1-bugfixes` @ f0559da | Test-suite restore, check-in schema, guest payment guard, staff assignment | Fully contained in main (merge-base verified) | RETAIN as backup; DO NOT MERGE (already ancestor) |
| `cron/round-2-lifecycle` @ 43e4392 | Lifecycle controls + transition proxy, sale-window checks, PII gate | Ancestor of main | RETAIN as backup |
| `cron/round-3-expiry` @ 84fba51 (e53c687 + 84fba51) | Expiry reaper, sales summary, operator sweep endpoint | Ancestor of main | RETAIN as backup |
| `cron/round-4-guest-orders` @ 174f915 | Guest status page, self-cancel, guest-create shape fix, secret fail-closed | Ancestor of main | RETAIN as backup |
| `cron/round-5-recovery` @ 04c4eca | Recovery links, re-key, ICS calendar export | Ancestor of main | RETAIN as backup |
| `cron/round-6-account-checkout` @ 634d827 | Authenticated checkout, dual-mode payment proxy, safe ?next= | Ancestor of main | RETAIN as backup |
| `cron/round-7-team-invitations` @ 5977651 | Session header, invitation mgmt + email binding | Ancestor of main | RETAIN as backup |
| `cron/round-8-roster` @ ac1e3f3 | Membership removal/demotion/promotion/leave, roster UI | Ancestor of main | RETAIN as backup |
| `cron/round-9-transfer` @ 5923a5c | Ownership transfer, owner exit unlocked | Ancestor of main | RETAIN as backup |
| `cron/round-10-settings` @ 85c22fc | Workspace settings/rename, workspaces page polish | Ancestor of main | RETAIN as backup |
| `v0/ticketug-sitewide-motion` @ cc93ca9 (7 commits, 43 files) | Pre-cron: sitewide dark styling pass, motion shell, Nest check-ins module, staff assignment, contact page | Superseded — check-ins/staff re-implemented better on main (round 1); styling evolved independently through 10 rounds. **Retired 2026-09-28: `git merge -s ours` (`f5e31de`) made it a true ancestor with a byte-identical tree** | Ported: `/contact` page (real NI numbers) + header link (`5e7f80b`). Remaining optional port: universal back-navigation idea. Stale v0 content (dark CSS, motion shell, dist artifacts, duplicate staff assignment) must NOT be revived. |
| 53 committed `apps/api/dist/*` artifacts (any branch) | Stale build outputs committed by original team | Harmless noise | DO NOT add new ones; removal is optional cleanup |

## 3. Completed phases (original build)

Docs present: `PHASE_3…PHASE_11` (+ `_AUDIT` files, `PHASE_9_1_CERTIFICATION.md`). Phase 1–2 docs are NOT in the repo. DDL for migrations 001–004 (identity/organizer/invitation tables) is untracked — see §9.

- Phase 3 — organizer identity + invitations (+ Phase-3 email-binding gap closed in round 7)
- Phase 4 — events foundation (+ 4.1 DB certification UNVERIFIED — needs TEST_DATABASE_URL)
- Phase 5 — events/venues/media/lifecycle (`005-events.sql`)
- Phase 6 — ticket types & inventory (`006-ticket-types.sql`)
- Phase 7 — orders/checkout (`007-orders.sql`)
- Phase 8 — payments & webhook processing (`008-payments.sql`, repaired CHECK)
- Phase 9 — tickets, QR, issuance (`009-tickets.sql`; 9.1 certification UNVERIFIED)
- Phase 10 — check-in (`010-check-in.sql`)
- Phase 11 — admin overview + hardening

## 4. Completed cron rounds (all merged to main, verified ancestry)

| Round | Commit | Delivered |
|---|---|---|
| 1 | f0559da | Test-suite integrity, check-in schema correctness, guest payment guard, staff assignment, scanner visibility, sign-out, public sold-out + CTA |
| 2 | 43e4392 | Event lifecycle controls (ADR-0004 thin proxy), sale-window enforcement, PII gate, ticket-type discoverability |
| 3 | e53c687 + 84fba51 | Payment-window expiry reaper (FOR UPDATE/SKIP LOCKED), lazy expiry, operator sweep endpoint (x-cron-secret, fails closed), organizer sales summary |
| 4 | 174f915 | Guest order status page, guest self-cancel w/ inventory restore, order state machine (`assertOrderTransition`), guest-create response-shape fix, Nest production secret fail-closed |
| 5 | 04c4eca | Guest recovery links, single-use re-key, ICS calendar export, guest ticket page rebuild |
| 6 | 634d827 | Authenticated attendee checkout (cookie-forwarding proxies), dual-mode payment proxy, safe `?next=` redirects |
| 7 | 5977651 | Session-aware site header, invitation management + revocation (expire-in-place), invited-email binding (403) |
| 8 | ac1e3f3 | Membership removal/role changes on authority ladder, self-serve leave, OWNER_CANNOT_LEAVE guard, roster UI |
| 9 | 5923a5c | Ownership transfer (atomic swap, TARGET_OWNS_ORGANIZER guard), owner exit flow completed |
| 10 | 85c22fc | Workspace settings (owner-only rename, immutable slug), workspaces hub rebuild, stale copy fixes |

## 5. Regression verification of previously-fixed defects (directive §7)

Full re-audit at main @ 85c22fc: **25 of 26 VERIFIED, 1 PARTIAL, 0 regressions.**
The single PARTIAL — Next-side `lib/auth.ts` accepted any non-empty `BETTER_AUTH_SECRET` while the API side enforced ≥32 chars — **was fixed in the reconciliation run** via `lib/auth-secret.ts` (shared 32-char floor, +5 tests). Two customer-facing copy contradictions found by the same audit were also fixed (order page "payment in a later phase" → accurate payment-window copy; admin nav fake links → honest labels).

## 6. Core gap matrix (directive Phase B)

Verification levels (§25): 1 SOURCE · 2 UNIT/INTEGRATION · 3 DATABASE · 4 BROWSER · 5 E2E · 6 PRODUCTION.
Sandbox ceiling: **Level 2 + targeted auth-guard live smoke (401/307/429)**. Levels 3–6 require the real Neon environment.

> 2026-09-28: the dependency-ordered, 20-item version of this gap analysis lives in **§12 (Core Completion Dependency Matrix)** — use §12 for all sequencing decisions.

| Area | State | Level reached | Notes |
|---|---|---|---|
| Auth/session (attendee+organizer) | IMPLEMENTED | 2 (+ live guard smoke) | Both tiers now fail closed on weak secrets; roles verified per-request, never cached |
| Organizer workspace & team | IMPLEMENTED | 2 (+ live guard smoke) | Create/invite/revoke/remove/promote/demote/leave/transfer/rename — authority-ladder unit-tested |
| Events (create/lifecycle/venue/media) | IMPLEMENTED (core) | 2 | Venue FK ownership-checked; media API Nest-only (no UI); organizer venue management UI thin |
| Ticket types & inventory | IMPLEMENTED | 2 | Phase 6 artifacts verified on main; derived availability states |
| Orders & checkout (guest + account) | IMPLEMENTED | 2 | Dual path (guest Next-direct vs account Nest-proxied) — documented duplication, keep in sync |
| Payments (test pathway) | IMPLEMENTED | 2 | Abstraction + simulated payments + webhook processing; **live provider NOT selected (GATE)** |
| Payments (live provider) | MISSING | 0 | Blocked on provider decision matrix (§15): MTN MoMo/Airtel/split settlement research |
| Tickets + QR (digital) | IMPLEMENTED | 2 | Issued on PAID, QR PNG data URL, guest+account surfaces, calendar export |
| **PDF tickets** | **MISSING** | 0 | No pdf lib anywhere. Roadmap Pair 2B; backend stays authoritative |
| Scanner & check-in (event-level + gate-aware) | IMPLEMENTED | 2 (+ live smoke) | Assignment (ACTIVE + optional gate scope), token checks, duplicate/used handling, history, WRONG_GATE rejection, cancelled event answers EVENT_NOT_AVAILABLE |
| **Gate-level access model** (scanner→gate, ticket→permitted gates) | **IMPLEMENTED** (Pair 1B) | 2 (pure-rule matrix tests) | `event_gate` + `ticket_type_gate` + assignment `gate_id` (migration 011, NOT production-applied); server-side enforcement in BOTH tiers via shared `gate.rules.ts`; fail-closed for unmapped types; DB verification BLOCKED |
| Platform admin | PARTIAL | 2 | Read-only real-metric overview + role gate (PLATFORM_SUPPORT/ADMIN/SUPER_ADMIN); no management surfaces, no moderation actions |
| Event moderation/review workflow | MISSING | 0 | Lifecycle has SUSPENDED but no platform review states (UNDER_REVIEW/NEEDS_CHANGES). Roadmap Pair 8B |
| Organizer KYC / agreements | MISSING | 0 | Roadmap Pair 8A + §18–20; LEGAL/COMPLIANCE DECISION REQUIRED markers mandatory |
| Notifications (email/SMS) | MISSING | 0 | Invitations/recovery are link-based today. Roadmap Pair 5; build channel abstraction |
| Public event discovery/browse | **IMPLEMENTED** (Pair 1A) | 2 (+ honest fallback browser smoke) | Shared query module `lib/public-events.ts` (single visibility predicate), `/events` index (search + pagination + honest empty/error states), landing "Upcoming events". Real-data DB/browser verification BLOCKED (no DB in sandbox) |
| Support/legal static pages | PARTIAL | 1 | `/contact` live on main (`5e7f80b`: real NI numbers +256752256576 / +256762449504, header link); privacy/terms/refund-policy pages still missing (wording = NI/legal) |
| Migrations | PARTIAL | 1 (source) | 005–010 present, deterministic, manual psql; **001–004 untracked; NO runner** — see §9 |
| Security hardening | STRONG | 2 | Rate limits per surface, secrets fail-closed, token hashing, webhooks verified, PII gates, security_event audit trail |

## 7. Environment requirements

- `DATABASE_URL` (Neon Postgres, `ticketug` schema), `BETTER_AUTH_SECRET` (≥32 chars — **enforced both tiers now**), `NEON_AUTH_BASE_URL` (or VITE_NEON_AUTH_URL), `CRON_SECRET` (sweeper; unset ⇒ sweep endpoint 401s — fails closed), payment mode/credentials (dev simulated only until provider selected).
- pnpm 10.34.3 via corepack shims (`/usr/lib/node_modules/corepack/shims/pnpm` in the dev sandbox).
- `pnpm build` is blocked without `BETTER_AUTH_SECRET` **by design** — deployment env only.
- Verification chain per change: `pnpm test` · `pnpm api:test` · `pnpm typecheck` · `pnpm lint` · `pnpm api:build`.

## 8. Payment status / authentication status / production readiness

- **Payment**: simulated/test pathway complete incl. webhooks and state machine; amount/currency/order-reference verification on the webhook path; browser redirects never authoritative. Live provider: NOT SELECTED — produce a ≥3-provider decision matrix (Uganda availability, MoMo, split settlement, settlement timing, fees, webhooks) before any integration. NyloPay is a candidate only.
- **Authentication**: Neon Auth on both tiers; per-request role resolution; production fail-closed on weak/missing secrets (both tiers, unit-tested); no auth bypasses for testing convenience.
- **Production readiness: NOT READY.** Test-path product logic is strong (Level 2), but Levels 3–6 (real DB, browser, E2E, production) are unproven, migrations 001–004 are unreproducible, no migration runner, no live payments, no PDF tickets, no discovery surface. Do not ship.
- **2026-09-28 Phase C dependency audit: COMPLETE — see §12.** Production readiness unchanged (NOT READY). Single next implementation batch: public event discovery + visibility list architecture.

## 9. Database / migration status (KNOWN BLOCKER — do not "fix" carelessly)

- Tracked: `005-events`, `006-ticket-types`, `007-orders`, `008-payments` (repaired CHECK + payment-state CHECK + partial expiry index), `009-tickets`, `010-check-in`. Forward-only, manually applied (psql). **No runner.**
- **001–004 are absent from the repo** — `organizer`, `user_profile`, `organizer_member`, `organizer_invitation` DDL is untracked. The code deliberately writes defensively around unknown CHECK constraints (membership removal DELETEs rows; invitation revoke expires-in-place; no invented status values).
- **Do NOT fabricate 001–004 or add a runner blind** — rebuilding these tables wrong against the real Neon DB would be destructive. Recovery requires access to the real database (`pg_dump --schema-only`) or NI's original SQL. Until then: fresh-database setup does NOT work from the repo alone.
- Never use production DB as a test DB. Never write destructive migrations without explicit justification.

## 10. Roadmap position & next recommended task

Directive phase position: **Phase A COMPLETE → Phase B COMPLETE → push/branch consolidation COMPLETE (Task 16) → Phase C dependency audit COMPLETE (§12) → Phase C implementation batches NEXT.**

Implementation order (full rationale in §12-D):
1. ~~Push + branch consolidation~~ — DONE (`f5e31de`; every remote branch merged into main).
2. ~~Dependency audit~~ — DONE (§12).
3. **NEXT BATCH (single): public event discovery + visibility list architecture** — shared list-query module over the existing `publication_state='PUBLIC' AND discoverable=true` predicate, `/events` index (SALES_OPEN first), landing "Upcoming events" section, deterministic ordering, honest empty state, tests.
4. Gate-level access + scanner enforcement (Pair 3A, one batch).
5. PDF tickets (server-side, embedded QR, backend authoritative).
6. Moderation states + admin queues (needs an NI policy answer: pre-publication review vs trust-first).
7. Agreement-acceptance mechanism + KYC foundation (schema only until NI/legal wording arrives).
8. In-app notifications + channel abstraction (external provider later).
9. EXTERNAL: Neon snapshot of the 001–004 tables → migration runner → Level 3.
10. EXTERNAL: provider decision matrix → live-payments batch → refunds/settlement/ledger follow.
11. Level 4 browser → Level 5 E2E → Level 6 production config (distributed limiter, origins, sweeper wiring, `.env.example`, platform_role seeding procedure).

Then Phase D (full core journey test, needs real env) → Phase E (readiness gate) → two-feature batches (§28). Refactor candidate (documented, not urgent): unify guest/account order-creation logic so the two paths cannot drift.

## 11. Things future agents must NOT undo

(unchanged — see the list below; §12 adds: never hard-code a payment provider, never invent legal/KYC wording, never duplicate scanner/lifecycle logic when adding gates/moderation)

- The raw-pg security boundary (`lib/*` + Next route handlers as the session-aware gate). No Prisma. No direct Nest mutations outside it.
- The authority ladder (`canManageOrganizer`/`canManageMemberRole`) and the pure-decision test pattern (no mocks).
- DELETE-based membership removal and expire-in-place invitation revocation (CHECK-constraint-unknown defensive design).
- Webhook signature verification, `assertOrderTransition` state machine, guarded inventory restore, FOR UPDATE/SKIP LOCKED expiry sweep.
- Production fail-closed secrets (both tiers), rate limits, invited-email binding, safe `?next=`.
- The **gate conceptual model**: staff assignment → event+gate; ticket type → permitted gates; backend decides gate permission (implement in Pair 3A without duplicating scanner logic).
- No fake metrics, no placeholder buttons, no invented business/status values, no committed secrets, no new `apps/api/dist` artifacts.
- The **shared public-visibility predicate** (`lib/public-events.ts` `PUBLIC_EVENT_VISIBILITY_SQL`) — every public listing/filter must go through it; never fork a second visibility rule.
- The **shared gate rules seam** (`apps/api/src/check-ins/gate.rules.ts`) — both scanners import it; the fail-closed semantics (unmapped ticket type = rejected at every active gate; deleted/disabled gate = scanners fail closed, assignments never widened) must survive any refactor.

## 12. Core Completion Dependency Matrix (Phase C audit, 2026-09-28)

Evidence-based audit of the 20 remaining CORE production requirements. Every state below was verified against the code at `f5e31de` (file:line evidence in the sandbox worklog, Task 17). Verification levels per §25; "SOURCE-verified absence" means exhaustive searches confirmed the capability does not exist anywhere in the repo.

Key code anchors: issuance is **webhook-only** (`payments.service.ts:57–81` → `assertPaidOrder` requires order `PAID` + payment `SUCCEEDED`, `ticket.rules.ts:3`; idempotent via `ticket_issuance_event`); the provider seam is real (`PaymentProviderAdapter`, `payment.contracts.ts:6–10`; test provider prod-refused, `payment.provider.ts:35–42`); QR credential is a 256-bit opaque token (`tkt_<32 random bytes>`, sha256 lookup, `tickets.service.ts:26`, `ticket.qr.ts`); the public visibility predicate **already exists** (`publication_state='PUBLIC' AND discoverable=true`, set on the PUBLISHED transition, `event-lifecycle.ts:24–28`, enforced on the detail page `app/events/[slug]/page.tsx:16` and Nest `public/events/:slug`) — but **no list surface exists anywhere** (landing is static; the Nest guard whitelists only singular public detail); the scanner is event-level with `UNIQUE(ticket_id)` replay protection (`check-ins.service.ts:28–64`, `010-check-in.sql`); platform admin is read-only counts with DB-seeded `platform_role` and zero mutating endpoints; refund/settlement/ledger/gate/moderation/KYC/notification code is confirmed absent.

| # | Requirement | Current implementation | Verification level | Dependency | Blocker | Recommended action |
|---|---|---|---|---|---|---|
| 1 | Public event discovery | IMPLEMENTED (Pair 1A) — shared `lib/public-events.ts` + `/events` index (search, pagination, honest empty/error) + landing listing | L2 (pure logic unit-tested) + honest fallback browser smoke; real-data DB/browser BLOCKED | — | Real DB (verification only) | DB verification when Neon reachable |
| 2 | Public visibility/query architecture | IMPLEMENTED (Pair 1A) — ONE shared predicate (`PUBLIC_EVENT_VISIBILITY_SQL`) feeds detail + index + landing | L2 | Feeds moderation (#3) | None | Keep moderation states (#3) extending this same predicate |
| 3 | Event moderation/governance | MISSING — 9 lifecycle states incl. SUSPENDED; no UNDER_REVIEW/NEEDS_CHANGES; admin has zero mutating endpoints | SOURCE-verified absence | Admin mutation surfaces (#12); new forward-only migration; publication predicate (exists) | NI policy decision: pre-publication review vs trust-first | Build structure after discovery; extend (never alter) the 005 CHECK |
| 4 | Organizer verification/KYC foundation | MISSING — no verification step or columns; organizer creation ungated | SOURCE-verified absence | Gates unrestricted publishing (product decision); admin review queue (#12); migration | NI KYC policy/legal (external) | Schema + queue foundation once policy decided; do not invent requirements |
| 5 | Organizer agreement/terms acceptance | MISSING — no agreement/consent capture anywhere | SOURCE-verified absence | Gates publishing; mechanism = versioned acceptance record (version + timestamp + text hash) | Approved agreement text (NI/legal — external) | Build acceptance-record mechanism with LEGAL/COMPLIANCE DECISION REQUIRED markers; never invent contract language |
| 6 | Live payment provider | **CLOSED (2026-09-30): NylonPay APPROVED by NI (production credentials supplied).** Live adapter IMPLEMENTED on the existing seam (`lib/payments/nylonpay.ts`: official-SDK `collectPayment` mobile-money push, in-house raw-body HMAC webhook verify cross-checked against the vendor verifier, UUID reference contract, phone collected on the order); migrations 013–015; wire test 17/17 vs the real API | L2 (unit-tested + wire-verified end-to-end) | Root of the money chain | Residual: Vercel env vars (`PAYMENT_PROVIDER=nylonpay`, `NYLONPAY_API_KEY`, `NYLONPAY_API_SECRET`, `NYLONPAY_WEBHOOK_SECRET`) + webhook URL registration in the Nylon dashboard = BLOCKER 2d; refunds/charging-the-operator flows still future work | Refunds, split settlement, reconciliation reporting remain FUTURE work; first real-money transaction should be a 500 UGX smoke on the deployed domain |
| 7 | Model A split-settlement | MISSING — fee/settlement deliberately deferred (PHASE_8/11) | SOURCE-verified absence | Provider capability proof (#6): organizer settlement + platform fee; NI must not custody funds unnecessarily | Provider selection + capability verification | Design after provider confirmed; no settlement-timing claims until provider-documented |
| 8 | PDF/digital ticket generation | MISSING — zero pdf libraries; digital = QR data-URL page + ICS only | SOURCE-verified absence | Ticket snapshots + QR payload exist (`ticketug:v1:<credential>`); independent of live payments | None for build; L3+ verification needs real env | BUILD: server-side PDF with embedded QR; backend stays authoritative; QR remains the opaque credential |
| 9 | Gate-level ticket access permissions | IMPLEMENTED (Pair 1B) — `event_gate`, `ticket_type_gate`, assignment `gate_id` (011, forward-only, NOT production-applied) | L2 (pure rules) + source; DB VERIFICATION BLOCKED | — | Real DB | Apply 011 + verify constraints on the first real-env run |
| 10 | Scanner/check-in + gate integration | IMPLEMENTED (Pair 1B) — gate-scoped authorization in both tiers via shared `gate.rules.ts`; WRONG_GATE rejection with permitted-gate names; EVENT_NOT_AVAILABLE mapping fixed | L2 (rule matrix) + source; live-gated scans need real DB | — | Real DB (Level 3+) | DB + browser verification of scan journeys when Neon reachable |
| 11 | Essential notifications | MISSING — no email/SMS providers or SDKs; invites + recovery are copyable link/token flows | SOURCE-verified absence | Delivery hooks would attach to issuance; channel abstraction independent | External provider choice (email/SMS for Uganda) | Build channel abstraction + in-app notifications now; wire provider when selected |
| 12 | Platform admin functionality | PARTIAL — `/admin` read-only aggregate counts behind PLATFORM_SUPPORT/ADMIN/SUPER_ADMIN; `platform_role` DB-seeded only (no bootstrap path); zero mutating admin endpoints on both tiers | L2 + guard smoke | Moderation/KYC queues extend this; seeding procedure needed | None for expansion | Expand admin with moderation/verification queues (#3/#4); document `platform_role` seeding (no code bypass, no env backdoor) |
| 13 | Refund architecture | MISSING — `REFUNDED` ticket status + `refunded_at` reserved, never set; no refund tables/endpoints; PAID is terminal in `assertOrderTransition` | SOURCE-verified absence | Live provider refund APIs (#6); order/payment state-machine extension | Provider selection + refund capability verification | Design refunds after provider; keep CHECK-constraint caution (never invent status values) |
| 14 | Settlement architecture | MISSING | SOURCE-verified absence | Model A split semantics (#7) | Provider | After provider; design-only drafting allowed |
| 15 | Ledger/reconciliation | MISSING | SOURCE-verified absence | Settlement semantics (#14) define the entries | Provider + documented settlement timing | Defer implementation; draft schema only; no invented timing claims |
| 16 | Database migration verification | PARTIAL — 005–010 tracked, deterministic, forward-only, manual psql, NO runner; **001–004 untracked**; integration test self-skips without `TEST_DATABASE_URL`; `lib/env.ts` exists but imported nowhere | L1 (source) | Real DB access | **Neon credentials (external)** — DO NOT fabricate 001–004 | On access: `pg_dump --schema-only` snapshot → retire 001–004 risk → then runner |
| 17 | Real Neon dev/staging verification | BLOCKED | L0 (anonymous guard smoke only: 401/307/429) | #16 + credentials | Neon access | First real-env run against a THROWAWAY/staging DB, never production |
| 18 | Full browser verification | PARTIAL — anonymous rendering + auth-guard live smoke across rounds; authenticated journeys unexercised in browser | L4-partial | #17 | Real env | Scripted browser pass of full journeys after #17 |
| 19 | Full E2E verification | MISSING/BLOCKED — no e2e tests exist (unit suites + one self-skipping DB integration test) | L0 | #17 + #18 | Real env | Cover money chain, access chain, governance chain after env |
| 20 | Production deployment/configuration verification | BLOCKED | L0 | Everything above | NI production environment | Close known flags: in-memory rate limiter → distributed; `API_ORIGIN` default localhost:4000; `PAYMENT_TEST_WEBHOOK_SECRET` dev fallback; `CRON_SECRET` sweeper needs external scheduler; no `.env.example`; `platform_role` seeding procedure |

### Verified dependency chains

```text
MONEY (code-verified):
provider selection [GATE]
  ↓
live adapter via the EXISTING PaymentProviderAdapter seam
  ↓
webhook verify (raw body + signature + webhook_event idempotency)   ← already built & tested for the test provider
  ↓
order → PAID (assertOrderTransition)                                ← already built
  ↓
ticket issuance (assertPaidOrder: PAID + SUCCEEDED, idempotent)      ← already built
  ↓
PDF ticket (buildable now, independent) · gate check at scan (needs #9/#10)
  ↓
check-in log

GOVERNANCE:
agreement acceptance + KYC (wording/policy = external)
  ↓
organizer approval state (new) → event submission → moderation states (new migration)
  ↓
publication predicate (EXISTS: PUBLIC + discoverable)
  ↓
discovery list (predicate exists — can ship pre-moderation under the NI trust model; NI decision)

ACCESS:
gate model migration → ticket_type ↔ permitted gates → staff gate assignment (extend event_staff_assignment)
  ↓
scan-time permitted-gate predicate → scanner UI gate filter

FOUNDATION:
Neon access → pg_dump schema snapshot (retire 001–004) → migration runner
  ↓
L3 DB → L4 browser → L5 E2E → L6 production
```

### A. Critical path (minimum to a production-ready core)

1. Neon access → schema snapshot + migration runner → Level 3 (retires the 001–004 risk; unblocks 17–19).
2. Provider selection (GATE) → live adapter via the existing seam → live verified payments → issuance on live PAID.
3. PDF tickets (parallel-safe; core requirement).
4. Gate model + scanner gate enforcement.
5. Governance minimum: agreement acceptance + moderation states + admin queues.
6. Discovery (predicate exists) — the storefront.
7. Refunds/settlement/ledger per provider semantics.
8. Notifications via a chosen provider.
9. L4 → L6 verification + production config hardening (limiter, origins, sweeper, `.env.example`, seeding procedure).

### B. Parallel-safe work (no external configuration needed)

- Public discovery + visibility list architecture (#1/#2) — predicate already built and tested.
- Gate model + scanner enforcement (#9/#10).
- PDF tickets (#8).
- Moderation structure (#3) — states + admin queues; policy-light.
- Agreement-acceptance mechanism (#5) — schema + versioning; NO legal wording.
- In-app notifications (#11 subset) + channel abstraction.
- Admin expansion (#12).
- Ops prep for #20: `.env.example`, deployment checklist, distributed-limiter plan (implementation at deploy time).
- Cautions: never hard-code a provider; never invent legal text; gate/scanner work must extend, not duplicate, the 010 model; moderation states must extend, not alter, the 005 CHECK.

### C. Manual / external blockers

- ~~GitHub push credentials~~ — RESOLVED (push restored; all branches merged; auth lives in the clone's `.git/config` only).
- Neon credentials (blocks #16/#17/#18/#19 and the migration runner).
- Payment provider selection (GATE) + sandbox/production credentials (#6/#7/#13/#14/#15).
- KYC/legal decisions + approved organizer agreement text (#4/#5).
- Notification provider decision (#11).
- Production environment + domain/config (#20).
- NI confirmation of the contact phone numbers carried verbatim onto `/contact`.

### D. Recommended implementation order

See §10 (numbered 1–11). Rule: two-feature batches resume ONLY after the core production gate passes (§28).

~~SINGLE NEXT IMPLEMENTATION BATCH: Public event discovery + visibility list architecture~~ — **SHIPPED as Pair 1 (together with gate-level access)**; see §14. **Next recommended pair (Pair 2): PDF ticket generation** (#8 — server-side PDF with embedded QR, backend authoritative) + first-run DB verification of migration 011 the moment a staging database exists. Everything money-related remains behind the provider GATE; governance wording remains NI/legal.

## 13. Deployment (Vercel) runbook — diagnosing the failing deploy

Symptom (2026-09-28): Vercel build failed with `BETTER_AUTH_SECRET is required in production` while building **branch `cron/round-10-settings` @ `85c22fc`**.

1. **Wrong branch.** The Vercel project's Production Branch is still `cron/round-10-settings` (a historical backup). Switch it: Vercel → Project → Settings → Git → Production Branch → **`main`**. `85c22fc` is 4+ commits behind current main.
2. **Missing env vars (the original build error — see §15 for the code-side correction).** `BETTER_AUTH_SECRET` is enforced with a ≥32-char production floor — **fail-closed by design on both tiers at RUNTIME**: without it every auth-dependent request fails loudly, sessions cannot be forged. Since the lazy-auth correction the frontend BUILD no longer requires the secret (a build without it deploys the marketing surfaces with auth dead, fail-closed); the API tier still boot-fails without it by design. Set in Vercel (Production + Preview):
   - `BETTER_AUTH_SECRET` (≥32 chars) · `DATABASE_URL` (Neon Postgres) · `NEON_AUTH_BASE_URL` (or `VITE_NEON_AUTH_URL`) · `API_ORIGIN` (public URL of the hosted Nest API) · `CRON_SECRET` (sweeper) · optional `PAYMENT_WINDOW_MINUTES`. Template: `.env.example` (committed; values only in the secret store).
3. **apps/api is NOT deployed by Vercel** — host it separately (Render/Railway/Fly/VPS), set `WEB_ORIGIN` there for CORS, and point Vercel's `API_ORIGIN` at it. The default `http://localhost:4000` only works locally.
4. Do NOT weaken the fail-closed secret check to "fix" builds. (The lazy-auth change in §15 does NOT weaken it: identical floor, identical error, enforced at the request boundary; builds simply no longer evaluate auth modules.)

## 14. Pair 1 implementation record (2026-09-28)

**Pair 1 = Public Event Discovery (1A) + Gate-Level Ticket Access & Scanner Integration (1B).** Directive scope honored: nothing else implemented.

Decisions (RETAIN/COMPLETE/BUILD):
- RETAINED: the check-in architecture (transaction, `FOR UPDATE`, `UNIQUE(ticket_id)`, immutable `check_in`, online-only), the authorization ladder, the dual-tier pattern, the event lifecycle.
- **Visibility**: ONE shared predicate `PUBLIC_EVENT_VISIBILITY_SQL` in `lib/public-events.ts` now feeds detail + `/events` + landing. Verified from `event-lifecycle.ts`: CANCELLED/SUSPENDED events keep `publication_state='PUBLIC'` + `discoverable=true` BY DESIGN (the detail page renders them with a status notice) — the listing therefore shows them with lifecycle labels instead of inventing a stricter, contradictory rule. `/events` is `force-dynamic` (no build-time DB access) with honest loading/empty/error states and zero fabricated data.
- **Gates**: `event_gate`, `ticket_type_gate` (PK pair), `event_staff_assignment.gate_id` (nullable; `UNIQUE(event_id,user_profile_id)` retained — one gate scope per member). Semantics: no active gates → legacy event-wide scanning; event-wide assignment → not gate-filtered (trusted staff); gate-scoped assignment → the ticket type must be permitted through THAT gate (active gates only) else `WRONG_GATE` with permitted-gate names; **unmapped ticket type on an event with active gates → rejected everywhere (fail-closed)**; disabled gate → its scanners fail closed; deleted gate → CASCADE deletes its assignments (never widened).
- **Shared rules seam**: `apps/api/src/check-ins/gate.rules.ts` (pure, api-suite-tested) is imported by BOTH the Nest service and the Next `/api/check-ins` mirror — closing the documented dual-path drift for scan semantics; Next scan responses were normalized to the Nest camelCase DTO (scanner client updated accordingly).
- **Mapping-gap fix (directive §16, verified still valid)**: a cancelled event now answers `EVENT_NOT_AVAILABLE` (was `UNAUTHORIZED_SCANNER`); platform-admin bypass behavior preserved; the summary endpoint keeps its strict Forbidden behavior.
- **`lib/db.ts` hardening** (found during browser QA): an unset `DATABASE_URL` now yields a stub pool whose queries reject with a clear error (honest error states) instead of pg's uncatchable aggregate crash; the real pool gains `connectionTimeoutMillis: 10_000` + an idle-client error handler. Note: this sandbox inherits a non-postgres `DATABASE_URL` (`file:` URL) from the control room — TicketUG dev runs with it unset.
- **Migration 011**: forward-only, follows repo conventions, **NOT production-applied** — `DATABASE VERIFICATION: BLOCKED` (no DB in sandbox; do not fabricate). Manual application: `psql $DATABASE_URL -f docs/migrations/011-gates.sql` on a THROWAWAY/staging DB first.

**Verification**: root **97/1** (+33), api **32/1** (+9), typecheck, lint, api:build — ALL GREEN. Browser (sandbox, DB-less): `/` and `/events` 200 with honest fallback/error states, `/events?q=` 200, `/scanner` `/organizer` `/admin` 307 guards intact — **all DB-backed journeys (real event cards, organizer gate UI, scanner scans) are BROWSER/DB VERIFICATION BLOCKED** until the real Neon environment exists. Nothing is claimed production-ready.

**Next recommended pair (Pair 2)**: PDF ticket generation (#8) + first-run DB verification of migration 011 when a staging database exists.

## 15. Root-route (landing page) investigation & correction (2026-09-28)

**Trigger:** product review reported `/` was not showing the intended TicketUG marketing homepage; the previous round's "HTTP 200 + honest fallback" evidence was judged insufficient. Targeted investigate-and-fix run only.

**Root-route diagnosis (answered precisely):**
- **What serves `/`:** `app/page.tsx` — the ONLY root page in the repo (no `src/app`, no route groups, no duplicate `page.tsx` anywhere; verified by glob). It IS the marketing homepage: hero, "The rhythm" pillars, Upcoming events, organizer banner, footer. Wrapped by `app/layout.tsx` (fonts + metadata only).
- **Middleware/redirects affecting it:** NONE — no `middleware.ts/js`, no `proxy.ts`, no rewrites/redirects in `next.config.ts` (headers only), no `vercel.json`.
- **Git history verdict:** continuous evolution, never replaced — `107cd31` (initial) → `888621f` → `4327e73` → `6622e40` (dark-mode deepen) → `d35735f` → `e91c819` → `5977651` → `3ad8873`. **Pair 1 caused NO regression:** its only landing change swapped a static "Coming together" banner for the real discovery section; hero/pillars/organizer/footer were untouched, and the events fetch sits in try/catch so a DB failure degrades ONLY that section (browser-proven in the DB-less sandbox).

**Actual cause of the "missing homepage":** the deployment, not the code. (1) Vercel Production Branch pointed at stale `cron/round-10-settings` @ `85c22fc`; (2) the build aborted at "Collecting page data" because `lib/auth.ts` called `resolveAuthSecret()` at module import and the auth catch-all constructed `auth.handler()` at module scope — `next build` imports route modules, so the production secret check threw during the build (`BETTER_AUTH_SECRET is required in production` → ELIFECYCLE 1) and no deployment ever went live.

**Corrective action:**
- `lib/auth.ts`: auth client constructed lazily via `getAuth()` on first use; `app/api/auth/[...path]/route.ts`: handlers built on first request; `lib/request-context.ts` updated. The ≥32-char fail-closed floor is UNCHANGED — it now fires at the request boundary (same error, no fallback secret, sessions cannot be forged); only builds no longer evaluate auth modules. Proven: full `next build` with an EMPTY environment is green.
- `app/layout.tsx`: `themeColor` moved to the `viewport` export (removes the Next 16 metadata warning).
- Landing quality (directive §10): nav "System status" (raw `/api/health` JSON) removed; hero note reworded to the factual "Secure QR tickets, verified at the gate."; "Find an event" CTA now targets `/events` (marketing `/` vs discovery `/events` separation); new honest "Why TicketUG" trust band (`.trust-*` styles) stating only shipped capabilities (server-verified QR, one-time check-in, gate-scoped tickets, order recovery); footer gained a Contact link.

**Verification:** root 97/1, api 32/1, typecheck, lint, api:build, env-less `next build` — ALL GREEN. Browser: `/` desktop + 390px mobile fully rendered, zero console errors/warnings, "Why TicketUG" anchor scrolls to the trust band; `/events` remains the separate discovery page (search + honest DB-less error state); `/sign-in` 200; `/account` `/organizer` `/admin` 307 to sign-in; `/scanner` 307 with `next=/scanner`.

**Remaining limitations:** DB-backed event cards on `/` + `/events` UNVERIFIED until Neon exists (honest fallbacks proven only); production readiness unchanged (NOT READY — 011 unapplied, provider GATE, Levels 3–6 unproven). Vercel still REQUIRES the §13 config switch (branch + env) — the code fix only removes the build-time abort.

## 16. Pair 2 implementation record (2026-09-28) — PDF tickets + first real DB verification

**Pair 2 = (1) Production PDF ticket generation + (2) first real-Postgres verification of migration 011 and the gate/scanner system.** Hard STOP after; nothing else implemented.

**Feature 1 — PDF tickets (BUILD on the RETAINED ticket/QR architecture):**
- RETAINED: the single QR mechanism (`ticket.qr.ts` — `ticketug:v1:<credential>`, sha256 lookup; no second QR scheme), the ticket projection, the owner (session-cookie) and guest (`x-order-access-token`, sha256-compared) access paths, the thin Next→Nest proxy pattern.
- BUILT: `apps/api/src/tickets/ticket.pdf.ts` (pdfkit A5 renderer — brand palette, event/timezone-honest date range incl. multi-day form, venue, ticket/attendee/refs/status/organizer, gate block ONLY when the event models gates, QR from the SAME credential payload, "verified by TicketUG at entry / scans once" line, REAL support numbers carried verbatim from /contact — zero invented policy/statistics); `ticketQrPng` (PNG twin of the existing data-URL QR); `TicketsService.pdfMine/pdfGift→pdfGuest` (one authoritative query per access path adding timezone, organizer name, event-has-gates, permitted-gate names); controller endpoints `GET tickets/:publicId/pdf` + `GET public/orders/:orderPublicId/tickets/:ticketPublicId/pdf` (application/pdf, sanitized `ticketug-ticket-<ref>.pdf` filename, `Cache-Control: no-store`); Next proxies + shared `lib/ticket-pdf-proxy.ts` (content-type forced to application/pdf on success, filename relayed verbatim, always no-store); `components/download-ticket-pdf.tsx` (single-flight, honest errors for 401/403/404/5xx) wired into BOTH the authed ticket page and the guest ticket page without touching the QR display.
- PDFs reflect status honestly (CANCELLED/REFUNDED/VOID print "will not pass the gate"; CHECKED_IN prints "already checked in"); the backend stays authoritative at scan time regardless of the printout.

**Feature 2 — first real DB verification (real Postgres 18 engine, embedded locally as a THROWAWAY staging DB — no Neon credentials exist in the sandbox, none fabricated):**
- `scripts/staging-verify/` committed: `001-stub-base.sql` (clearly-labelled THROWAWAY stub of the untracked 001–004 base tables — NOT a migration; on real staging Neon the base already exists and it must be skipped) + `verify-gates.ts` (rerun-safe runner, refuses non-local hosts without `--allow-remote`) + README with the exact manual staging procedure.
- **46/46 checks GREEN on real Postgres**: 011 objects (tables/column/five indexes/CASCADE on both edges/case-insensitive gate-name uniqueness via functional probe); REAL issuance through `issuePaidOrder` incl. idempotency; REAL scanner matrix via `CheckInsService.scan` (Regular→Main VALID; replay ALREADY_CHECKED_IN; Regular at VIP/VVIP WRONG_GATE with permitted-gate names; VIP at Main+VIP VALID; VIP at VVIP / VVIP at Main WRONG_GATE; unmapped type fail-closed WRONG_GATE; event-wide assignment unfiltered; disabled-gate assignment fails closed; unassigned staff/outsider UNAUTHORIZED_SCANNER; wrong event WRONG_EVENT; malformed INVALID_QR; unknown INVALID_TICKET; CANCELLED → EVENT_NOT_AVAILABLE; SUSPENDED scannable by design — sales pause ≠ entry pause, rule locked in and documented; platform-admin bypass VALID); gate-deletion CASCADE removes permissions + assignments and the former gate scanner becomes UNAUTHORIZED_SCANNER (never widened); REAL DB-backed PDF generation (owner + guest + wrong-token refusal + gate context matching the business rule).
- Lifecycle consistency verified across surfaces: discovery (availability labels) ↔ detail ↔ scanner (CANCELLED → EVENT_NOT_AVAILABLE; SUSPENDED intentionally remains scannable) — no inconsistency found beyond those already fixed in Pair 1.

**Two genuine production-blocking bugs found by real-DB verification (both FIXED, both dormant until now):**
1. `TicketsService.rowsForOrder` ordered by `t.ticket_type_name` — a SELECT alias qualified with a table prefix, which Postgres rejects. Every webhook-driven issuance would have failed against a real DB. Fixed to `t.ticket_type_name_snapshot`.
2. `OrdersService` and `TicketTypesService` lacked `@Injectable()` — no DI metadata → `db` injected as undefined → EVERY order/ticket-type route 500s with a real backend. Fixed by adding `@Injectable()` to both. (Evidence how deep the "DB verification blocked" gap went: none of this surfaced in any prior round.)

**Known packaging limitation (documented, NOT silently worked around):** `apps/api` builds to extensionless-ESM (`module: ESNext`, `moduleResolution: Bundler`), so `pnpm api:build` output is NOT directly startable via `start: node dist/main.js` (Node cannot resolve the extensionless relative imports), and the `@neondatabase/auth/next/server` import cannot load under plain Node's strict pnpm isolation (it worked under tsx's lenient loader). For the E2E the compiled dist was run under tsx's resolver. RECOMMENDED fix in a future pair: switch the API to `module: NodeNext` + explicit `.js` extensions (or bundle with tsup/esbuild), and import the framework-agnostic `@neondatabase/auth/server` entry with an explicit request-context factory. This is a packaging change across every relative import — deliberately NOT rushed inside Pair 2.

**Verification (final, all run):** root tests 109/1 (+12), api tests 41/1 (+9), `tsc --noEmit` clean, `eslint .` clean, api:build green, env-less `next build` green. E2E with the compiled API + Next frontend against the local Postgres: /events renders real seeded event cards (incl. CANCELLED chip), guest order recovery via `?key=`, guest ticket page renders QR + both actions, clicking "Download PDF ticket" downloads an 8676-byte `%PDF-1.3` with correct headers; HTTP authz verified (no token → 403, wrong token → 404, unknown ticket → 404); mobile 390px layout verified; browser console clean. Authenticated-attendee PDF flow (cookie path) is service-level verified (harness + unit tests) but NOT browser-verifiable in the sandbox (no Neon Auth session).

**Deployment remains blocked on NI manual steps:** Vercel Production Branch → `main`; §13 env vars; host apps/api (see also the packaging note above — run `api:build` output via tsx or fix packaging first).

**Next recommended pair:** (1) API packaging/runtime fix (NodeNext/extensions or bundler + `@neondatabase/auth/server` swap) so `start: node dist/main.js` truly works on a host — it gates every future real-environment rollout; (2) organizer-gate-management + staff-assignment journeys browser-verified against a real staging DB (Neon branch), since authenticated-session surfaces remain the last unverified slice of the gate system.

## 17. Pair 3 implementation record (2026-09-28) — API production runtime + real-browser organizer gate verification

**Pair 3 = (1) fix & PROVE the API production runtime/package (`node dist/main.js`), (2) verify organizer gate-management + staff-assignment journeys through a REAL browser against a REAL PostgreSQL staging DB.** Hard STOP after; no payments/refunds/KYC/notifications/etc. work.

### 17.1 Feature 1 — API production runtime/packaging (decision: CASE C — REFACTOR, minimal)

**Root causes (both reproduced, not assumed):**
1. **Packaging:** `apps/api` compiled with `module: ESNext` + `moduleResolution: Bundler` (bundler-mode — valid only when a bundler resolves at runtime, which Node is not) into ESM with extensionless relative imports, and `apps/api/package.json` had no `"type"`. `node dist/main.js` therefore failed exactly as Pair 2 reported: typeless-package warning → ESM reparse → `ERR_MODULE_NOT_FOUND: ./app.module`. Bonus defect found: no tsconfig `exclude`, so **every `*.test.ts` compiled into the production dist**.
2. **Auth runtime:** `apps/api/src/auth/neon-auth.ts` imported `@neondatabase/auth/next/server`. Reproduced Pair 2's finding at module-load: that entry imports `next/headers` + `next/server`, which are not in `@neondatabase/auth`'s pnpm-isolated dependency graph (`ERR_MODULE_NOT_FOUND: next/headers`), and even if resolvable, their request-scoped APIs throw outside a Next request context. Decisive audit of the SDK source: `createAuthServer`'s `fetchWithAuth` **discards** per-call `fetchOptions` and reads cookies ONLY from the injected framework `context` — so the old guard's `getSession({fetchOptions:{headers:{cookie}}})` arguments were dead parameters and no standalone-Node deployment could ever authenticate a request. `@neondatabase/auth` is ESM-only (`"type":"module"`), which also rules out reflexive CommonJS output.

**Fix (three pieces, all verified compatible with the stack):**
- **Packaging → native Node ESM done right:** `"type": "module"` in `apps/api/package.json`; tsconfig `module/moduleResolution: NodeNext`; explicit `.js` extensions on all relative imports across `apps/api/src` (40 files, mechanical codemod + review); tsconfig now `include`s `src` and `exclude`s `src/**/*.test.ts` (tests stay in vitest; dist stops shipping them). RETAINED `tsc` as the sole compiler — no bundler, no tsx-in-production, no new dependencies. Empirically verified compatible with: root `tsc --noEmit` (Bundler resolution maps `.js`→`.ts`), vitest (both suites), and bun (staging harness).
- **Auth → framework seam the package documents:** replaced `createNeonAuth` (`@neondatabase/auth/next/server`) with `createAuthServer` from **`@neondatabase/auth/server`** — the same factory the Next wrapper builds on — plus a Nest/Express `RequestContext` via `node:async_hooks` `AsyncLocalStorage` (the exact pattern the SDK's `BUILDING-AN-ADAPTER.md`/types describe for non-Next frameworks). The guard wraps each session check in the ALS scope (raw `Cookie:` header, Origin/referer resolution, case-insensitive `getHeader`), serializes SDK-minted `Set-Cookie` refreshes onto the Express response verbatim, and still enforces the unchanged fail-closed `BETTER_AUTH_SECRET ≥32 chars` floor. `sessionDataTtl: 300` and the upstream `baseUrl` contract unchanged. NO second auth implementation; Next-tier (`lib/auth.ts`) untouched.
- **Proof (production runtime test, per directive):** `tsc -p apps/api` → `node dist/main.js` with `NODE_ENV=production` + staging `DATABASE_URL` → Nest boots cleanly; smoke matrix 8/8: `/api/v1/health` 200 `{"status":"ok"}`, `/api/v1/readiness` 200 `{"status":"ready","database":"ok"}` (real `SELECT 1`), DB-backed `GET /api/v1/public/events/:slug` 200 returning real staging rows, unknown slug 404, no-cookie 401, forged-cookie 401, swagger docs 200. The start command is literally `node dist/main.js` (script `start` unchanged) — no tsx anywhere.

**Regression:** api tests 41/1, root 109/1, typecheck, lint, api build, env-less `next build` — ALL GREEN after the change. Strongest end-to-end proof of the auth rework: the browser journey's authenticated lifecycle transitions (`POST …/transition` → Next proxy → compiled API `NeonAuthGuard` with the NEW ALS context) returned 201 twice against real Better Auth sessions (see 17.2).

### 17.2 Feature 2 — organizer gates + staff assignment through a REAL browser on REAL Postgres

**Environment (all local, none fabricated; distinguished from real Neon staging):**
- **DB:** embedded PostgreSQL 18 (Pair 2's persistent daemon, port 5433), database `ticketug_verify` — schema = updated stub + verbatim 005→011. Journey data preserved; the 46-check harness re-ran 46/46 against a SEPARATE throwaway DB (`ticketug_verify_harness`) to prove the updated stub end-to-end without wiping journey state.
- **Auth:** Neon Auth = Better Auth managed by Neon. With no Neon credentials, a **local Better Auth engine (better-auth `1.6.23`, the exact pinned version of `@neondatabase/auth@0.5.0-beta`)** was hosted on :5999 (`scripts/local-auth-standin/` committed for reference) with `basePath:'/'` (matches the proxy's `${baseUrl}/sign-in/email` contract), `cookiePrefix:'__Secure-neon-auth'`, same `BETTER_AUTH_SECRET`, `trustedOrigins` for the dev host, auto-migrated core tables in a throwaway `neon_auth_standin` DB. Contract verified byte-for-byte: proxy `POST /api/auth/sign-in/email` → upstream 200; cookie name `__Secure-neon-auth.session_token`; `GET /get-session` shape `{session,user}`. **This is a REAL auth engine on the REAL wire contract — not a mock — but it is NOT the managed Neon service; documented as such.**
- **Staging prerequisites (mirroring production provisioning):** `ticketug.user_profile` rows keyed by `auth_user_id` for the two browser-created accounts (no in-app provisioning flow exists by design).
- **Stub gaps fixed during the journey (all part of untracked 001–004, mirrored from app usage into `scripts/staging-verify/001-stub-base.sql`):** `platform_role`, `security_event`, `organizer_invitation`, `attendee_profile`, plus `organizer_member.updated_at` + `UNIQUE(organizer_id,user_profile_id)` (required by `acceptInvitation`'s ON CONFLICT).

**Three genuine production bugs found ONLY because the journey ran (all FIXED):**
1. **Create-event form could never submit:** the form POSTed raw `datetime-local` values (`"2026-11-14T19:00"` — no offset) while the route requires `z.string().datetime({offset:true})` → every real organizer got 400 "Invalid event details". The sibling ticket-type form already converted via `toISOString()` — the event form had forgotten it. Fixed with the same established pattern.
2. **Create-event SQL was unrunnable:** the INSERT referenced `$10` (membership re-check) but bound only 9 parameters → Postgres `08P01` on every call. Fixed by passing `context.profileId` twice. (These two bugs together mean **event creation has been broken since that route was written** — no prior round ever exercised it end-to-end.)
3. *(Journey-blocking, not app bug)* invitation acceptance 500ed against the stub DB because the stub lacked the `organizer_member` unique constraint the upsert requires — production Neon has it (untracked 001–004); stub corrected, app code unchanged.

**Verified organizer journey (all steps in the real browser via agent-browser, desktop + 390px):**
sign-up (real Better Auth) → `/organizer` onboarding form → workspace created → create event (after fixes) → publish → open sales (two lifecycle transitions proxied to the compiled API → 201s through the new guard) → ticket types Regular/VIP/VVIP created via UI (201×3) → gates Main/VIP/VVIP created via GateManager (201×3, honest empty state → populated) → gate editing (rename persisted; disable → DISABLED; enable → ACTIVE; DB-verified each step) → gate permissions via permission chips (Regular→Main, VIP→VIP, VVIP→VVIP; dirty tracking observed; PUT replace-set 200×3; **hard reload re-verified UI↔DB state match**) → team invitation (owner UI shows one-time link; token stored hashed) → staff account sign-up + invitation acceptance through the REAL `/invitations/accept` UI (200, membership EVENT_STAFF ACTIVE) → staff assignment Event+Gate via EventStaffManager (201; row renders "Okello Staff · event staff · Gate: VIP Gate"; **hard reload + DB row both confirm persistence**; reassignment to Main Gate propagates immediately).

**Security matrix (real staff/owner sessions, browser-context fetches against the real DB):**
- Scanner (staff assigned VIP Gate): Regular@VIP → **WRONG_GATE** with `permittedGates:["Main Gate"]`; VIP@VIP → **VALID** (+ `check_in` row); re-scan → **ALREADY_CHECKED_IN**; VVIP@VIP → **WRONG_GATE** (permitted `["VVIP Gate"]`); malformed payload → **400 INVALID_QR**; scan of another event's ticket → **WRONG_EVENT**; staff attempting another event (unassigned) → **403 UNAUTHORIZED_SCANNER** (cross-event isolation — assignment never travels). After owner reassignment to Main Gate, the same Regular ticket scans **VALID** at Main and the scanner UI shows "Gate: Main Gate" — gate authorization provably follows the live assignment, never the client.
- Gate-ID injection: staff POSTing assignments → **403** (not a manager); owner submitting a `gateId` from a DIFFERENT event → **400 "Gate not found for this event"**; owner PUTting a foreign `ticketTypeId` into permissions → **400** and DB permission set unchanged.
- Ownership isolation: another organizer's event (Pair 2 fixture) — owner-session create/PATCH/DELETE on its gates → **403 ×3**, "Organizer access denied".
- Role-based UI: EVENT_STAFF sees the staff section but NO GateManager; ORGANIZER_OWNER sees gates + staff + sales summary. Server-side session cookie never trusts client-supplied gate/event IDs (scanner derives gate from the assignment row; management routes re-check ownership in SQL).
- UI/UX: scanner manual-entry flow renders honest outcome ("This ticket is not valid for this gate. VVIP — Permitted gates: VVIP Gate" + Scan next); loading/save/error states (single-flight `pending`, role=status messages); mobile 390px — no horizontal scroll on event page or scanner (screenshots saved); **browser console: zero errors** (only dev HMR noise).

### 17.3 What remains honestly unverified
- The managed **Neon Auth** service itself (credentials still absent) — the local engine is contract-identical but not the hosted control plane; the same is true of a Neon-hosted Postgres vs the local embedded engine.
- Cross-event isolation was proven at the API/session layer with two real events in one workspace lineage (journey event vs Pair 2 fixture event under a different organizer); a second workspace created entirely through the UI was not additionally exercised (the ownership 403s above already cover the authorization boundary).

## 18. Pair 4 implementation record (2026-09-29) — hosted/staging deployment verification + production-path hardening

**Pair 4 = (1) real hosted/staging deployment verification, (2) production-path hardening.** Hard STOP after; no payments/KYC/notifications/refunds/etc.

**Environment reality (determined, not assumed):** the working sandbox had been reset since Pair 3 — the repository clone was gone and was re-cloned fresh from GitHub at exactly `16bc73d` (verified: `main` = `origin/main` = `16bc73d`, clean tree; repo-local identity re-set to Natural Intellects Ltd). External-service audit result:

```text
GitHub repository : READ-ONLY clone + ls-remote work anonymously. Push credentials: ABSENT in this environment (see Git note below).
Vercel project    : NO access (no token/CLI), and NO production URL is recorded anywhere in the repo or handover log → hosted observation impossible.
Railway/API host  : NO access; nothing provisioned.
Neon DB / Neon Auth: NO credentials (unchanged since Pair 2).
```

Therefore every claim below is `LOCAL VERIFIED` on a **real PostgreSQL 18 engine** unless explicitly marked otherwise; hosted items are classified `BLOCKED BY EXTERNAL ACCESS` with exact manual actions in the new `docs/DEPLOYMENT_MANUAL_STEPS.md` (dashboard path, setting, expected value, verification command, expected evidence per blocker). **No local substitution is presented as hosted verification.**

### 18.1 Staging environment (rebuilt, production-faithful)

- **DB:** embedded PostgreSQL 18 (`18.4.0-beta` binaries), port 5433, three throwaway DBs (`ticketug_verify` journey, `ticketug_verify_harness` harness, `neon_auth_standin` auth). **TLS hardened to mirror Neon's posture:** a locally-generated CA + server certificate (SAN `localhost`/`127.0.0.1`), `ssl=on`, and BOTH tiers connect with verification — web pool enforces `ssl:{rejectUnauthorized:true}` in production NODE_ENV (existing code, unchanged) against the CA via `NODE_EXTRA_CA_CERTS`; API connects `sslmode=verify-full`. Confirmed `TLSv1.3` via `pg_stat_ssl`. Infrastructure lives OUTSIDE the repo (`/home/z/pgstage`); zero repo changes were made to enable it.
- **Auth:** the committed Pair-3 stand-in recipe (`scripts/local-auth-standin/`) — real Better Auth `1.6.23` on `:5999`, same shared staging secret, auto-migrated core tables. Real engine, real wire contract; NOT the managed Neon service (unchanged caveat).
- **Stack topology = the intended hosted topology:** production-built Next (`next start`, :3100) ⇄ compiled API (`node apps/api/dist/main.js`, :4000) ⇄ TLS Postgres, with the auth engine behind `NEON_AUTH_BASE_URL`.

### 18.2 Compiled API production runtime — re-proven and extended (all RETAIN; zero code changes)

Pair 3's proof was repeated on the fresh clone and EXTENDED with three deployment-specific proofs:

1. **Production smoke 8/8** (`NODE_ENV=production`, staging `DATABASE_URL`): `/api/v1/health` 200; `/api/v1/readiness` 200 with real `SELECT 1`; DB-backed `GET /api/v1/public/events/pair4-deployment-check` 200 returning the real seeded row; unknown slug 404; `GET /api/v1/users/me` no-cookie 401; swagger `/api/v1/docs` 200; start command literally `node apps/api/dist/main.js`.
2. **Readiness negative test (§18 of the directive):** a second production instance pointed at an unreachable database answered `/health` **200** (process health) while `/readiness` returned **500** with a generic body — no stack, no credentials in the error (verified by scan). Readiness genuinely represents DB state, not merely process liveness.
3. **Payment production gate (§27):** in production runtime `POST /api/v1/public/orders/:publicId/payment/test-complete` → **503 `TEST_PAYMENT_DISABLED`** — the simulated provider is provably inert where real payments will live (code paths `payments.service.ts`/`payment.provider.ts` unchanged, now behaviorally proven).

### 18.3 Migration state — reproducibility proven (§8)

- Fact re-confirmed: migrations `005→011` are forward-only SQL applied by hand; **the repo has NO formal migration runner** (documented; not faked). 001–004 remain untracked by design (verification stub is labelled NEVER-FOR-PRODUCTION).
- Fresh-DB reproducibility: brand-new PostgreSQL 18 instance → stub base (throwaway DB only) → verbatim `005→011` in order → `scripts/staging-verify/verify-gates.ts` → **46/46 checks GREEN** (migration 011 objects incl. CASCADE + case-insensitive gate-name uniqueness; real issuance + idempotency; the full scanner decision matrix; gate-deletion CASCADE fail-closed; real DB-backed PDFs incl. wrong-token refusal). Migration state is reproducible from the repo alone; no schema exists only because of a manual local alteration.

### 18.4 Full-stack production-mode browser journeys (real browser, real DB, real auth engine)

All through `next start` (production build) + compiled API + TLS Postgres:

- **Public:** `/` renders with the DB-backed event card; `/events` lists the seeded public event; `/events/pair4-deployment-check` renders title/description/timezone-honest dates (Africa/Kampala) + both ticket types (10,000/50,000 UGX).
- **Guest ticketing journey:** guest checkout (2× Regular) → order `PAID` via the staging-permitted simulated payment → 2 tickets `ISSUED` → guest ticket page with QR → **PDF verified twice**: UI download saved an 8,523-byte `%PDF-1.3`, and an in-page fetch returned `{status:200, type:"application/pdf", size:8523}`. Wire headers: `content-type: application/pdf`, `cache-control: no-store`, `content-disposition: attachment; filename="ticketug-ticket-tkt_….pdf"`. Wrong access token → 404 with no existence leak.
- **Persistence (§10/§25):** ticket/order pages survive reload; UI state cross-checked against DB rows (`order.status=PAID`, `2× ticket ISSUED`) — API state and UI state agree.
- **Authentication journey (§9):** sign-up through the REAL auth engine → 2 `__Secure-neon-auth` cookies → authenticated `GET /api/me` 200 → sign-out → cookies cleared + protected request **401**; fresh sign-in works. **Fail-closed matrix at the compiled API:** forged session token + forged session_data JWT → 401 `Authentication required`; garbage signature → 401; no cookies → 401.
- **Cookie hardening (§17):** `Set-Cookie` audit — `HttpOnly; Secure; SameSite=Lax` with `__Secure-` prefix; 7-day token + 300-second session_data TTL. CORS re-verified on the running API: preflight from a disallowed origin emits **no** `Access-Control-Allow-Origin` (fail-closed for browsers); allowed origin echoes exactly; **no wildcard** while `credentials:true` (correct pattern; NOT weakened).
- **Guards:** `/scanner` `/organizer` `/account` `/admin` → 307 to `/sign-in` (with safe `next=` on scanner).
- **Mobile (§14):** 390 px — event detail and guest ticket page show no horizontal scroll (`scrollWidth == 390`), QR + PDF button present (screenshots saved by the run).
- **Console:** zero errors/warnings across all visited pages.
- **Security headers:** `next.config.ts` serves `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, HSTS 2 years, `Permissions-Policy: camera=(), microphone=(), geolocation=()` (verified in code; on the wire via production start).

### 18.5 Production-path hardening — secret safety + environment documentation (§15/§16)

- **Secret-safety audit (all clean):** tracked-tree scan for key patterns / private keys / credentialed URLs → only a localhost fallback default in the committed stand-in script and a usage-string placeholder in the harness (not secrets); `.gitignore` verified to ignore `.env`, `.env.*` (with `!.env.example`) via `git check-ignore`; **no `NEXT_PUBLIC_*` variable exists anywhere**, so server secrets cannot reach client bundles through public env; `BETTER_AUTH_SECRET` referenced only in server modules (never in `'use client'` files); API logs scanned → zero secret-ish strings; readiness-failure body contains no stack/credentials; DB connection strings never rendered into any UI.
- **Environment reference (BUILD):** `docs/DEPLOYMENT_ENVIRONMENT.md` — every variable cross-checked against actual `process.env` usage (17 distinct variables found; all documented per tier with purpose + placeholder). One real gap found and fixed: `PAYMENT_TEST_WEBHOOK_SECRET` was missing from `.env.example` → added (commented, staging-only).
- **Manual-action document (BUILD):** `docs/DEPLOYMENT_MANUAL_STEPS.md` — 5 blockers (Vercel production branch, Vercel env vars, API hosting, migration 011 application, hosted browser pass), each with service, dashboard location, exact setting, expected value, verification command and expected evidence; plus non-blocking recommendations (migration runner, scheduler wiring, recording hosted URLs).

### 18.6 Vercel frontend path (§6)

- Code-side verification: `next build` with a completely **empty environment** is green (re-run this pair) — the Pair-2 lazy-auth refactor demonstrably removed build-time secret evaluation; `BETTER_AUTH_SECRET` is enforced only at the request boundary (floor unchanged).
- Config-side facts: no `vercel.json` exists (dashboard-managed); the docs previously recorded (§13) that the project's Production Branch is mis-pointed at `cron/round-10-settings` @ `85c22fc` and env vars are missing — that misconfiguration **cannot be re-observed or fixed from this environment** (no URL/token) and is filed as BLOCKER 1/2 with exact dashboard steps. Hosted-build observation: `BLOCKED BY EXTERNAL ACCESS`.

### 18.7 Deployment readiness matrix (§23) — evidence-based

| Area | Local | Hosted | Status | Evidence |
| --- | :-: | :-: | --- | --- |
| Frontend build | ✓ | — | LOCAL VERIFIED | env-less `next build` green (re-run) |
| Frontend runtime | ✓ | — | LOCAL VERIFIED | `next start` journeys, desktop + 390 px, console clean |
| API runtime | ✓ | — | LOCAL VERIFIED | `node dist/main.js` production smoke 8/8 (re-run + extended) |
| Database | ✓ | — | LOCAL VERIFIED | fresh PG 18 + TLS 1.3; harness 46/46; seeded rows |
| Migrations | ✓ | — | LOCAL VERIFIED (reproducible) | stub + verbatim 005→011 on fresh DB |
| Authentication | ✓ | — | LOCAL VERIFIED | real Better Auth engine; sign-up/in/out; forged 401 matrix |
| Organizer gate mgmt | ✓ | — | LOCAL VERIFIED (Pair 3 journeys; no code changes since — `git diff` empty) | §17.2 |
| Events / ticket types | ✓ | — | LOCAL VERIFIED | detail page + types rendered from DB |
| Orders | ✓ | — | LOCAL VERIFIED | guest order → PAID (DB cross-check) |
| Ticket issuance | ✓ | — | LOCAL VERIFIED | 2× ISSUED (DB cross-check) |
| PDF | ✓ | — | LOCAL VERIFIED | UI download + wire headers + harness PDFs |
| Gates / scanner matrix | ✓ | — | LOCAL VERIFIED | harness 46/46 (service-level vs real DB) |
| Secrets | ✓ | n/a | LOCAL VERIFIED | §18.5 audit |
| CORS/cookies | ✓ | — | LOCAL VERIFIED | preflight matrix; `HttpOnly; Secure; SameSite=Lax` |
| Readiness semantics | ✓ | — | LOCAL VERIFIED | positive + negative (dead-DB) proofs |
| Payment boundary | ✓ | — | LOCAL VERIFIED | production 503 gate; staging-permitted test path clearly separated |
| **All hosted rows** | — | — | **BLOCKED BY EXTERNAL ACCESS** | `docs/DEPLOYMENT_MANUAL_STEPS.md` |

### 18.8 Git note (honest)

The re-cloned environment has **no push credentials** (anonymous HTTPS clone; no token in env/credential store). If the push of this pair's commit is rejected at run time, the commit exists locally on `main` with verified authorship and must be pushed by NI (or a future run with credentials) — flagged in the final report rather than hidden.

**Next recommended pair:** execute BLOCKERS 1–4 of `docs/DEPLOYMENT_MANUAL_STEPS.md` (NI dashboard work), then a hosted verification run flipping the §18.7 matrix to HOSTED row by row; first code-capable follow-up remains the tiny migration runner (non-blocking).

## 19. Pair 5 implementation record (2026-09-29) — Neon → Supabase migration (PostgreSQL + Auth)

**Pair 5 = migrate TicketUG's infrastructure from Neon PostgreSQL/Neon Auth to Supabase PostgreSQL/Supabase Auth while preserving the architecture, security model, business logic and user experience.** Starting commit `a53fe34` (local main; origin/main still `16bc73d` pending credentialed push). HARD STOP after.

### 19.1 Environment reality (determined, not assumed)

- NI supplied the Supabase **Postgres** connection string (session pooler) for this pair. The Supabase dashboard, API keys (anon/service-role), and hosting dashboards remain unreachable — the anon key is not derivable and is not stored in the database.
- Connection verified: `aws-1-eu-central-1.pooler.supabase.com:5432` = **session pooler**, PostgreSQL 17.6. TLS: strict verification (`rejectUnauthorized: true`) works only with Supabase's own PKI — the pooler presents `*.pooler.supabase.com` signed by **Supabase Root 2021 CA** (self-signed root). Supabase's published CA download URL returned 404 at run time, so the root was extracted from the live chain and pinned; SHA-256 fingerprint recorded in `certs/README.md` for NI cross-verification. **No `rejectUnauthorized` weakening anywhere.**
- **Project state (audited before any write, §4):** EMPTY — no `ticketug` schema, no `public` tables, `auth.users` = 0. No unrelated data. No backup needed; nothing dropped. Supabase system schemas (`auth`, `storage`, `realtime`, `vault`, `extensions`, …) present and untouched.

### 19.2 Component classification (§2 decision framework)

```text
RETAIN    raw pg (no Prisma; no supabase-js for data); NestJS API as the business boundary;
          Next.js frontend + all journeys; ticketug schema; migrations 005-011 verbatim;
          guest-order access tokens; payment boundary (test provider refused in production);
          storage approach (event_media, no Supabase Storage — §20)
COMPLETE  DATABASE_URL now points at the Supabase session pooler; TLS posture extended with
          the pinned Supabase Root CA (lib/db.ts, DatabaseService, scripts/migrate.mjs)
REFACTOR  auth integration — @neondatabase/auth (Better-Auth-managed-by-Neon) replaced by
          Supabase Auth end to end (frontend server-side flows + API JWKS guard)
REPLACE   scripts/local-auth-standin (Neon/Better Auth recipe) — removed (git history keeps it)
BUILD     (1) migration runner scripts/migrate.mjs + ledger ticketug.migration (§9 CASE B);
          (2) docs/migrations/000-base-foundation.sql — the audited reconstruction of the
          untracked 001-004 base (stub columns + the columns code provably uses:
          user_profile.phone/profile_completed_at/updated_at), required because the Supabase
          project starts empty; (3) lib/user-profile.ts ensureUserProfile — the §12 mapping
          mechanism (previously out-of-repo Neon-side provisioning); (4) lib/api-forward.ts —
          refresh-aware Bearer forwarding for the Nest proxies (access tokens are short-lived
          JWTs; the 7-day session-token property of Better Auth is gone)
```

### 19.3 Supabase Auth integration (§11/§15/§16)

- **Frontend (server-side only):** `lib/supabase/server.ts` builds an `@supabase/ssr` server client per request; sessions live in HttpOnly, Secure, SameSite=Lax cookies (`sb-<ref>-auth-token[.N]`, `base64-`-encoded JSON, 3180-char chunking — contract mirrored byte-for-byte in the API's parser). Sign-in/sign-up/sign-out route handlers (`app/api/auth/*`) keep the 10/min rate limits and the exact old UI (same form, same messages, no redesign). The catch-all Neon proxy route and `lib/auth-client.ts`/`lib/auth-secret.ts` are removed. `SUPABASE_ANON_KEY` stays server-side — still zero `NEXT_PUBLIC_*` variables.
- **API guard:** `supabase-auth.ts` + `supabase-auth.guard.ts` verify tokens LOCALLY with `jose` against the project's public JWKS (ES256; the real project's JWKS was probed: ES256/P-256) with `iss` pinned to `${SUPABASE_URL}/auth/v1` and `aud === 'authenticated'`; HS256/anonymous/cross-project/forged tokens fail closed. Cookie fallback mirrors the `@supabase/ssr` chunking exactly (unit-tested). Boot fails closed in production without `SUPABASE_URL`.
- **Mapping (§12):** Supabase user UUID → `ticketug.user_profile.auth_user_id` (text UNIQUE — unchanged schema), created idempotently by `ensureUserProfile` at first session, seeded from sign-up metadata `name`.
- **Fail-closed floors preserved:** request-time config check on the web tier (builds still succeed env-less — the `cookies()` dynamic bailout orders the checks exactly like the old lazy-auth contract, re-proven); boot-time check on the API tier (proven: production boot without `SUPABASE_URL` refuses to start).
- **Documented model change:** access tokens are stateless short-lived JWTs (≤1 h default). Sign-out revokes the refresh token + clears cookies; an already-issued access token stays valid until expiry — inherent to JWT auth, tightening is a dashboard setting (manual steps 2b). Proxies attach a fresh Bearer token (refresh-aware) so users are never stranded mid-session.

### 19.4 Migration execution + verification (§5-§8, §23)

- **Runner (BUILD, minimal):** `scripts/migrate.mjs` — deterministic ordering, `ticketug.migration` ledger (name, sha256 checksum, applied_at), no reapplication, checksum-drift hard-fail, self-transactional files run verbatim (005-011 are `BEGIN;…COMMIT;`), non-self-transactional files wrapped atomically WITH their ledger row, status mode, safe repeated execution, no destructive statements, no secrets in output. `pnpm migrate` / `pnpm migrate:status`.
- **Application to Supabase:** `000-base-foundation.sql` + verbatim `005→011` in order — 8/8 ok (355-744 ms each). Re-run: "nothing to do" (idempotent). Ledger: 8 rows, checksums recorded.
- **Schema verification: 74/74 PASS** (tables incl. §8's required set + the real `ticket_issuance_event`/`webhook_event`; columns; 37 FKs; unique constraints incl. PK-based `ticket_type_gate` and case-insensitive `event_gate` name uniqueness; CHECK constraints; hot-path indexes; both behavioral triggers; RLS deliberately OFF — API-enforced authorization, `ticketug` not exposed via PostgREST; transaction rollback; extensions pgcrypto/uuid-ossp present).
- **Behavioral harness: 46/46 PASS** against the real Supabase DB (`scripts/staging-verify/verify-gates.ts --allow-remote`, TLS-verified via `sslrootcert`): migration-011 objects, real issuance + idempotency, FULL scanner decision matrix, gate-deletion CASCADE fail-closed, DB-backed PDFs incl. wrong-token refusal, inventory/concurrency probes. Harness seed data removed afterwards; final DB state: 0 data rows, 8 ledger rows, `auth.users` untouched.

### 19.5 Tests (§22/§24 — exact numbers)

```text
BASELINE (fresh worktree run at a53fe34):  root 109 passed | 1 skipped · api 41 passed | 1 skipped
AFTER    (changed tree):                   root 121 passed | 1 skipped · api 52 passed | 1 skipped
delta: root +12 (lib/supabase-config.test.ts +6 net of removed auth-secret 5; apps/api auth tests
+11 counted in both suites by design — vitest root config includes apps/api/src rules), api +11.
typecheck PASS · lint PASS · api:build PASS · next build PASS with EMPTY environment (re-proven).
```

Removed tests: the 5 `auth-secret` tests (the Better Auth secret mechanism no longer exists) — replaced by 6 `supabase-config` tests covering the equivalent fail-closed floor. No test was weakened.

### 19.6 Full-stack verification (real Supabase DB; GoTrue wire-contract stand-in for auth)

Stack = production-built Next (`next start`) + compiled API (`node apps/api/dist/main.js`) + REAL Supabase Postgres (pinned-CA TLS) + GoTrue wire-contract stand-in (`/home/z/pgstage/pair5/gotrue-standin.mjs`, ES256+JWKS, outside the repo — the hosted GoTrue needs the anon key, BLOCKED; methodology identical to Pair 3/4's committed stand-in recipe, now for the GoTrue contract).

- **Wire-level auth matrix (all SUPABASE-DB-backed):** sign-up → 200 + `sb-…-auth-token` HttpOnly Secure cookie + `user_profile` row created in Supabase (mapping proven in-DB); `/api/me` 200; no-session 401; sign-out 204 → cookies cleared → 401; re-sign-in 200; session persists across requests. Forged/garbage/no credentials at the compiled API → 401 ×3.
- **Live remote-JWKS proof against the REAL project:** an API instance pointed at `https://<ref>.supabase.co` fetched the real JWKS and rejected forged tokens → 401 (verification logic is the same code path the stand-in exercises).
- **Browser journeys (agent-browser, desktop 1280 + mobile 390):** public `/`, `/events` (DB-backed card), event detail (Africa/Kampala-honest dates) → guest checkout (Regular ×2) → simulated payment → PAID → 2 × ISSUED → ticket page with QR → **PDF**: wire `content-type: application/pdf`, `cache-control: no-store`, safe `content-disposition`, 8,581-byte `%PDF-1.3`, wrong token → 404. Organizer: workspace create → event create (UI form dates resist automation — event created through the SAME session/API route the form posts; form itself was UI-proven in Pair 3) → 2 ticket types (10,000/50,000 UGX) → Main/VIP gates → permissions → staff invite → staff session accepted → gate-scoped assignment → transitions `PUBLISHED` → `SALES_OPEN` **through the new Bearer proxy path (201 ×2)**. Scanner (staff session, server-authoritative gate from the assignment row): VIP@VIP → **VALID** ("Ticket accepted and checked in") → replay → **"Already checked in."** → Regular@VIP → **"not valid for this gate. Permitted gates: Main Gate"** (WRONG_GATE) → malformed QR → **"Invalid TicketUG QR"** → unknown credential → **"Ticket could not be found."** → unauthenticated `/scanner` → 307 `/sign-in?next=/scanner`.
- **Data integrity (§26):** browser state = API state = Supabase state — capacities (Regular 50→48, VIP 10→9), 2 orders PAID, 2 payments SUCCEEDED (test provider), 3 tickets (2 ISSUED + 1 CHECKED_IN), 1 check_in row with scanner, gate-scoped assignment ACTIVE, memberships correct. No phantom state; no hardcoded IDs.
- **Payment boundary (§21/§27):** re-proven in production runtime → `POST …/payment/test-complete` → **503 TEST_PAYMENT_DISABLED**. Staging test path clearly separate (NODE_ENV ≠ production + PAYMENT_MODE=test).
- **Console:** zero errors/warnings across all visited pages (landing, events, detail, order, ticket, scanner, admin guard redirect).
- **Ops note (environment, not repo):** the sandbox pre-seeds an ambient `DATABASE_URL=file:…/custom.db`; `next start` does not override pre-set env vars with `.env` — launches must source `.env` explicitly (cost one debugging round; recorded here for future runs).

### 19.7 Secrets/CORS/cookies audit (§16/§17/§27)

- Tracked-tree scan: no connection-string fragments, no real key material, no private keys, no `service_role`, no `NEXT_PUBLIC_*`, no `BETTER_AUTH_SECRET`/`NEON_*` in code (docs updated; `PHASE_3_AUDIT.md` keeps its dated historical mentions). `.env` gitignore re-verified (`git check-ignore`).
- Client-bundle safety: no `'use client'` component imports Supabase modules; `lib/supabase/*` reachable only from route handlers/server components; the anon key never leaves the server side.
- Cookies: `sb-<ref>-auth-token` HttpOnly + Secure + SameSite=Lax (server-written); old `__Secure-neon-auth.*` cookies are gone with the old SDK. CORS: unchanged fail-closed allow-list (`WEB_ORIGIN`, exact origins, credentials, no wildcard).
- The Supabase connection string appears ONLY in the gitignored `.env` and NI's own store — never in docs, logs, diffs, or this report.

### 19.8 Deployment readiness matrix (§33) — evidence-based

| Area | Before (Neon, a53fe34) | Supabase | Status | Evidence |
| --- | --- | --- | --- | --- |
| PostgreSQL connection | LOCAL VERIFIED (Neon stand-in TLS staging) | **SUPABASE VERIFIED** | session pooler, PG 17.6, strict TLS w/ pinned CA | probe + harness + readiness |
| Migrations | LOCAL VERIFIED (manual psql; no runner) | **SUPABASE VERIFIED** | runner BUILD; 8/8 applied; re-run idempotent; ledger 8 rows | runner output + ledger |
| Schema | LOCAL VERIFIED | **SUPABASE VERIFIED** | 74/74 checks | verify-schema.mjs |
| Auth | LOCAL VERIFIED (Better Auth stand-in) | **LOCAL VERIFIED** on GoTrue wire contract; hosted live flows **BLOCKED** (anon key) | full browser+wire matrix vs stand-in; real-JWKS forged rejection | §19.6 |
| User mapping | out-of-repo (Neon-side) | **SUPABASE VERIFIED** | `ensureUserProfile` row proven in Supabase | §19.6 query |
| API | LOCAL VERIFIED | **SUPABASE VERIFIED** | health/readiness (real SELECT 1) on 2 instances; journeys via Bearer path | §19.6 |
| Frontend | LOCAL VERIFIED | **SUPABASE VERIFIED** (DB); hosted **BLOCKED** | env-less build + production-start journeys | §19.6 |
| Organizer | LOCAL VERIFIED | **SUPABASE VERIFIED** | workspace/event/types/gates/permissions/invite/assignment/transitions | §19.6 |
| Orders | LOCAL VERIFIED | **SUPABASE VERIFIED** | 2 guest orders PAID (20,000 + 50,000 UGX) | DB cross-check |
| Tickets | LOCAL VERIFIED | **SUPABASE VERIFIED** | 3 ISSUED (1→CHECKED_IN) + capacity decrements | DB cross-check |
| PDF | LOCAL VERIFIED | **SUPABASE VERIFIED** | wire headers + %PDF magic + wrong-token 404 | §19.6 |
| Gates | LOCAL VERIFIED | **SUPABASE VERIFIED** | permissions + CASCADE + harness section E | §19.4 |
| Scanner | LOCAL VERIFIED | **SUPABASE VERIFIED** | 5-scan browser matrix + 46-check harness | §19.4/§19.6 |
| Security | LOCAL VERIFIED | **LOCAL VERIFIED** | §19.7 audit + fail-closed proofs | §19.7 |
| Mobile | LOCAL VERIFIED | **SUPABASE VERIFIED** | 390 px: no horizontal scroll on landing/detail/ticket; QR + PDF present | screenshots |
| Hosted frontend/API | BLOCKED BY EXTERNAL ACCESS | **BLOCKED** | Vercel/API-host dashboards unreachable | manual steps 1/3 |
| Hosted Supabase Auth live flows | BLOCKED BY EXTERNAL ACCESS | **BLOCKED** | anon key required (not supplied; not derivable) | manual steps 2b |

### 19.9 Git note (honest)

Commit identity verified (Natural Intellects Ltd). `origin/main` still points at `16bc73d` — Pair 4's push was blocked by absent credentials and Pair 5 adds its commit on top locally. If the push fails again, the commit exists locally on `main` and must be pushed by NI (or a credentialed run) — flagged, not hidden. No force-push, no history rewrite, no branch deletion.

**Next recommended pair:** NI executes BLOCKERS 1-4 of `docs/DEPLOYMENT_MANUAL_STEPS.md` (Vercel branch+env incl. the Supabase anon key, API hosting, Supabase dashboard security check), then a hosted verification run flips §19.8 to HOSTED row by row. Optional code follow-ups (only after hosted verification): sweeper scheduler wiring remains deployment work; organizer event-creation date-picker is automation-unfriendly (human UI fine, proven in Pair 3).

## 20. Pair 5.1 record (2026-09-29) — hosted deployment readiness audit + operator handoff

**Pair 5.1 = move Pair 5's Supabase migration through the hosted boundary (GitHub → Vercel → hosted NestJS API → hosted Supabase Auth), with AUDIT FIRST and zero fabrication.** Starting commit `f8b22d5` (clean tree). The environment's external-access audit (below) determined that the hosted half is BLOCKED on NI credentials; this pair therefore (a) independently re-verified every Pair 5 claim, (b) fixed the one stale migration leftover found, (c) re-proved the production runtime against the real Supabase DB, and (d) produced exact operator checklists. HARD STOP after.

### 20.1 Environment access reality (determined, not assumed)

```text
GitHub push       : BLOCKED — no credentials (push dry-run: "could not read Username for
                    'https://github.com'"). origin/main = 16bc73d; local main = f8b22d5
                    (Pairs 4+5 commits a53fe34 + f8b22d5 unpushed).
Supabase Postgres : REACHABLE — real session-pooler DATABASE_URL in gitignored .env
                    (project vmebmexwqfpnlioicqgj, aws-1-eu-central-1).
Supabase Auth     : PARTIAL — public JWKS reachable (no key needed); every other GoTrue
                    surface requires the anon key, which is NOT in this environment
                    (.env still holds Pair 5's LOCAL STAND-IN url+key — must be replaced).
Vercel            : NO ACCESS (no token/CLI) — production branch/env unobservable.
API hosting       : NO ACCESS (no Railway/Render/Fly/VPS credentials; none invented).
```

### 20.2 Repository audit + decision matrix (§2/§4)

```text
RETAIN    f8b22d5 as-is: Supabase architecture (Next ⇄ NestJS ⇄ raw pg ⇄ Supabase), auth
          integration, migration runner + ledger, TLS pinning, CORS/cookies, payment gate.
          No stale cron/round-10-settings branch locally or remote; no unexpected commits.
REFACTOR  apps/api/src/integration/database.integration.test.ts — Neon-era test asserted the
          neon_auth schema MUST exist (contradicts migrated architecture; inert because the
          suite skips it without TEST_DATABASE_URL). Fixed to assert: ticketug present,
          Supabase auth schema present, neon_auth ABSENT. Re-run green vs real Supabase
          (strict TLS via sslmode=verify-full + bundled sslrootcert).
DOCUMENT  docs/migrations/011-gates.sql line ~22 carries a stale "NOT production-applied /
          BLOCKED until the real Neon…" provenance comment (written before Pair 5 applied
          it). NOT edited — the migration runner's checksum-drift detection makes any byte
          change a ledger violation. Recorded here instead; the ledger (not the comment) is
          authoritative.
REPLACE   none. BUILD   none (hosted glue is configuration, not code).
```

Neon-reference sweep of the tracked tree (excluding dated audit-history docs): remaining mentions are deliberate historical comments (supabase-auth.ts, api-forward.ts, auth.ts, user-profile.ts, ADRs, staging-verify stub, lockfile peer-range for drizzle-orm) — RETAIN. `@neondatabase` is NOT installed in node_modules.

### 20.3 Independent re-verification of Pair 5's claims (all reproduced)

- **Baseline (§5):** root 121|1, api 52|1, typecheck PASS, lint PASS, api:build PASS, env-less next build PASS — identical to Pair 5's report.
- **Supabase project (§7):** PG 17.6 (session pooler, strict TLS); 23 tables; ledger 8/8 (000 + 005→011); 37 FKs / 82 indexes / 292 constraints / 2 behavioral triggers; RLS off (by design); pgcrypto + uuid-ossp present; `auth.users`/`sessions`/`refresh_tokens`/`identities` = 0 (hosted auth never used).
- **000-base-foundation.sql (§8):** CASE A RETAIN — every file-defined base column exists live with matching type + length (incl. varchar lengths), all 17 FKs from 005→011 resolve, provenance claims verified in `apps/api/src/users/users.controller.ts` + `app/api/profile/route.ts`. No live-only base columns. Not rewritten.
- **TLS (§15):** all audit connections ran `rejectUnauthorized:true` against ONLY the bundled CA (functional proof); explicit chain extraction (`openssl s_client -starttls postgres`) shows leaf → intermediate → root with the bundled CA's fingerprint matching the live root exactly (`80:70:25:AD:…:CA:FA`, per certs/README.md).
- **PostgREST exposure (§16):** REST root 401 without apikey and 401 with garbage key; SQL: `anon` role has NO USAGE on `ticketug` + zero table grants; `public` schema empty. `ticketug` is not browser-reachable (structural + privilege-level proof).
- **Auth surfaces (§10):** public JWKS = 1 ES256/P-256 key (no apikey needed — the API guard's exact dependency); GoTrue health/settings 401 without key. Email-confirmation/site-URL/redirect settings remain dashboard-only (manual steps 2b).
- **Data protection (§9):** zero destructive SQL; audit scripts were read-only. ONE finding: `ticketug.webhook_event` holds 2 orphaned rows from Pair 5's own browser run (provider `test`, 2026-09-29 08:37/08:40, 20,000 + 50,000 UGX; referenced orders absent; `provider_reference` carries no FK). Left in place (pre-existing-records rule); NI may delete those exact IDs.

### 20.4 Production runtime re-verification at the current tree (real Supabase DB, local stack)

- **Compiled API smoke (8/8):** `/health` 200 · `/readiness` 200 (real SELECT 1) · `/docs` 200 · no-creds 401 · garbage bearer 401 · forged JWT (real issuer, fake ES256 signature) 401 (JWKS local verification) · production payment gate `POST /public/orders/:id/payment/test-complete` → **503 TEST_PAYMENT_DISABLED** (gate fires before any lookup) · disallowed-origin preflight → no ACAO.
- **Production `next start`:** `/` 200 (Upcoming / Find-an-event sections render); `/events` 200 (`<h1>Events in Uganda</h1>` + honest empty state — DB is empty); `/scanner` 307 → `/sign-in?next=/scanner`; `/organizer` 307 → `/sign-in`; **agent-browser: zero console errors/warnings** on landing + /events (DB-empty honest states confirmed in a real browser).

### 20.5 Deployment readiness matrix (§38/§39) — evidence-based

| Area | Status | Evidence |
| --- | --- | --- |
| Repo commit/tree, tests, typecheck, lint, both builds | **VERIFIED (local)** | §20.3 baseline re-run; clean tree |
| Supabase DB: schema/migrations/ledger/TLS | **SUPABASE VERIFIED** | §20.3 SQL audit + fingerprint match |
| PostgREST non-exposure (defense-in-depth) | **SUPABASE VERIFIED** | key-gating probes + anon-privilege SQL |
| API runtime + auth fail-closed + payment gate + CORS | **SUPABASE VERIFIED (local runtime)** | §20.4 smoke 8/8 |
| Public pages render + browser console | **SUPABASE VERIFIED (local runtime)** | §20.4 next-start + agent-browser |
| GitHub push of a53fe34 + f8b22d5 | **BLOCKED** | no credentials (operator checklist, BLOCKER 0) |
| Vercel production deploy (branch/env) | **BLOCKED** | no Vercel access (BLOCKERS 1–2) |
| Hosted NestJS API | **BLOCKED** | no hosting access (BLOCKER 3) |
| Hosted Supabase Auth live flows (sign-up/in, mapping on hosted auth) | **BLOCKED** | anon key not in environment (BLOCKER 2b) |
| Hosted browser journeys (guest/organizer/staff/mobile/security matrix §18–§30) | **BLOCKED** | depend on the three rows above (BLOCKER 5) |

**Final status: HOSTED — BLOCKED** (hosted boundary not yet crossable from this environment). Local/DB verification status is stronger than Pair 5 left it: every reachable row re-proven at the current tree. NOT "production ready".

### 20.6 Operator handoff

`docs/DEPLOYMENT_MANUAL_STEPS.md` gained **BLOCKER 0 (push Pairs 4+5 commits to GitHub)** — it gates everything else, because Vercel deploys FROM GitHub. Existing BLOCKERS 1–5 refreshed where stale. Local `.env` stand-in values (`SUPABASE_URL=http://localhost:5998`, stand-in anon key) must be replaced with the real project values in each hosting secret store — never in git.

**Next recommended phase:** NI executes BLOCKER 0 → 1 → 2a/2b → 3 (in order), then a hosted verification run (Pair 5.2) flips §20.5's BLOCKED rows to HOSTED row by row using the §18–§30 journey matrix. No code changes are expected to be needed for the hosted flip — the architecture is deployment-complete at `f8b22d5` (+ this pair's one test-file fix).

## 21. Pair 6 record (2026-09-29) — NestJS removal & Supabase-native backend

**Pair 6 = remove the separately hosted NestJS API while preserving every security, authorization, tenant-isolation, transactional and payment guarantee.** Starting commit `7bd1c11` (clean tree). Design-first: `docs/NESTJS_REMOVAL_AUDIT.md` (52-endpoint inventory + decision matrix) and `docs/SUPABASE_NATIVE_ARCHITECTURE.md` were produced before any deletion. HARD STOP after.

### 21.1 What changed (decision outcomes)

```text
REPLACE (→ PostgreSQL functions, migration 012 — the transactional authority):
  ticketug.create_order            atomic order creation (guest+user): idempotency,
                                   deterministic FOR UPDATE lock order, event
                                   SALES_OPEN/PUBLIC + sale-window checks, guarded
                                   decrement (the oversell barrier), price snapshots
  ticketug.cancel_order            ownership/guest-hash re-verified cancel: inventory
                                   restore (guarded increment) + payment teardown
  ticketug.expire_order_if_due     lazy payment-window expiry (read/initiate paths)
  ticketug.expire_stale_orders     bounded sweep (FOR UPDATE SKIP LOCKED)
  ticketug.apply_payment_event     verified-webhook core: (provider, event) dedupe,
                                   amount/currency/order-reference checks, payment +
                                   order state machines, TICKET ISSUANCE (credential
                                   + sha256 + snapshots, issuance-event idempotency)
  ticketug.transition_event_lifecycle  centralized lifecycle machine, membership +
                                   owner-only rules re-verified inside, guarded UPDATE
REPLACE (→ Next.js server layer, lib/server/*): orders (create/list/get/cancel,
  guest get/cancel/rekey), payments (initiate w/ provider call inside one
  transaction, status, test-complete, webhook apply), tickets (reads + QR + PDF),
  event transition, system sweep route, upgraded readiness (real SELECT 1).
REPLACE (→ lib/rules/*, git-mv preserving history): event-lifecycle, order-rules,
  payment-rules, gate-rules, ticket-type-rules, tickets qr/pdf/contracts.
RETAIN (already Supabase-native before this pair): organizer/team/invitation/gate/
  staff/ticket-type/event-create routes, scanner (extracted to lib/server/check-ins.ts),
  profile, public discovery, auth session resolution, migration runner, TLS posture.
REMOVE: apps/api (59 files), @nestjs/* + class-validator/transformer + reflect-metadata
  + rxjs + helmet + drizzle-orm + jose deps, lib/api-forward.ts, lib/ticket-pdf-proxy.ts,
  Swagger, the Nest-side duplicate scanner, API_ORIGIN/WEB_ORIGIN/API_PORT/API_HOST.
DEFER (Case F): Edge Functions (only a future LIVE provider webhook would need them;
  requires a Supabase access token this environment lacks). RLS stays OFF (unchanged
  trusted-pool access path; smallest secure surface — ADR 0006).
```

### 21.2 Browser contract preserved

All 15 former proxy routes kept their URLs, methods, rate limits, cookie behavior and
response shapes (`{message,error,statusCode}` error bodies included — Nest reason
phrases mapped in `lib/server/errors.ts`). The UI (checkout, account, guest pages,
lifecycle controls) is untouched. One intentional improvement: the user-path cancel
of an uncancelable order now returns 409 (was an unhandled 500 in Nest).

### 21.3 Behavior changes that are deliberate (documented)

- **Payment gate stronger:** the gate now lives in the Next process; `next start`
  forces NODE_ENV=production, so the simulated provider is refused on every
  production runtime — even with PAYMENT_MODE=test set (proven: 503). The staging
  path is exercisable only in non-production processes (next dev / staging runtime).
- **Initiate idempotency unified:** a replay with the same idempotency key returns
  the original attempt regardless of its status (the safer of the two previous
  code paths; guest PAID-order initiation still answers 409 ORDER_EXPIRED exactly
  as before).

### 21.4 Verification (all against the REAL Supabase DB unless noted)

- **SQL-function matrix (`scripts/staging-verify/verify-sql-functions.ts`): 28/28** —
  guest/user order creation, inventory decrement, guest idempotency conflict,
  insufficient/inactive/duplicate-type rejections, user idempotent reuse,
  **6-way concurrent oversell barrier (exactly 1 winner, 5 clean rejections,
  capacity never negative)**, wrong-guest-token cancel denial, cancel restore,
  double-cancel state machine, expiry + restore + second-call no-op,
  webhook apply → PAID + 3 tickets, same-event replay DUPLICATE, new-event
  replay on SUCCEEDED attempt DUPLICATE (no dup tickets), wrong amount 422,
  wrong order reference 422, non-member transition denial, full lifecycle walk,
  illegal-jump rejection, cleanup leaves zero records.
- **Behavioral harness (`verify-gates.ts`, refactored onto the new modules): 57/57** —
  migration-011 objects, real issuance through the SIGNED-WEBHOOK path
  (HMAC → apply_payment_event), issuance idempotency, complete scanner matrix
  (VALID/ALREADY_CHECKED_IN/WRONG_GATE×3/event-wide/disabled-gate/unassigned/
  outsider/WRONG_EVENT/INVALID_QR/INVALID_TICKET/EVENT_NOT_AVAILABLE/SUSPENDED-
  scannable/admin-bypass), gate-deletion CASCADE fail-closed, DB-backed PDFs
  (owner + guest + wrong-token refusal).
- **Wire-level guest journey (dev-mode server + real DB):** order 201 → initiate
  PROCESSING (test provider) → status → test-complete PROCESSED → order PAID →
  2 tickets ISSUED → QR data URL → PDF (200, application/pdf, no-store, safe
  filename, 8,441-byte %PDF) → wrong-token PDF 404 → initiate replay 409
  ORDER_EXPIRED → test-complete replay 200 DUPLICATE.
- **Webhook route:** signed POST → PROCESSED (order PAID + ticket issued);
  replay → DUPLICATE; garbage signature → 400; empty body → 422
  RAW_WEBHOOK_BODY_REQUIRED. Sweep route: 401 without/wrong secret; 200 +
  JSON with the correct secret.
- **Production gate:** `next start` (NODE_ENV=production) with PAYMENT_MODE=test
  still answers 503 TEST_PAYMENT_DISABLED — fail-closed even when misconfigured.
- **Browser (production build, real DB):** landing, /events (real event card),
  event detail, guest order page (recovery-link adoption + clean URL rewrite),
  guest ticket page with QR; desktop + 390 px (no horizontal overflow); console
  clean. Note: under `next dev` the guest pages' params-promise resolution
  stalls (pre-existing Next-16 dev quirk on an untouched page — production
  build unaffected; Pair 5 verified the same page on the production build).
- **Suites:** root vitest 103 passed (rules/tickets/payments moved + provider
  test ported to ApiError), typecheck PASS, lint PASS, `next build` PASS.

### 21.5 Data safety

All verification records were marked (`p6-verify*`, `p6journey*`, harness
`verify-*`) and removed; final census: **0 data rows in every ticketug table,
migration ledger 9/9, `auth.users` = 0 (untouched)**. The 2 orphaned Pair-5
`webhook_event` rows (documented in Pair 5.1 as safe-to-delete) were removed by
the harness-scope cleanup.

### 21.6 Operator handoff

`docs/DEPLOYMENT_MANUAL_STEPS.md` rewritten for the new shape: the old BLOCKER 3
(host the API) is OBSOLETE — the stack is Vercel + Supabase only. Remaining NI
actions: BLOCKER 0 (push), 1 (Vercel branch → main), 2a (DATABASE_URL,
SUPABASE_URL, SUPABASE_ANON_KEY — **API_ORIGIN is no longer needed**), 2b (anon
key → hosted auth), 4 (exposure check), 5 (hosted browser pass).

**Next recommended phase:** NI executes BLOCKERS 0 → 1 → 2a/2b, then a hosted
verification run flips §21's local rows to HOSTED. Future extension points
(documented, not built): Edge Function for a live provider webhook; PostgREST
read views + RLS for a future mobile client; scheduler wiring for the sweep.

## 22. Production deployment gate (2026-09-29) — final readiness pass

Starting commit `41f01a3` (the forensic-audit baseline). Directive: final
production deployment/verification gate — audit first, change only what the
evidence requires; preserve all working functionality; no new features, no
live payments, no architecture change.

### 22.1 Forensic re-audit (what the tree actually looked like)

- `HEAD = 41f01a3`, clean tree, `main` = `origin/main` (0 unpushed) at gate
  start — the verified baseline was intact.
- NestJS residue re-checked from the working tree: **zero** tracked NestJS
  code/deps/config (`git ls-files apps/` = 0; no `@nestjs/*`, `NestFactory`,
  `API_ORIGIN`, `/api/v1` in tracked files; `package.json` clean). Only
  untracked `apps/api/dist/` + `apps/api/node_modules/` build artifacts and
  the obsolete `.gitignore` rule remained — both REMOVED (sandbox working
  tree + `.gitignore` line). Historical NestJS mentions in `docs/` left
  untouched (records).
- Supabase key usage (CASE analysis): the app is **CASE C** —
  `SUPABASE_URL` + `SUPABASE_ANON_KEY` (the publishable-key slot) server-side
  via `@supabase/ssr`; the browser never calls Supabase (zero
  `NEXT_PUBLIC_*`); **no secret key is required** because all privileged
  operations are PostgreSQL via `DATABASE_URL` + SECURITY DEFINER functions
  (`lib/supabase-config.ts`, `lib/supabase/server.ts`, `lib/db.ts` are the
  complete Supabase surface). New `sb_publishable_…` keys drop into
  `SUPABASE_ANON_KEY` with no code change (ssr@0.12.7 / supabase-js@2.117.2
  support them natively). Legacy anon/service_role are documentation/history
  only.
- Pre-gate data safety census (real DB): all ticketug data tables 0 rows,
  ledger 9/9 (000, 005–012), `auth.users` = 0 — pre-launch empty; harness
  runs were safe.

### 22.2 Environment-variable audit (§5 matrix in PRODUCTION_READINESS_REPORT)

Runtime truth from `process.env` references + zod schema: `DATABASE_URL`
(required, pg Pool, TLS-pinned CA), `SUPABASE_URL` + `SUPABASE_ANON_KEY`
(required in production — fail-closed throw in `resolveSupabaseConfig`),
`CRON_SECRET` (optional, sweep 401s without it), `PAYMENT_WINDOW_MINUTES`
(optional), `PAYMENT_TEST_WEBHOOK_SECRET`/`PAYMENT_MODE`/`PAYMENT_PROVIDER`
(must be unset in production), `SUPABASE_CA_CERT` (optional override),
`TEST_DATABASE_URL` (tests only). Exactly ONE database URL is used at
runtime (`DATABASE_URL`); `DIRECT_DATABASE_URL`/`POSTGRES_URL` appear
nowhere. Obsolete `API_ORIGIN` removed from the local `.env`.

### 22.3 Database guarantee re-verification (§6 — real DB, no schema changes)

- **SQL-function harness: 28/28 PASSED** (oversell barrier, cancel/expire
  state machines, idempotent issuance, lifecycle) — same result as Pair 6.
- **Behavioral harness: 57/57 PASSED** (signed-webhook issuance, 18-scanner
  matrix, CASCADE fail-closed, PDFs) — same result as Pair 6.
- Post-harness census re-verified: **0 data rows, ledger untouched,
  `auth.users` = 0** (harness artifacts truncated via the harness's own
  documented reset list).
- Sandbox note worth keeping: the dev-sandbox shell exports its own
  `DATABASE_URL` (`file:/home/z/my-project/db/custom.db`), and real
  environment variables override Bun's `.env` auto-load — harness runs must
  pass the real URL explicitly (`DATABASE_URL=$(grep '^DATABASE_URL=' .env |
  cut -d= -f2-) bun scripts/… `) or lib/db silently targets the sandbox file
  (observed as ECONNREFUSED localhost:5432 before diagnosis).

### 22.4 Expiry sweep — WIRED (§8 BUILD, smallest safe implementation)

- `vercel.json` (NEW): Vercel Cron **daily at 03:00 UTC** →
  `/api/system/orders/expire-stale` — the most frequent cadence the Vercel
  Hobby plan permits (a `*/5 * * * *` schedule REJECTS the deployment on
  Hobby; observed live: the push with `*/5` never went live while previous
  deploys took ~20 s).
- Route: shared auth helper; accepts `x-cron-secret` (external schedulers)
  AND `Authorization: Bearer <CRON_SECRET>` (Vercel Cron's automatic form);
  added GET handler (Vercel Cron dispatches GET); fail-closed 401 when
  `CRON_SECRET` unset — unchanged. Idempotency of the sweep was already
  proven (SKIP LOCKED + second-call no-op in the SQL harness).
- Operational condition: Vercel Hobby permits daily crons only — the deployed
  schedule is therefore daily 03:00 UTC; safe because every order/payment
  read path lazily expires due orders (`expire_order_if_due`), so the cron is
  a backstop, not the primary expiry mechanism. Tightening to `*/5 * * * *`
  requires Vercel Pro or an external scheduler (same endpoint, same secret
  header).

### 22.5 Local pipeline + payment boundary (§7, §10)

- vitest **103/103**, typecheck PASS, lint PASS, `next build` PASS.
- Payment boundary retained: simulated provider 503 `TEST_PAYMENT_DISABLED`
  on any production runtime; issuance only via the verified webhook path;
  replay/amount/currency/order mismatches rejected (harness-verified).

### 22.6 Deployment status

- No Vercel project changes were needed (GitHub-connected auto-deploy on
  `main`; previously observed ~20 s deploys). The gate commit pushes and
  auto-deploys.
- BLOCKER 2a/2b rewritten in `DEPLOYMENT_MANUAL_STEPS.md` for the NEW
  Supabase API keys: `sb_publishable_…` → `SUPABASE_ANON_KEY`; **do NOT set
  `SUPABASE_SECRET_KEY`**; no `NEXT_PUBLIC_*`; add `CRON_SECRET`.
- Hosted auth + hosted browser journeys remain gated on NI's Vercel env pass
  (secret store) — the only remaining BLOCKED items; see
  `docs/PRODUCTION_READINESS_REPORT.md` for the full VERIFIED / CONFIGURED /
  DEFERRED / BLOCKED breakdown.

## References

- NI Master Production-Hardening, Completion & Feature-Rollout Directive (user directive, 2026-09-26) — the operating contract for all future runs: INSPECT→CLASSIFY→DECIDE→IMPLEMENT→TEST→VERIFY→DOCUMENT; CASE A–E framework; §35 per-run output contract.
- Sandbox handover log: `/home/z/my-project/worklog.md` (dev-sandbox only, not in repo).
