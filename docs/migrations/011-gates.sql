-- 011: Gate-level access model (Feature Pair 1B).
--
-- Model (see docs/TICKETUG_CONTINUITY.md §14):
--   event_gate        — named entry gates per event (Main Gate, VIP Gate, ...).
--   ticket_type_gate  — explicit ticket_type ↔ gate permission rows. A ticket type
--                       may pass through several gates; a gate admits several types.
--   event_staff_assignment.gate_id — optional gate scope on the EXISTING assignment
--                       row (UNIQUE(event_id, user_profile_id) unchanged): NULL keeps
--                       the legacy event-wide scanner; a gate reference restricts the
--                       scanner to that gate. The backend decides permission at scan
--                       time — never the client.
--
-- Semantics enforced in code (apps/api/src/check-ins/gate.rules.ts + Next mirror):
--   * Event with no active gates               → legacy behavior, no gate filtering.
--   * Event-wide assignment (gate_id IS NULL)  → may scan any gate (trusted staff).
--   * Gate-scoped assignment                    → ticket type must be explicitly
--     permitted through that scanner's gate, else rejected (WRONG_GATE).
--   * Deleted gate                              → its gate-scoped assignments are
--     deleted (CASCADE, fail-closed) rather than silently widened to event-wide.
--
-- Forward-only; follows the repository convention (manual psql application).
-- NOT production-applied: DATABASE VERIFICATION is BLOCKED until the real Neon
-- environment is reachable (see docs/TICKETUG_CONTINUITY.md §13).

BEGIN;

CREATE TABLE IF NOT EXISTS ticketug.event_gate (
  id uuid PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES ticketug.event(id) ON DELETE CASCADE,
  name varchar(120) NOT NULL,
  description varchar(500) NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS event_gate_event_name_unique
  ON ticketug.event_gate (event_id, lower(name));
CREATE INDEX IF NOT EXISTS event_gate_event_active_idx
  ON ticketug.event_gate (event_id, is_active);

CREATE TABLE IF NOT EXISTS ticketug.ticket_type_gate (
  ticket_type_id uuid NOT NULL REFERENCES ticketug.ticket_type(id) ON DELETE CASCADE,
  gate_id uuid NOT NULL REFERENCES ticketug.event_gate(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticket_type_id, gate_id)
);
CREATE INDEX IF NOT EXISTS ticket_type_gate_gate_idx
  ON ticketug.ticket_type_gate (gate_id);

ALTER TABLE ticketug.event_staff_assignment
  ADD COLUMN IF NOT EXISTS gate_id uuid REFERENCES ticketug.event_gate(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS event_staff_assignment_gate_idx
  ON ticketug.event_staff_assignment (gate_id)
  WHERE gate_id IS NOT NULL;

COMMIT;
