# TicketUG Supabase-native architecture (Pair 6, Phase A design)

> Target: remove the separately hosted NestJS API while preserving every security, authorization,
> tenant-isolation, transactional and payment guarantee. Vercel (Next.js) + Supabase (PostgreSQL + Auth) only.

## 1. Before → After

```text
BEFORE                                     AFTER
Browser                                    Browser
  ↓ (same-origin /api/*)                     ↓ (same-origin /api/* — URLs UNCHANGED)
Next.js (Vercel)                           Next.js (Vercel)
  ↓ Bearer-forward (API_ORIGIN)              ↓ server-side, in-process
NestJS API (separate host)  ← REMOVED        ├─ lib/ server modules (validation, authz, QR/PDF)
  ↓ pg (TLS-pinned pool)                     └─ lib/db pool (postgres role, TLS-pinned)
Supabase PostgreSQL (ticketug schema)        ↓         ↓
Supabase Auth (JWT/JWKS)                ticketug.* tables + SQL functions (atomic mutations)
                                        Supabase Auth (session via @supabase/ssr; getUser() validation)
```

Same-origin Next route handlers replace the network hop to NestJS; the browser contract (URLs, cookies,
response JSON shapes, status codes) is preserved endpoint-for-endpoint (see NESTJS_REMOVAL_AUDIT.md §4).

## 2. Execution-layer assignment (why each responsibility lives where it does)

| Layer | Used for | Why |
| --- | --- | --- |
| **PostgreSQL functions** (`ticketug.*`, `security definer`, called via the TLS-pinned pg pool) | `create_order` (inventory lock + guarded decrement + price snapshots), `cancel_order` (restore + payment teardown), `expire_order_if_due` / `expire_stale_orders` (SKIP LOCKED sweep), `apply_payment_event` (webhook dedupe + amount/currency/order validation + payment/order transitions + **ticket issuance**), `scan_check_in` (gate matrix + replay protection), `transition_event_lifecycle` | Multi-row invariants that MUST hold regardless of caller: atomicity, concurrency (FOR UPDATE / SKIP LOCKED), idempotency, state machines. The DB is the only component that can make these unbypassable. Functions verify actor authority internally (profile/membership passed in and re-checked) — defense-in-depth beyond the route layer. |
| **Next.js server modules** (`lib/server/*.ts`, route handlers) | validation (zod), session resolution (`getTicketUGContext`), guest-token issuance/rotation (Node CSPRNG), payment **initiation** (provider call interleaves inside one transaction), reads with authz-in-SQL, QR/PDF rendering, error→HTTP mapping | Orchestration where an external call (future payment provider) must participate in the transaction, and where a trusted server holds DB credentials. NOT client code — the browser never talks to the DB. |
| **Supabase Auth** (unchanged) | identity; sessions in HttpOnly/Secure/SameSite=Lax cookies; `supabase.auth.getUser()` validates server-side (refresh-aware) | already Supabase-native; no second auth system; no local JWT verification needed any more (no cross-service bearer forwarding) |
| **PostgREST / supabase-js data access** | NOT used for `ticketug` | keeps the verified Pair-5.1 posture: `anon` has zero privileges on `ticketug`, schema not exposed; raw pg + TLS pinning retained (strict `rejectUnauthorized`, bundled Supabase Root CA) |
| **Edge Functions** | **DEFERRED** (Case F) | the only candidate is a future LIVE payment provider's webhook; today's webhook is the staging-only test provider, served by a Next route. Deploying Edge Functions requires a Supabase access token this environment does not have. Documented in Future Improvements. |
| **RLS** | **NOT expanded** (smallest secure surface = none new) | access path is unchanged: only the trusted server pool (postgres role) touches `ticketug`; enabling RLS on a role that bypasses it adds no guarantee while policies on 23 tables add risk. Re-audit trigger: if `ticketug` is ever exposed to PostgREST roles, RLS becomes mandatory first. |

## 3. Data-flow examples

