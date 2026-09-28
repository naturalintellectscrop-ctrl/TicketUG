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
- HEAD before the reconciliation run: `85c22fc` (round 10). The reconciliation run (this doc + changelog + 3 core fixes) is the next commit on main.
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
| `v0/ticketug-sitewide-motion` @ cc93ca9 (7 commits, 43 files) | Pre-cron: sitewide dark styling pass, motion shell, Nest check-ins module, staff assignment, contact page | **SUPERSEDED** — check-ins/staff re-implemented better on main (round 1); styling evolved independently through 10 rounds | DO NOT MERGE. **PORT candidates only**: `app/contact/page.tsx` (real NI support numbers — verify with NI first) and universal back-navigation idea. Evaluate during Phase C polish. |
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
| Support/legal static pages | MISSING | 0 | Contact page exists only on v0 branch (port candidate) |
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

## 9. Database / migration status (KNOWN BLOCKER — do not "fix" carelessly)

- Tracked: `005-events`, `006-ticket-types`, `007-orders`, `008-payments` (repaired CHECK + payment-state CHECK + partial expiry index), `009-tickets`, `010-check-in`. Forward-only, manually applied (psql). **No runner.**
- **001–004 are absent from the repo** — `organizer`, `user_profile`, `organizer_member`, `organizer_invitation` DDL is untracked. The code deliberately writes defensively around unknown CHECK constraints (membership removal DELETEs rows; invitation revoke expires-in-place; no invented status values).
- **Do NOT fabricate 001–004 or add a runner blind** — rebuilding these tables wrong against the real Neon DB would be destructive. Recovery requires access to the real database (`pg_dump --schema-only`) or NI's original SQL. Until then: fresh-database setup does NOT work from the repo alone.
- Never use production DB as a test DB. Never write destructive migrations without explicit justification.

## 10. Roadmap position & next recommended task

Directive phase position: **Phase A (reconciliation) COMPLETE → Phase B (gap matrix) COMPLETE → Phase C (fix core blockers) NEXT.**

Phase C priorities, highest first:
1. **Real-environment unblocking** (deployment task): Neon credentials → apply/verify migrations, capture `pg_dump` schema snapshot of the untracked tables (retires the 001–004 risk), wire the sweeper scheduler.
2. **Public event discovery/browse** (core gap): a `/events` index (public, discoverable, SALES_OPEN first) + landing page event listing — deterministic signals, no fake data.
3. **Migration runner + committed schema snapshot** once the real DB is reachable.
4. **Port candidates** from v0: contact page (verify NI phone numbers first), back-navigation.
5. Refactor candidate (documented, not urgent): unify guest/account order-creation logic so the two paths cannot drift.

Then Phase D (full core journey test, needs real env) → Phase E (readiness gate) → Feature Pair 1 (discovery). Two features at a time, never more (§28).

## 11. Things future agents must NOT undo

- The raw-pg security boundary (`lib/*` + Next route handlers as the session-aware gate). No Prisma. No direct Nest mutations outside it.
- The authority ladder (`canManageOrganizer`/`canManageMemberRole`) and the pure-decision test pattern (no mocks).
- DELETE-based membership removal and expire-in-place invitation revocation (CHECK-constraint-unknown defensive design).
- Webhook signature verification, `assertOrderTransition` state machine, guarded inventory restore, FOR UPDATE/SKIP LOCKED expiry sweep.
- Production fail-closed secrets (both tiers), rate limits, invited-email binding, safe `?next=`.
- The **gate conceptual model**: staff assignment → event+gate; ticket type → permitted gates; backend decides gate permission (implement in Pair 3A without duplicating scanner logic).
- No fake metrics, no placeholder buttons, no invented business/status values, no committed secrets, no new `apps/api/dist` artifacts.

## References

- NI Master Production-Hardening, Completion & Feature-Rollout Directive (user directive, 2026-09-26) — the operating contract for all future runs: INSPECT→CLASSIFY→DECIDE→IMPLEMENT→TEST→VERIFY→DOCUMENT; CASE A–E framework; §35 per-run output contract.
- Sandbox handover log: `/home/z/my-project/worklog.md` (dev-sandbox only, not in repo).
