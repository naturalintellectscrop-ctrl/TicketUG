BEGIN;

CREATE TABLE IF NOT EXISTS ticketug.event_staff_assignment (
  id uuid PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES ticketug.event(id) ON DELETE CASCADE,
  user_profile_id uuid NOT NULL REFERENCES ticketug.user_profile(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_profile_id)
);

CREATE INDEX IF NOT EXISTS event_staff_assignment_user_event_idx
  ON ticketug.event_staff_assignment(user_profile_id, event_id)
  WHERE status = 'ACTIVE';

ALTER TABLE ticketug.ticket DROP CONSTRAINT IF EXISTS ticket_status_check;
ALTER TABLE ticketug.ticket ADD CONSTRAINT ticket_status_check
  CHECK (status IN ('ISSUED', 'CHECKED_IN', 'CANCELLED', 'REFUNDED', 'VOID'));

CREATE TABLE IF NOT EXISTS ticketug.check_in (
  id uuid PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES ticketug.ticket(id) ON DELETE RESTRICT,
  event_id uuid NOT NULL REFERENCES ticketug.event(id) ON DELETE RESTRICT,
  scanner_profile_id uuid NOT NULL REFERENCES ticketug.user_profile(id) ON DELETE RESTRICT,
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ticket_id)
);

CREATE INDEX IF NOT EXISTS check_in_event_time_idx
  ON ticketug.check_in(event_id, checked_in_at DESC);
CREATE INDEX IF NOT EXISTS check_in_scanner_time_idx
  ON ticketug.check_in(scanner_profile_id, checked_in_at DESC);

COMMIT;
