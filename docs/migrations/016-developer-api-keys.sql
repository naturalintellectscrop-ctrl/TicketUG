-- Developer API credentials (TicketUG Developer API v1).
--
-- Purpose: give organizer workspaces real, revocable developer credentials so
-- external integrations can read their own event/order/ticket data through
-- /api/v1 (bearer authentication). This is the storage half of the developer
-- API foundation; the auth/validation half lives in lib/api/*.
--
-- Security model:
--   * Only the SHA-256 hash of each key is stored — the raw secret exists
--     solely at creation time (returned once to the creating owner/manager).
--   * Keys are organizer-scoped: every /api/v1 query filters by the key's
--     organizer_id, so cross-tenant reads are impossible by construction.
--   * Revocation is a status flip (REVOKED + revoked_at/revoked_by) — the hash
--     row is kept for audit and so revoking an unknown key stays
--     distinguishable from a never-existing one.
--   * The v1 surface is read-only; scopes are stored per key so future
--     write scopes can be introduced without another migration.
--
-- Provenance: Task-18 cycle ("dashboard redesign + developer API"), decided
-- after the forensic API audit (CASE C — no developer-facing API existed).
-- Follows the forward-only migration conventions (BEGIN/COMMIT, IF NOT
-- EXISTS guards, named constraints, REVOKE posture from 012).

BEGIN;

CREATE TABLE IF NOT EXISTS ticketug.api_key (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid NOT NULL REFERENCES ticketug.organizer(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES ticketug.user_profile(id),
  name varchar(100) NOT NULL,
  prefix varchar(24) NOT NULL,
  key_hash char(64) NOT NULL UNIQUE,
  scopes text[] NOT NULL DEFAULT ARRAY['events.read', 'orders.read', 'tickets.read']::text[],
  status varchar(16) NOT NULL DEFAULT 'ACTIVE' CONSTRAINT api_key_status_valid CHECK (status IN ('ACTIVE', 'REVOKED')),
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by uuid REFERENCES ticketug.user_profile(id),
  CONSTRAINT api_key_revoked_complete CHECK (
    (status = 'ACTIVE' AND revoked_at IS NULL AND revoked_by IS NULL)
    OR (status = 'REVOKED' AND revoked_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS api_key_organizer_status_idx ON ticketug.api_key (organizer_id, status);

-- The single DB role used by the Next.js layer keeps full access; the blank
-- REVOKE keeps the table out of reach for any Supabase-authenticated client
-- (same posture as the 012 function lockdown).
REVOKE ALL ON ticketug.api_key FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE ticketug.api_key IS 'Developer API credentials (bearer keys for /api/v1). Only SHA-256 hashes are stored; raw keys are shown exactly once at creation.';
COMMENT ON COLUMN ticketug.api_key.prefix IS 'First characters of the raw key (e.g. tug_sk_Ab12Cd34) — safe to display for identification, never sufficient to authenticate.';
COMMENT ON COLUMN ticketug.api_key.scopes IS 'Permission scopes; v1 issues the read-only set events.read/orders.read/tickets.read.';

COMMIT;
