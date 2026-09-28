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
- **HEAD: `f5e31de` — local main = origin/main (push RESTORED; push auth lives only in the clone's `.git/config`, never in tracked files).**
- Commit chain: `85c22fc` (round 10) → `80f7936` (reconciliation: continuity docs, auth-secret floor, copy fixes) → `5e7f80b` (contact page ported from v0 with real NI numbers + header link) → `f5e31de` (v0 retired via `git merge -s ours` — tree byte-identical, branch now a true ancestor; every remote branch is merged into main).
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
| Scanner & check-in (event-level) | IMPLEMENTED | 2 (+ live smoke) | Assignment (staff must hold ACTIVE assignment), token checks, duplicate/used handling, history |
| **Gate-level access model** (scanner→gate, ticket→permitted gates) | **MISSING** | 0 | Current assignment is event-level only. Roadmap Pair 3A. Do not duplicate existing logic when adding |
| Platform admin | PARTIAL | 2 | Read-only real-metric overview + role gate (PLATFORM_SUPPORT/ADMIN/SUPER_ADMIN); no management surfaces, no moderation actions |
| Event moderation/review workflow | MISSING | 0 | Lifecycle has SUSPENDED but no platform review states (UNDER_REVIEW/NEEDS_CHANGES). Roadmap Pair 8B |
| Organizer KYC / agreements | MISSING | 0 | Roadmap Pair 8A + §18–20; LEGAL/COMPLIANCE DECISION REQUIRED markers mandatory |
| Notifications (email/SMS) | MISSING | 0 | Invitations/recovery are link-based today. Roadmap Pair 5; build channel abstraction |
| Public event discovery/browse | **MISSING** | 0 | No /events index or search; landing does not list events. Events reachable by direct URL only |
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

## 12. Core Completion Dependency Matrix (Phase C audit, 2026-09-28)

Evidence-based audit of the 20 remaining CORE production requirements. Every state below was verified against the code at `f5e31de` (file:line evidence in the sandbox worklog, Task 17). Verification levels per §25; "SOURCE-verified absence" means exhaustive searches confirmed the capability does not exist anywhere in the repo.

Key code anchors: issuance is **webhook-only** (`payments.service.ts:57–81` → `assertPaidOrder` requires order `PAID` + payment `SUCCEEDED`, `ticket.rules.ts:3`; idempotent via `ticket_issuance_event`); the provider seam is real (`PaymentProviderAdapter`, `payment.contracts.ts:6–10`; test provider prod-refused, `payment.provider.ts:35–42`); QR credential is a 256-bit opaque token (`tkt_<32 random bytes>`, sha256 lookup, `tickets.service.ts:26`, `ticket.qr.ts`); the public visibility predicate **already exists** (`publication_state='PUBLIC' AND discoverable=true`, set on the PUBLISHED transition, `event-lifecycle.ts:24–28`, enforced on the detail page `app/events/[slug]/page.tsx:16` and Nest `public/events/:slug`) — but **no list surface exists anywhere** (landing is static; the Nest guard whitelists only singular public detail); the scanner is event-level with `UNIQUE(ticket_id)` replay protection (`check-ins.service.ts:28–64`, `010-check-in.sql`); platform admin is read-only counts with DB-seeded `platform_role` and zero mutating endpoints; refund/settlement/ledger/gate/moderation/KYC/notification code is confirmed absent.

| # | Requirement | Current implementation | Verification level | Dependency | Blocker | Recommended action |
|---|---|---|---|---|---|---|
| 1 | Public event discovery | MISSING — no `/events` index, no list endpoint anywhere, landing lists zero events | SOURCE-verified absence | Nothing upstream — visibility predicate already exists | None (in-sandbox buildable) | **BUILD — single next batch** (see D) |
| 2 | Public visibility/query architecture | PARTIAL — predicate enforced on public detail (Next + Nest), `discoverable` set on PUBLISHED; no list/search/pagination | L2 (predicate mapping unit-tested; detail live-smoked) | Feeds discovery (#1) and moderation (#3) | None | Extend the same predicate into ONE shared list-query module (single source of truth) |
| 3 | Event moderation/governance | MISSING — 9 lifecycle states incl. SUSPENDED; no UNDER_REVIEW/NEEDS_CHANGES; admin has zero mutating endpoints | SOURCE-verified absence | Admin mutation surfaces (#12); new forward-only migration; publication predicate (exists) | NI policy decision: pre-publication review vs trust-first | Build structure after discovery; extend (never alter) the 005 CHECK |
| 4 | Organizer verification/KYC foundation | MISSING — no verification step or columns; organizer creation ungated | SOURCE-verified absence | Gates unrestricted publishing (product decision); admin review queue (#12); migration | NI KYC policy/legal (external) | Schema + queue foundation once policy decided; do not invent requirements |
| 5 | Organizer agreement/terms acceptance | MISSING — no agreement/consent capture anywhere | SOURCE-verified absence | Gates publishing; mechanism = versioned acceptance record (version + timestamp + text hash) | Approved agreement text (NI/legal — external) | Build acceptance-record mechanism with LEGAL/COMPLIANCE DECISION REQUIRED markers; never invent contract language |
| 6 | Live payment provider | Test pathway IMPLEMENTED on a real seam (adapter interface, prod-refused test provider, raw-body webhook verify, `webhook_event` idempotency, amount/currency/reference cross-checks); live adapter absent | L2 (adapter + HMAC webhook contract unit-tested) | Root of the money chain | **PROVIDER SELECTION GATE**: Uganda, MTN/Airtel MoMo, cards, webhooks, signature verification, idempotency, refunds, split settlement, settlement timing, reconciliation, sandbox, production, fees, support, compliance | Produce ≥3-provider decision matrix; integrate through the existing seam; NyloPay/Nylon Pay = candidate only, NOT approved |
| 7 | Model A split-settlement | MISSING — fee/settlement deliberately deferred (PHASE_8/11) | SOURCE-verified absence | Provider capability proof (#6): organizer settlement + platform fee; NI must not custody funds unnecessarily | Provider selection + capability verification | Design after provider confirmed; no settlement-timing claims until provider-documented |
| 8 | PDF/digital ticket generation | MISSING — zero pdf libraries; digital = QR data-URL page + ICS only | SOURCE-verified absence | Ticket snapshots + QR payload exist (`ticketug:v1:<credential>`); independent of live payments | None for build; L3+ verification needs real env | BUILD: server-side PDF with embedded QR; backend stays authoritative; QR remains the opaque credential |
| 9 | Gate-level ticket access permissions | MISSING — no gate tables/columns; `event_staff_assignment` is event-level only | SOURCE-verified absence | `ticket_type` (exists) + assignment (exists, extend) + new forward-only migration | None code-wise | BUILD with #10 as one batch; extend the 010 model, never duplicate scan logic |
| 10 | Scanner/check-in + gate integration | PARTIAL — event-level scanner IMPLEMENTED (platform bypass / active membership / EVENT_STAFF needs ACTIVE assignment; validates payload shape + credential hash + event match + ISSUED status; `UNIQUE(ticket_id)` + `FOR UPDATE` replay protection; `check_in` log; online-only) | L2 + live guard smoke | Gate filtering depends on #9 | None | Extend scan authorization with a permitted-gate predicate after #9; fix minor mapping gap (cancelled event surfaces UNAUTHORIZED_SCANNER instead of EVENT_NOT_AVAILABLE) |
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

**SINGLE NEXT IMPLEMENTATION BATCH: Public event discovery + visibility list architecture.** Rationale: zero external blockers; the visibility predicate is already implemented and unit-tested (set on the PUBLISHED transition, enforced on the public detail route); it extends one predicate into a shared list module (single source of truth for #2 before moderation lands); it unlocks the platform's storefront; deterministic signals only (SALES_OPEN first), honest empty states, no fake data. Scope: shared list-query module + Next route handler + `/events` index + landing "Upcoming events" section + tests.

## References

- NI Master Production-Hardening, Completion & Feature-Rollout Directive (user directive, 2026-09-26) — the operating contract for all future runs: INSPECT→CLASSIFY→DECIDE→IMPLEMENT→TEST→VERIFY→DOCUMENT; CASE A–E framework; §35 per-run output contract.
- Sandbox handover log: `/home/z/my-project/worklog.md` (dev-sandbox only, not in repo).
