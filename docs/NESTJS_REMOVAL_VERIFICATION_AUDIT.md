# NestJS removal verification audit (post-migration forensic pass)

> Independent forensic audit of the Pair 6 migration (commits `2a53a64` + `4aa0859`).
> Method: repository searches, git-history reconstruction, live-database inspection
> (read-only + clearly-marked, fully-removed test data), and wire-level runtime probes
> against production and staging servers. No application code was modified.
> Every claim below was re-verified during THIS audit; prior-agent claims were treated
> as unproven until reproduced.

---

## 1. Repository state

```text
HEAD:            8f1f989dc6208dda1ca8bae4d17652410368ae51 ("fix(ui): full-bleed landing bands")
Branch:          main (only local branch)
Working tree:    CLEAN (no unstaged, no staged changes)
Remote:          origin = https://github.com/naturalintellectscrop-ctrl/TicketUG
origin/main:     8f1f989 — IDENTICAL to local main (pushed, verified via ls-remote)
Migration commits: 2a53a64 (Phase A docs) + 4aa0859 (implementation) — present locally AND on origin
Pre-migration baseline: 7bd1c11 — verified present in history (NOT HEAD; two commits since)
```

## 2. NestJS status

| Check | Result |
| --- | --- |
| `apps/api` source in git | **GONE** — `git ls-files apps/` returns zero files; 59 TS files existed at `7bd1c11` |
| `apps/api` on disk | **STALE UNTRACKED ARTIFACTS ONLY** (448 KB): `dist/**` compiled JS + `node_modules` remnants from a pre-migration build; git-ignored, unreferenced, dead weight |
| NestJS dependencies | **GONE** — 0 hits for `nest` in `package.json`, 0 `@nestjs` in `pnpm-lock.yaml`, `node_modules/@nestjs` absent, nest CLI absent |
| `@nestjs` / `NestFactory` / decorators (`@Controller` etc.) in code | **ZERO hits** in app/lib/components/scripts |
| `API_ORIGIN` / `/api/v1` in code | **ZERO hits** (docs-only, historical records) |
| Scripts starting/building NestJS | **NONE** — `package.json` scripts: dev/build/start/lint/typecheck/format/test/migrate (old `api:build`/`api:test` removed) |
| Next routes proxying to NestJS | **NONE** — no proxy remains; the 15 former proxies were rewritten in-place to same-origin implementations |
| Deployment configs for a separate API host | **NONE** — no vercel.json, turbo.json, Dockerfile, docker-compose, render.yaml, railway, fly.toml, Procfile, .github/ |

**Verdict: NestJS is actually removed — not merely renamed or hidden** (searches + lockfile +
runtime dependency analysis agree). The only residue is dead, untracked build output on one
sandbox disk plus an obsolete `.gitignore` line (`apps/api/dist/`).

## 3. Actual architecture (as implemented, not as intended)

```text
Browser (React client components; token in sessionStorage for guests)
   ↓  fetch — 100% same-origin /api/* (40 route handlers; map in §8)
Next.js 16 App Router (RSC server components read DB directly for pages;
        route handlers own every mutation)
   ↓  lib/server/* modules (orders, payments, tickets, check-ins, events)
   │     + lib/rules/* (lifecycle, gates, order, payment, ticket-type rules)
   │     + lib/organizer-authorization, members, invitations, rate-limit
   ↓  lib/db pg Pool — TLS pinned to Supabase Root 2021 CA, rejectUnauthorized: true
Supabase PostgreSQL — ticketug schema (23 tables, 13 functions incl. 8 SECURITY DEFINER,
        behavioral triggers, FK/CHECK constraints, UNIQUE issuance backstops)

Authentication: @supabase/ssr cookie client → supabase.auth.getUser() (GoTrue, server-side,
        raw cookie never trusted locally) → ticketug.user_profile → organizer_member /
        platform_role → TicketUGContext roles (ATTENDEE…SUPER_ADMIN)
Background jobs: POST /api/system/orders/expire-stale (x-cron-secret, fail-closed) calling
        ticketug.expire_stale_orders (SKIP LOCKED); plus lazy expire_order_if_due on reads
File/storage: none (PDFs generated in-process via lib/tickets/pdf, streamed from route handlers)
Edge Functions: none exist (deferred — see §7)
```

## 4. Migration matrix

