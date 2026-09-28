# Staging DB verification harness (Pair 2)

First-run, real-Postgres verification of the gate system, migration 011, ticket
issuance, scanner decisions and PDF generation. Runs against a **THROWAWAY**
database only — the runner refuses non-local hosts unless `--allow-remote` is
passed explicitly, and it seeds/deletes data freely.

## Why the stub base exists

The repository tracks migrations `005→011` (`docs/migrations/`). The base
schema they build on (`ticketug.user_profile`, `ticketug.organizer`,
`ticketug.organizer_member`) predates migration tracking in the repo (the
untracked "001–004", applied to production Neon before the repo recorded
them). Those files are intentionally NOT reconstructed here — `001-stub-base.sql`
is a clearly-labelled verification stub covering exactly the columns the
tracked migrations and services reference. NEVER apply it to production; on a
real staging Neon database, the base schema already exists and the stub is
unnecessary (skip it).

## Usage

```bash
# 1. Create/point at a throwaway Postgres (local container, staging box…).
# 2. Apply the base stub ONLY IF the database is empty (no 001–004):
psql "$THROWAWAY_URL" -f scripts/staging-verify/001-stub-base.sql
# 3. Apply the tracked migrations verbatim, in order:
for f in docs/migrations/00{5,6,7,8,9}-*.sql docs/migrations/010-*.sql docs/migrations/011-*.sql; do psql "$THROWAWAY_URL" -f "$f"; done
# 4. Run the DB-backed verification matrix (uses the repo's real services):
bun scripts/staging-verify/verify-gates.ts --url="$THROWAWAY_URL"
#    (add --allow-remote to permit a non-localhost throwaway host)
```

The runner is rerun-safe (it truncates its own throwaway data first) and exits
non-zero on any failure.

## What it proves (46 checks)

- **A — migration 011 objects:** `event_gate`, `ticket_type_gate`,
  `event_staff_assignment.gate_id`, all five indexes, ON DELETE CASCADE on both
  permission and assignment edges, case-insensitive gate-name uniqueness
  (functional probe, rolled back).
- **B/C — REAL issuance:** tickets issued through `TicketsService.issuePaidOrder`
  over an order + payment + order_item seed; issuance idempotency
  (same order+payment+provider reference ⇒ no duplicates).
- **D — REAL scanner decisions** via `CheckInsService.scan` (server-authoritative;
  the gate always comes from the staff assignment row): Regular→Main VALID,
  replay ALREADY_CHECKED_IN, Regular at VIP/VVIP WRONG_GATE (with permitted-gate
  names), VIP at Main+VIP VALID, VIP at VVIP WRONG_GATE, VVIP at VVIP VALID,
  VVIP at Main WRONG_GATE, unmapped type on a gated event WRONG_GATE
  (fail-closed), event-wide assignment unfiltered, disabled-gate assignment
  fails closed, unassigned staff / outsider UNAUTHORIZED_SCANNER, wrong event
  WRONG_EVENT, malformed QR INVALID_QR, unknown credential INVALID_TICKET,
  CANCELLED event EVENT_NOT_AVAILABLE, SUSPENDED event scannable by design
  (sales pause ≠ entry pause — documented rule), platform-admin bypass VALID.
- **E — gate deletion CASCADE:** permission rows + gate-scoped assignments
  disappear; the former gate scanner becomes UNAUTHORIZED_SCANNER (never
  silently widened); other gates and ticket data untouched.
- **F — REAL DB-backed PDFs:** `pdfMine`/`pdfGuest` produce `%PDF-` documents
  from authoritative rows with the safe filename convention; guest access token
  enforced (wrong token refused).

## Establish fact (2026-09-28, Postgres 18 via embedded-postgres)

The first full run of this harness found and fixed a genuine
production-blocking bug: `TicketsService.rowsForOrder` ordered by
`t.ticket_type_name` — a SELECT alias qualified with a table prefix, which
Postgres rejects (`column t.ticket_type_name does not exist`). Every real
webhook-driven issuance would have failed. Fixed to `t.ticket_type_name_snapshot`.
