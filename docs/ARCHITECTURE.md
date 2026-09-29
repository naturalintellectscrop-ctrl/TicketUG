# TicketUG Architecture

TicketUG is a Uganda-focused ticketing platform: Next.js (App Router) on Vercel,
Supabase Auth for identity, Supabase PostgreSQL (`ticketug` schema) for data.

## Runtime boundaries (Pair 6, Supabase-native)

```text
Browser
  ↓ same-origin /api/* (URLs stable across the migration)
Next.js (Vercel)
  ├─ lib/server/*   — session resolution, zod validation, QR/PDF, error mapping
  ├─ lib/db pool    — postgres role, strict TLS (pinned Supabase Root CA)
  ↓
ticketug.* tables + SQL functions (migration 012: create_order, cancel_order,
expire_order_if_due, expire_stale_orders, apply_payment_event,
transition_event_lifecycle)
  ↓
Supabase Auth (sessions via @supabase/ssr; server-side getUser() validation)
```

- `app/`: public web experience + route handlers (thin; logic in `lib/`).
- `lib/server/`: trusted server modules — orders, payments, tickets, check-ins,
  events. The browser never touches the database.
- `lib/rules/`: pure state machines and business rules (unit-tested, shared by
  the server layer and the behavioral harness).
- `lib/payments/`: provider adapters. The only registered adapter is the
  non-production test provider; the registry refuses every provider in
  production (fail-closed `TEST_PAYMENT_DISABLED` / `PROVIDER_NOT_CONFIGURED`).
- `scripts/migrate.mjs` (`pnpm migrate`): ledgered SQL migrations
  (`docs/migrations/000→012`).
- `scripts/staging-verify/`: behavioral harnesses (57-check gate/scanner/PDF
  matrix; 28-check SQL-function matrix) run against throwaway/staging data.

Pair 6 removed the separately hosted NestJS API (`apps/api`): the same
authorization decisions, transaction boundaries and state machines now live in
the Next.js server layer + PostgreSQL functions. See
`docs/SUPABASE_NATIVE_ARCHITECTURE.md` and `docs/NESTJS_REMOVAL_AUDIT.md`.

## Principles

- Server-side authorization for every protected resource (route layer AND
  re-verified inside mutating SQL functions).
- Integer minor-unit money values; server-calculated totals; price snapshots.
- Verified payment webhooks, idempotency, and reconciliation before ticket
  issuance (`ticketug.apply_payment_event` is the only issuance path).
- No payment provider is hard-coded until provider selection is approved.
- `ticketug` is NOT exposed via PostgREST; the anon role holds zero privileges
  on it (verified Pair 5.1). No `NEXT_PUBLIC_*` variables exist.
