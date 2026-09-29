# ADR 0006: Supabase-native backend (NestJS removal)

## Status

Accepted (Pair 6, 2026-09-29). Supersedes ADR 0004 (NestJS API boundary).

## Context

TicketUG ran a separately hosted NestJS API (`apps/api`) as its business/authorization
boundary between Next.js and Supabase PostgreSQL. Hosting it requires a second
always-on Node host (Vercel does not deploy `apps/api`), which blocked the
platform's deployment path and added operational surface (CORS, bearer-token
forwarding, duplicate authorization logic, a second scanner implementation).

## Decision

Remove `apps/api`. Responsibilities move to:

1. **PostgreSQL functions** (`docs/migrations/012-supabase-native.sql`, hidden
   `ticketug` schema, `security definer`, execution revoked from
   PUBLIC/anon/authenticated) for every multi-row invariant: atomic order
   creation with inventory locking and guarded decrement (`create_order`),
   cancellation with inventory restore + payment teardown (`cancel_order`),
   payment-window expiry (lazy + SKIP LOCKED sweep), the verified-webhook core
   with ticket issuance (`apply_payment_event`), and the event lifecycle state
   machine (`transition_event_lifecycle`). Functions re-verify actor authority
   internally.
2. **Next.js server modules** (`lib/server/*`) for session resolution, zod
   validation, guest-token minting (Node CSPRNG), payment initiation (the
   provider call participates in one transaction), reads with authorization in
   the same SQL statement, QR/PDF rendering, and error→HTTP mapping.
3. **Shared pure rules** (`lib/rules/*`) for the scanner gate matrix, event
   lifecycle, order/payment state machines and ticket availability — unit-tested
   once, used by the server layer and the behavioral harness.

## Consequences

- Deployment shape becomes Vercel + Supabase only; no second host, no CORS, no
  `API_ORIGIN`, no bearer forwarding (`jose` dependency removed).
- The browser contract is preserved: URLs, methods, rate limits, cookies,
  response shapes and error bodies are unchanged (verified endpoint-by-endpoint
  in `docs/NESTJS_REMOVAL_AUDIT.md` §4).
- The payment gate became STRONGER: the simulated provider is now refused
  whenever the server process runs in production mode (`next start` forces
  NODE_ENV=production), so the staging test path is only exercisable in
  non-production processes (`next dev` / explicit staging runtimes).
- Edge Functions remain a documented future extension for a live payment
  provider webhook (requires a Supabase access token to deploy).
- RLS stays OFF on `ticketug` (unchanged access path: only the trusted server
  pool connects as the postgres role; the anon role has zero privileges and the
  schema is not exposed via PostgREST — re-audit required before any
  non-server consumer is introduced).
