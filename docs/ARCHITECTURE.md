# TicketUG Architecture

Phase 1 establishes a Next.js App Router foundation backed by the connected Neon PostgreSQL integration. The initial web surface is intentionally thin; domain modules, organizer workflows, payments, and scanner operations will be added only after their documented decisions are resolved.

## Runtime boundaries

- `app/`: public web experience and lightweight route handlers.
- `lib/`: environment and shared server utilities.
- `packages/types/`: contracts shared by future web and API surfaces.
- Neon Auth tables are managed by the connected integration and are not duplicated by this foundation.

## Principles

- Server-side authorization for every protected resource.
- Integer minor-unit money values.
- Verified payment webhooks, idempotency, and reconciliation before ticket issuance.
- No payment provider is hard-coded until provider selection is approved.