Old NestJS surface reconstructed from `git ls-tree -r 7bd1c11 -- apps/api/src` (59 files,
9 controllers, global prefix `api/v1`, helmet, raw-body webhooks) and per-endpoint
enumeration of `@Get/@Post/@Patch/@Delete` decorators.

| Capability | Was NestJS-owned? | Current implementation | Verified? |
| --- | ---: | --- | --- |
| Auth verification | YES (supabase-auth.guard) | `lib/request-context.ts` + `lib/supabase/server.ts` — server-side `getUser()`; **byte-identical files to 7bd1c11** (`git diff` empty) | YES (code + fail-closed wire probes; happy-path pending real anon key, §11) |
| Role authorization | YES (guards/services) | `getTicketUGContext()` roles; per-route checks; roles re-checked inside SQL functions | YES (28/28 + 57/57 + live 401/403 probes) |
| Tenant isolation | YES (membership checks) | membership-scoped SQL + `organizer_id` filters + in-function authority re-checks | YES (dedicated A/B probe, §5) |
| Event management | PARTIAL (create/list in Nest; detail PATCH unconsumed) | Next route POST/GET + RSC direct reads; unconsumed Nest endpoints documented REMOVE | YES |
| Event lifecycle | YES (`POST /events/:id/transition` proxy) | `app/api/.../transition` → `ticketug.transition_event_lifecycle` (map identical to `lib/rules/event-lifecycle.ts`; owner-only PUBLISHED/CANCELLED; guarded UPDATE) | YES (28/28 section) |
| Ticket types | PARTIAL (Nest CRUD existed, only create consumed) | Next route (POST + list); unchanged 1:1 route parity pre/post migration | YES |
| Inventory | YES (orders.service) | guarded decrement inside `create_order`; restore on cancel/expire (FOR UPDATE) | YES (concurrency-proven, §6) |
| Orders | YES (orders.controller+service) | `ticketug.create_order` / `cancel_order` / `expire_*` via `lib/server/orders.ts` | YES (28/28 + wire) |
| Guest checkout | YES (`public/orders/guest`) | same URL, CSPRNG token, hash-only storage | YES (wire journey) |
| Guest recovery | YES (`rekey`) | same URL → `rekeyGuestOrder` | YES (route present; token-hashing proven in harness) |
| Payment boundary | YES (payments.service) | `simulateTestSuccess` gate: `NODE_ENV==='production' \|\| PAYMENT_MODE!=='test'` → 503 `TEST_PAYMENT_DISABLED`; registry refuses all providers in production | YES (wire: 503 in production; validly-signed test webhook still refused 503) |
| Payment attempts | YES | 1-per-order payment (`ON CONFLICT DO NOTHING`), idempotency-key attempts (UNIQUE), provider call inside transaction | YES |
| Webhooks | YES (`public/payments/webhooks/:provider`) | same URL; raw body; HMAC-SHA256 timing-safe + 5-min freshness; then `ticketug.apply_payment_event` | YES (wire: PROCESSED/DUPLICATE/400 stale/404 unknown/400 garbage) |
| Ticket issuance | YES | ONLY via `apply_payment_event` → `_issue_paid_tickets` (idempotent, UNIQUE backstop) | YES (never from browser signal — proven: production refuses; staging only via verified event) |
| QR validation | YES (ticket.qr) | `ticketug:v1:` payload → `tkt_` credential → sha256 lookup (plaintext never stored) | YES |
| Check-in | YES (check-ins.service) | `lib/server/check-ins.scanCheckIn` — single `withTransaction`, `FOR UPDATE`, guarded status UPDATE, UNIQUE(ticket_id) | YES (57/57 matrix, §6) |
| Gates | YES (gate.rules) | `lib/rules/gate-rules.ts` + ticket_type_gate tables; assignment-derived scope | YES (57/57) |
| Staff assignments | PARTIAL (Next-owned pre-migration) | unchanged Next routes + RSC | YES (route parity) |
| Organizer team | NO (Next-native since round 8) | unchanged Next routes (`members/[memberId]` verified byte-level intact) | YES |
| Refunds | NO | never implemented (future-domain boundary list) | NOT APPLICABLE |
| Settlements | NO | never implemented | NOT APPLICABLE |
| Ledger | NO | never implemented | NOT APPLICABLE |
| Reconciliation | NO | never implemented | NOT APPLICABLE |
| Audit logs | PARTIAL (Nest AuditModule was an EMPTY placeholder) | `ticketug.security_event` writes in Next tier (MEMBERSHIP_CHANGED) — unchanged | YES (placeholder never migrated because it never existed) |
| Notifications | NO | never implemented | NOT APPLICABLE |
| Health/readiness | YES (health.controller) | `app/api/health` + `app/api/readiness` (real `SELECT 1`) | YES (wire 200) |
| Order expiry sweep | YES (`system/orders/expire-stale`) | same URL + `x-cron-secret` fail-closed → `expire_stale_orders` | YES (route added; secret gate in code) |

