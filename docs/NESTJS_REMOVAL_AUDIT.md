# NestJS removal audit (Pair 6, Phase A)

> Baseline: commit `7bd1c11` (verified: clean tree on `main`; `origin/main` = `16bc73d` — Pairs 4/5/5.1 commits
> a53fe34, f8b22d5, 7bd1c11 exist ONLY locally; push BLOCKED on GitHub credentials in the agent environment).
> This audit inventories every `apps/api` responsibility, every consumer, and the replacement decision.
> Decision framework: RETAIN / COMPLETE / REFACTOR / REPLACE / BUILD / DEFER.

## 1. Repository facts (verified, not assumed)

```text
Working tree: clean · branch main @ 7bd1c11
apps/api: 59 TS files, ~2,018 LOC (compact, fully read during this audit)
Root package.json carries the Nest deps: @nestjs/common|core|swagger, class-transformer,
  class-validator, helmet, reflect-metadata, rxjs (+ apps/api adds platform-express, express, jose, pdfkit, qrcode, pg)
vitest root config includes apps/api/src (cross-package rule imports from the web tier)
```

## 2. Key structural discovery

**The web tier is already mostly Nest-free.** Organizer/team/gate/staff/invitation/ticket-type/event-create/
check-in/profile functionality is implemented DIRECTLY in Next.js route handlers + `lib/` modules
(`getTicketUGContext()` + the `lib/db` pool). The browser never calls NestJS directly — everything goes
through Next.js. The remaining NestJS-dependent product surface is **exactly 15 Next proxy routes**
(orders, payments, tickets, PDFs, event transition) plus the staging-only webhook.

## 3. NestJS module inventory

| Module | Contents | Notes |
| --- | --- | --- |
| AppModule | composition root | removes with the app |
| CommonModule | DatabaseService (pg pool, TLS pinning, transaction helper), HealthController | DB pool logic already exists in `lib/db.ts` (same posture) |
| AuthModule | SupabaseAuthGuard (JWKS verify → profile → roles/memberships), verifier, cookie parser, CurrentUser decorator | Next equivalent already exists: `lib/request-context.ts` (`supabase.auth.getUser()` + profile/membership load) |
| UsersModule | GET/PATCH `/users/me` | no Next consumer (Next `/api/me` + `/api/profile` are direct) |
| OrganizersModule | GET/POST `/organizers`, GET `/organizers/:id/members` | no Next consumer (Next direct implementations) |
| EventsModule | organizer event list/create, event get/patch, transition, media add/delete, venue create, public event by slug | ONLY `POST /events/:eventId/transition` is consumed (proxy). Public pages read via `lib/public-events.ts` |
| TicketTypesModule | CRUD + active + public list (7 endpoints) | no Next consumer (Next `organizers/…/ticket-types` routes + `lib/public-events`) |
| OrdersModule | create (atomic inventory), list mine, get mine, cancel, guest create/status/cancel/rekey, expire-stale sweep, order rules, expiry engine | ALL consumed via proxies |
| PaymentsModule | initiate/status (user+guest), test-complete (user+guest), webhook `POST /public/payments/webhooks/:provider` (HMAC), ProviderRegistry (test only) | ALL consumed via proxies; webhook is staging-only |
| TicketsModule | list mine, get+QR, order tickets, guest list/detail+QR, owner PDF, guest PDF, issuance (`issuePaidOrder`), QR/PDF builders | consumed via proxies; PDF/QR builders are pure modules |
| CheckInsModule | assigned events, scan (gate matrix), summary | Next `app/api/check-ins` is a COMPLETE direct-DB mirror (GET+POST); Nest summary endpoint has no consumer |
| AuditModule / FutureDomainsModule | empty placeholders | remove |

Guards/middleware/pipes/interceptors: one global guard (auth), ValidationPipe (DTO whitelist), helmet,
CORS (WEB_ORIGIN), 256kb JSON body w/ rawBody capture (webhook HMAC), Swagger. No interceptors/filters.