**Guest checkout (unchanged UX):**
`order-form.tsx → POST /api/orders/guest → Next route → ticketug.create_order(items, purchaser, idempotencyKey?, guestTokenHash)` —
one SQL call performs: idempotency check → per-type `SELECT … FOR UPDATE` → event SALES_OPEN/PUBLIC checks → sale-window checks →
guarded `remaining_capacity ≥ qty` decrement → order + order_item inserts (price/name snapshots) → returns order JSON.
The guest access token is generated in Node (CSPRNG), only its sha256 crosses to SQL.

**Payment (staging test provider):**
`POST …/payment/test-complete → Next route (gate: NODE_ENV≠production && PAYMENT_MODE=test else 503 TEST_PAYMENT_DISABLED)
→ build+HMAC-sign test event (Node) → ticketug.apply_payment_event(event jsonb)` —
one SQL call: webhook_event insert ON CONFLICT (dedupe) → attempt `FOR UPDATE` → amount/currency/order-reference checks →
payment_attempt/payment/order transitions (state machines encoded in SQL) → `issuePaidOrder` equivalence
(issuance-event dedupe, per-unit credential + sha256 + snapshots) → PROCESSED.

**Scanner:** unchanged — `POST /api/check-ins` already runs the full matrix server-side in Next (kept; pure rules move to `lib/rules/`).

## 4. Payment safety invariants preserved

Server-calculated totals (integer minor units, BigInt-safe) inside the SQL function; immutable price/name snapshots on
order_item and ticket rows; payment_attempt idempotency keys; webhook dedupe by (provider, provider_event_id);
amount/currency/order-reference validation before any state change; payment vs order state separation with explicit
state machines (payment.rules / order.rules — now also encoded in SQL guards); issuance only from `apply_payment_event`
(never from a browser signal); **`TEST_PAYMENT_DISABLED` 503 in production preserved verbatim**; no live provider introduced.

## 5. Authorization model (unchanged, relocated)

Roles: ATTENDEE, ORGANIZER_OWNER, ORGANIZER_MANAGER, EVENT_STAFF, PLATFORM_SUPPORT, PLATFORM_ADMIN, SUPER_ADMIN.
- Session → `getTicketUGContext()` (validated user → `user_profile` by `auth_user_id` → memberships + platform roles).
- Route layer: ownership/membership checks in the SAME SQL statement as the data read wherever possible
  (the pattern the direct-DB routes already use), plus zod validation and rate limits (unchanged limits per route).
- Mutating SQL functions re-verify actor authority internally (e.g. `transition_event_lifecycle` checks ACTIVE
  membership + owner/manager role — owner-only for PUBLISHED/CANCELLED — before touching state).
- Guest surface: `x-order-access-token` → sha256 compare against `guest_access_token_hash` inside the SQL/lib layer;
  no predictable-ID access anywhere; rekey rotates the hash.

## 6. What disappears with apps/api

JWKS verifier + Bearer forwarding (`lib/api-forward.ts`), `API_ORIGIN`, Nest deps (@nestjs/*, class-validator/
transformer, reflect-metadata, rxjs, helmet, express from the API, jose), Swagger, the dual-tier duplicate scanner
(Nest's copy), duplicate users/organizers/ticket-types/event endpoints, `WEB_ORIGIN`/`API_PORT`/`API_HOST` env vars.

## 7. Deployment shape

Vercel (Next.js) + Supabase (Postgres + Auth). No additional host. The migration runner (`pnpm migrate`) applies
`012-supabase-native.sql` (functions) through the session pooler as today. `/api/health` + `/api/readiness`
(升级: real SELECT 1) serve process/DB health. CORS is no longer needed on the API (same-origin); no cookie changes.

## 8. Future Improvements (documented, NOT implemented — §31)

- Edge Function for a future live payment provider webhook (requires SUPABASE_ACCESS_TOKEN; keeps Next stateless).
- Expose read-only PostgREST views + RLS for a future mobile client (must precede any non-server DB consumer).
- Wire an external scheduler to `/api/system/orders/expire-stale` (x-cron-secret) — endpoint preserved.
- Consolidate the remaining duplicated zod/DTO validation into one shared schema package.