Route-level parity proof: **38 route files at `7bd1c11` == 38 identical paths at HEAD, +2 new**
(webhook, system sweep) replacing the Nest-owned surfaces. Unconsumed Nest endpoints
(event PATCH, media add/delete, users/me, ticket-type PATCH/DELETE/activate) were documented
REMOVE decisions with no Next consumers — nothing the product used was dropped.

## 5. Security verification

**Live-database probes (independent, this audit):**

- **Function ACLs**: all 13 `ticketug` functions — `EXECUTE` = **false** for `anon`,
  `authenticated`, AND `public` (the migration's dynamic REVOKE loop is live).
  8 business functions are `SECURITY DEFINER` **with `SET search_path = ticketug, pg_temp`**
  (hijack-hardened), owner `postgres`.
- **Table grants**: `anon` and `authenticated` hold **zero privileges (S/I/U/D = 0000) on
  all 23 tables**.
- **Schema**: `USAGE` on `ticketug` = false for `anon`/`authenticated` → PostgREST cannot
  see the schema even if it could authenticate.
- **RLS**: OFF on all 23 tables, 0 policies — **intentional, documented design** (ADR): the
  database has no client-facing path at all; every access flows through the server pool
  (server-only `DATABASE_URL`, TLS-pinned). Equivalent protection to RLS for this topology;
  residual risk = whoever holds `DATABASE_URL` bypasses everything (standard for the
  Vercel+Supabase-native pattern; secret lives only in Vercel env / local `.env`).
- **Secrets**: no `NEXT_PUBLIC_*` usage anywhere; no credentials in tracked files
  (`.env` git-ignored; only `.env.example` placeholders tracked).
- **Wire probes (production server, real GoTrue host)**: no-session `/api/me` 401,
  `/api/profile` 401, forged session cookie 401, invitations 401. Under the stand-in anon
  key, GoTrue rejects the API key itself → those routes fail closed (500/503, zero data).
  Scanner surface maps any context failure to **503 VERIFICATION_UNAVAILABLE** — a scanner
  can never receive VALID without a fully verified session (fail-closed by construction).
- **Tenant isolation (dedicated A/B probe through lib/server modules)**: A listing B's
  organizer events → DENIED; A reading B's event orders/tickets → DENIED; B scanning at A's
  event → UNAUTHORIZED_SCANNER; A scanning at B's event → UNAUTHORIZED_SCANNER; A's ticket
  presented at B's event → WRONG_EVENT; own-organizer paths → ALLOWED. Non-member lifecycle
  transition → "Organizer access denied".

## 6. Transaction verification

- **Order creation**: single PostgreSQL function `ticketug.create_order` — deterministic
  `FOR UPDATE` lock ordering (sorted refs), sale-window/state checks, server-side totals
  from `ticket_type.price_minor_units` (client never supplies money), **guarded decrement**
  (`remaining_capacity >= quantity` with NOT FOUND → exception), immutable snapshots.
  **Concurrency proof (live DB)**: capacity 2, six concurrent 2-unit orders → **exactly 1
  fulfilled**, 5 rejected "Insufficient ticket inventory", capacity 0 — never negative.
- **Cancellation/expiry**: `cancel_order` / `expire_order_if_due` / `expire_stale_orders`
  (SKIP LOCKED) — inventory restored transactionally (harness: 0→2 on cancel; expiry +2;
  second expiry no-op; double-cancel rejected ORDER_STATE_TRANSITION_INVALID).
- **Payments/webhook**: `apply_payment_event` — dedupe `(provider, provider_event_id)`,
  triple `FOR UPDATE` (attempt+payment+order), amount/currency/order-reference validation,
  state machine (terminal states immutable), issuance only on SUCCEEDED.
  Proven live: replay → DUPLICATE (both same-event and SUCCEEDED-attempt), wrong amount →
  INVALID_PAYMENT_AMOUNT, wrong order → INVALID_PAYMENT_ORDER, unknown reference → 404.
- **Check-in**: app-layer single transaction (`withTransaction`) with `FOR UPDATE` ticket
  lock + guarded conditional UPDATE (`WHERE status='ISSUED'`, rowCount re-check) +
  DB `UNIQUE(ticket_id)` backstop. Equivalent atomicity to a SQL function; design choice
  documented (scanner matrix harness 18/18 outcome checks passed live).
- **Ticket issuance idempotency**: SUCCEEDED-attempt replays produce DUPLICATE and no new
  tickets (harness + wire both confirmed; issuance row has UNIQUE order/payment).

## 7. Supabase verification

- **Auth (GoTrue)**: `@supabase/ssr` server client, HttpOnly Secure SameSite=Lax chunked
  cookies; `getUser()` validates server-side — the mechanism is byte-identical to the
  pre-migration files (`git diff 7bd1c11 HEAD -- lib/request-context.ts lib/db.ts` is
  EMPTY), i.e. exactly what earlier production verification exercised. Signup/sign-in/
  sign-out routes exist and are wire-reachable; **happy-path session→context flow is
  code+history-verified but could not be exercised end-to-end here** because the sandbox
  holds only the stand-in anon key (NI-side BLOCKER 2b). All failure modes verified 401.
- **PostgreSQL functions**: 6 functions invoked from `lib/server/*` (call sites listed in
  §4); live-verified usage via harness + wire journey. None unused.
- **Edge Functions**: `supabase/functions/` **does not exist** — no Edge Functions shipped,
  no placeholders, nothing deployed. Webhook + privileged operations run as Next route
  handlers + SECURITY DEFINER SQL instead. (Pair 6 decision: DEFERRED until a live
  provider exists; requires no edge-specific secrets today.) An empty-placeholder score
  of "complete" would be Pattern 7 — reported as NOT SHIPPED, not as implemented.
- **RLS**: see §5 — intentional off, compensating controls verified live.

## 8. Frontend verification (all former API consumers)

Full `fetch()` map extracted: **every client call targets a same-origin `/api/...` route**
(check-ins, me, orders + payment + test-complete + cancel, guest public orders/tickets/pdf,
organizers/events/gates/staff/invitations/members/transfer-ownership/ticket-types/
transition/sales, tickets + pdf). Zero occurrences of: `axios`, `API_ORIGIN`, `/api/v1`,
`rpc(`, `functions.invoke(`, `createClient(` in app/components. No hidden dependency on the
deleted API exists. Guest pages keep tokens in `sessionStorage` (never URLs/history) and send
them as headers; server treats their absence as unauthenticated.

## 9. Testing results (exact commands and results)

| Command / probe | Result |
| --- | --- |
| `pnpm test` (vitest, 17 files) | **103 passed / 103** (0 skipped) |
| `pnpm typecheck` | PASS (exit 0) |
| `pnpm lint` | PASS (exit 0) |
| `pnpm build` (next build) | PASS — 40 routes compiled |
| `tsx scripts/staging-verify/verify-sql-functions.ts` (live Supabase DB) | **28/28 OK** (incl. 6-way oversell barrier, replays, wrong amount/order, lifecycle transitions) |
| `tsx scripts/staging-verify/verify-gates.ts --allow-remote` (live DB) | **57/57 OK** (migration objects, real signed-webhook issuance ×12, 18-outcome scanner matrix, gate CASCADE fail-closed, owner+guest PDF, wrong-token PDF denial) |
| Wire: production `next start` probes | health 200; readiness 200 (real SELECT 1); no-session 401s; forged cookie 401; guest order 201; guest idem replay 409; guest order no-token 401; wrong-token 404; correct-token 200; `test-complete` **503 TEST_PAYMENT_DISABLED**; webhook garbage-sig 400; **validly-signed test webhook in production → 503 PROVIDER_NOT_CONFIGURED** |
| Wire: staging guest journey (dev server) | order 201 → initiate PROCESSING → signed webhook **PROCESSED** → replay **DUPLICATE** → stale-timestamp **400** → 2 tickets **ISSUED** → QR `data:image/png` → PDF 200 `%PDF-` 8,354 B → wrong-token PDF **404** → status SUCCEEDED |
| Tenant isolation probe (this audit, live DB) | 11/11 checks OK (A/B cross-tenant matrix above) |
| Data hygiene | All audit/harness records removed; final census **0 rows** across 19 core tables; migration ledger intact (9 rows, untouched) |

## 10. Production architecture (what is actually required)

```text
Vercel (Next.js 16 — pages, RSC, 40 route handlers, PDF/QR generation, cron-ish sweep endpoint)
Supabase (PostgreSQL: ticketug schema + SQL functions; GoTrue auth)
```

Nothing else. No Docker/Render/Railway/Fly/VPS/Node-API configs exist anywhere in the repo.
The former "Vercel + separate NestJS host + Supabase" requirement is gone. Vercel deploys
from `main` (verified live: push → auto-deploy → full-bleed CSS on production within ~20 s).

## 11. Remaining problems (prioritized)

1. **MEDIUM — hosted happy-path auth exercise**: valid-session end-to-end (signup → session →
   context → role-gated calls) on the real deployment needs the real `SUPABASE_ANON_KEY`
   (NI-side BLOCKER 2b). Fail-closed is proven for every failure mode; the success path is
   code-verified and byte-identical to the previously production-verified mechanism.
2. **LOW — stale untracked artifacts**: `apps/api/dist/**` + `apps/api/node_modules/**`
   (448 KB) remain on the sandbox disk; `.gitignore` still carries the obsolete
   `apps/api/dist/` rule. Dead weight only — nothing references them.
3. **LOW — local `.env` hygiene**: the sandbox `.env` still defines the obsolete
   `API_ORIGIN` (and lacks optional staging vars). Harmless (nothing reads it) but should
   be cleaned by the operator; the repo's `.env.example` is already correct.
4. **LOW — sweep scheduling**: `expire_stale_orders` needs an external scheduler hitting
   `/api/system/orders/expire-stale` with `CRON_SECRET` (Vercel Cron or equivalent) once
   real traffic exists; lazy per-order expiry already covers correctness meanwhile.
5. **INFO — test-suite continuity**: the old 52-test Nest suite was deleted with the app;
   its coverage was reimplemented (103 unit + 28 SQL + 57 behavioral + wire journeys in this
   audit). The DB-integration vitest file also went with `apps/api`; its role is now served
   by the two staging-verify scripts.
6. **INFO — `next start` env**: in this sandbox, `next start` did not auto-load `.env`
   (readiness 503 until env was passed explicitly). Vercel injects env as real process
   variables, so hosted deploys are unaffected; operators running bare `next start` should
   export env or use a wrapper.

## 12. Final verdict

**YES — VERIFIED.**

Evidence: NestJS is provably absent from source, dependencies, scripts, and configs (§2);
every one of the 26 former responsibilities is either implemented in the Supabase-native
stack (verified live) or was never implemented anywhere (NOT APPLICABLE) (§4); transactional
integrity is proven under concurrency against the real database (§6); authorization, tenant
isolation, and payment fail-closed boundaries are proven at both the database and wire level
(§5, §9); the frontend has zero hidden dependence on the old API (§8); and the production
requirement is genuinely Vercel + Supabase only (§10). The single open item (hosted
happy-path auth exercise) is an NI-side credential blocker that does not depend on NestJS
and does not weaken any security boundary — every unauthenticated/forged path already fails
closed on the wire.

## REQUIRED FIXES BEFORE ACCEPTANCE

- **CRITICAL**: none.
- **HIGH**: none.
- **MEDIUM**: none blocking acceptance. (Tracked separately: complete the hosted happy-path
  auth verification when the real anon key is available — NI BLOCKER 2b, documented in
  `docs/DEPLOYMENT_MANUAL_STEPS.md`.)
- **LOW**: 1) delete stale `apps/api/dist` + `apps/api/node_modules` artifacts and drop the
  obsolete `.gitignore` rule; 2) remove the stale `API_ORIGIN` line from the local `.env`;
  3) schedule the order-expiry sweep (Vercel Cron + `CRON_SECRET`) before real sales traffic.

## OPTIONAL IMPROVEMENTS

- Revisit RLS enablement as defense-in-depth for the service-role topology if the team ever
  introduces additional database consumers (supabase-js key-based access, BI tools, etc.).
- Fold check-in's app-layer transaction into a SQL function for uniformity with the other
  hot paths (current form is proven atomic; this is consistency, not correctness).
- Implement Edge Function versions of the webhook + sweep when a live payment provider
  arrives (per the ADR's deferred plan), keeping the HMAC + dedupe semantics unchanged.
- Re-add a DB-integration vitest file against `TEST_DATABASE_URL` to restore that runner
  shape inside `pnpm test` (its coverage currently lives in the staging-verify scripts).