## 4. Endpoint × consumer × decision matrix

Consumers: **UI** = browser fetch/link via the Next proxy route listed; **—** = none found (repo-wide search:
`fetch(`, `/api/v1`, `API_ORIGIN`, pages/components/lib). Sensitivity: transactionality requirement per §9–§14.

| # | NestJS endpoint | Next consumer (proxy) | UI consumers | Sensitivity | Txn | Replacement | Decision |
|---|---|---|---|---|---|---|---|
| 1 | GET /health | — (Next `/api/health` exists) | — | LOW | NO | existing Next route | RETAIN (Next) / REMOVE (Nest) |
| 2 | GET /readiness | — (Next `/api/readiness` exists; weaker — no SELECT 1) | — | LOW | NO | harden Next route to real `SELECT 1` | REPLACE (upgrade Next) |
| 3 | Swagger /docs | — | — | LOW | NO | none (remove) | REMOVE |
| 4 | GET /users/me | — | — | LOW | NO | none | REMOVE |
| 5 | PATCH /users/me | — (Next `/api/profile` PATCH is direct) | /api/profile | MED | YES (2-table upsert) | existing Next `withTransaction` | RETAIN (Next) / REMOVE (Nest) |
| 6 | GET /organizers | — (Next `/api/organizers` GET direct) | /api/organizers | MED | NO | existing Next route | RETAIN (Next) / REMOVE (Nest) |
| 7 | POST /organizers | — (Next POST direct, transactional) | /api/organizers | MED | YES | existing Next route | RETAIN (Next) / REMOVE (Nest) |
| 8 | GET /organizers/:id/members | — (Next direct) | /api/organizers/:id/members | MED | NO | existing Next route | RETAIN (Next) / REMOVE (Nest) |
| 9 | GET /organizers/:id/events | — (Next GET direct) | /api/organizers/:id/events | MED | NO | existing Next route | RETAIN (Next) / REMOVE (Nest) |
| 10 | POST /organizers/:id/events | — (Next POST direct, zod-validated) | /api/organizers/:id/events | MED | NO (single insert) | existing Next route | RETAIN (Next) / REMOVE (Nest) |
| 11 | GET /events/:eventId | — | — | MED | NO | none | REMOVE |
| 12 | PATCH /events/:eventId | — | — | MED | NO | none (no consumer; document) | REMOVE (documented) |
| 13 | POST /events/:eventId/transition | `app/api/organizers/…/transition/route.ts` | event-lifecycle-controls.tsx | **HIGH** | YES (state machine) | Next route + ported `event-lifecycle` rules + guarded atomic UPDATE | REPLACE |
| 14 | POST /events/:eventId/media | — | — | MED | NO | none | REMOVE (documented) |
| 15 | DELETE /events/:eventId/media/:id | — | — | MED | NO | none | REMOVE (documented) |
| 16 | POST /organizers/:id/venues | — | — | MED | NO | none | REMOVE (documented) |
| 17 | GET /public/events/:slug | — (pages use `lib/public-events`) | server components | LOW | NO | existing lib | RETAIN (Next) / REMOVE (Nest) |
| 18–24 | TicketTypes endpoints ×7 | — (Next `/api/organizers/…/ticket-types` + public lib) | /api/organizers/…/ticket-types | MED | NO (single stmt) | existing Next routes | RETAIN (Next) / REMOVE (Nest) |
| 25 | POST /orders | `app/api/orders/route.ts` (POST) | order-form.tsx (checkout), account-order-form.tsx | **CRITICAL** | **YES** (inventory FOR UPDATE + guarded decrement + snapshots) | SQL function `ticketug.create_order` called from Next route | REPLACE (PG function) |
| 26 | GET /orders | `app/api/orders/route.ts` (GET) | account page | MED | NO | Next lib read w/ owner-scoped SQL + lazy expiry | REPLACE |
| 27 | GET /orders/:publicId | `app/api/orders/[publicId]/route.ts` | account order page | MED | NO | Next lib read + lazy expiry | REPLACE |
| 28 | PATCH /orders/:publicId/cancel | `app/api/orders/[publicId]/cancel/route.ts` | account-order-actions.tsx | **HIGH** | **YES** (inventory restore, payment teardown) | SQL function `ticketug.cancel_order` | REPLACE (PG function) |
| 29 | GET /organizer/events/:id/orders | — | — | MED | NO | none | REMOVE (documented) |
| 30 | POST /system/orders/expire-stale | — (cron not wired) | — | HIGH | YES (SKIP LOCKED sweep) | Next route `/api/system/orders/expire-stale` + SQL function `ticketug.expire_stale_orders` (x-cron-secret preserved) | REPLACE |
| 31 | POST /public/orders/guest | `app/api/orders/guest/route.ts` | order-form.tsx (guest checkout) | **CRITICAL** | **YES** (same as #25 + guest token hash) | same SQL function `ticketug.create_order` | REPLACE (PG function) |
| 32 | GET /public/orders/:publicId | `app/api/public/orders/[publicId]/route.ts` | guest order status page | HIGH (guest credential) | NO | Next lib read w/ sha256 token compare + lazy expiry | REPLACE |
| 33 | PATCH /public/orders/:publicId/cancel | `app/api/public/orders/[publicId]/cancel/route.ts` | guest page | **HIGH** | **YES** | same SQL function `ticketug.cancel_order` | REPLACE (PG function) |
| 34 | POST /public/orders/:publicId/rekey | `app/api/public/orders/[publicId]/rekey/route.ts` | guest page | HIGH (credential rotation) | NO (single guarded UPDATE) | Next lib (token gen in Node, sha256 at rest) | REPLACE |
| 35 | POST /orders/:publicId/payment | `app/api/orders/[publicId]/payment/route.ts` (POST, session mode) | account-order-form.tsx | **CRITICAL** | **YES** (order FOR UPDATE, payment/attempt create, provider call) | Next lib `lib/server/payments.ts` app-orchestrated transaction (provider call interleaves — see architecture doc §4) | REPLACE |
| 36 | GET /orders/:publicId/payment | same proxy (GET) | account order page | MED | NO | Next lib read + lazy expiry | REPLACE |
| 37 | POST /orders/:publicId/payment/test-complete | `…/payment/test-complete/route.ts` | account-order-form.tsx (staging) | CRITICAL (payment gate) | YES (webhook apply) | Next lib + SQL function `ticketug.apply_payment_event`; **production 503 gate preserved verbatim** | REPLACE |
| 38 | POST /public/orders/:publicId/payment | same payment proxy (guest mode) | guest checkout | **CRITICAL** | **YES** | same as #35 + guest token | REPLACE |
| 39 | GET /public/orders/:publicId/payment | same proxy (GET, guest) | guest page | MED | NO | Next lib read | REPLACE |
| 40 | POST /public/orders/:publicId/payment/test-complete | `…/payment/test-complete/route.ts` (guest) | guest checkout (staging) | CRITICAL | YES | as #37 | REPLACE |
| 41 | POST /public/payments/webhooks/:provider | — (external provider surface; staging-only today) | — | **CRITICAL** | **YES** (dedupe, amount/currency/order checks, issuance) | Next route `app/api/public/payments/webhooks/[provider]/route.ts` (raw body via `request.text()`) + SQL `ticketug.apply_payment_event` | REPLACE |
| 42 | GET /tickets | — (account pages read via server components) | — | MED | NO | none | REMOVE (documented) |
| 43 | GET /tickets/:publicId | `app/api/tickets/[publicId]/route.ts` | account ticket page | MED | NO | Next lib read (owner-scoped) + QR | REPLACE |
| 44 | GET /tickets/:publicId/pdf | `app/api/tickets/[publicId]/pdf/route.ts` | account ticket page download | MED | NO | Next lib (port `ticket.pdf.ts` + `ticket.qr.ts`) | REPLACE |
| 45 | GET /orders/:publicId/tickets | — | — | MED | NO | none | REMOVE (documented) |
| 46 | GET /public/orders/:publicId/tickets | `app/api/public/orders/[publicId]/tickets/route.ts` | guest order page | HIGH (guest credential) | NO | Next lib read (token compare in SQL) | REPLACE |
| 47 | GET /public/orders/:publicId/tickets/:tid | `…/tickets/[ticketPublicId]/route.ts` | guest ticket page | HIGH | NO | Next lib read + QR | REPLACE |
| 48 | GET /public/orders/:publicId/tickets/:tid/pdf | `…/tickets/[ticketPublicId]/pdf/route.ts` | guest ticket download | MED | NO | Next lib (as #44 + guest token) | REPLACE |
| 49 | GET /organizer/events/:id/tickets | — | — | MED | NO | none | REMOVE (documented) |
| 50 | GET /check-ins/events | — (Next `/api/check-ins` GET is a direct mirror) | /api/check-ins | HIGH | NO | existing Next route | RETAIN (Next) / REMOVE (Nest) |
| 51 | POST /check-ins/events/:eventId/scan | — (Next POST is a direct mirror) | /api/check-ins (scanner) | **CRITICAL** | **YES** (already atomic in Next) | existing Next route (already Nest-free) | RETAIN (Next) / REMOVE (Nest) |
| 52 | GET /check-ins/events/:id/summary | — | — | MED | NO | none (no consumer) | REMOVE (documented) |

**Summary: 52 endpoints. RETAIN-as-Next (already direct): 18 · REPLACE (rebuild in Next tier): 20 · REMOVE (no consumer): 14 · PROXIED total: 22 routes in 15 Next proxy files.**

## 5. Shared pure-rule modules (imported cross-package today)

`lib/` and `app/api/check-ins/route.ts` import these from `apps/api/src` (root tsconfig path):
`check-ins/gate.rules.ts` (scanner matrix), `events/event-lifecycle.ts` (state machine), `orders/order.rules.ts`,
`payments/payment.rules.ts`, `ticket-types/ticket-type.rules.ts`, `tickets/ticket.{pdf,qr,contracts}.ts`.
**Phase H must move them into `lib/rules/` (with their tests) and rewrite imports** — otherwise removal breaks the web build.

## 6. Environment variables used ONLY by NestJS

`API_PORT`, `API_HOST`, `WEB_ORIGIN` (CORS — Next needs no CORS: same-origin), `CRON_SECRET` (kept — reused by
the Next system route), `PAYMENT_TEST_WEBHOOK_SECRET` (kept — webhook moves to Next). `API_ORIGIN` becomes
obsolete after Phase G (verified against the full `fetch` surface above). No `NEXT_PUBLIC_*` exists anywhere.

## 7. Places where Next.js currently communicates with NestJS

- 8 routes via `lib/api-forward.ts` (`authenticatedForwardHeaders`): orders route/[publicId]/cancel/payment/test-complete, tickets route/pdf, event transition.
- 6 routes via literal `API_ORIGIN` fetch (guest surface): public orders route/cancel/rekey/tickets/ticket/pdf.
- 1 route via literal `API_ORIGIN` (dual-mode): payment proxy (counts above).
- Documentation: `docs/ARCHITECTURE.md`, `docs/API_AUTHENTICATION.md`, ADR-0004, DEPLOYMENT_ENVIRONMENT (§2 API tier), manual-steps BLOCKER 3 — all updated in Phase H.

## 8. Responsibilities with no replacement needed (already Next-side)

Auth session (Supabase server client), profile read/update, organizer workspace CRUD + members + transfer,
invitations + acceptance, events create/list, ticket-types CRUD, gates + permissions, staff assignments,
public event discovery (`lib/public-events`), scanner (GET+POST), guest recovery UX, rate limiting (`lib/rate-limit`).
