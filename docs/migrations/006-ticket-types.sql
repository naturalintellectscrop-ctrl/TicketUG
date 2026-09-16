BEGIN;

CREATE TABLE IF NOT EXISTS ticketug.ticket_type (
  id uuid PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES ticketug.event(id) ON DELETE RESTRICT,
  public_id text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price_minor_units bigint NOT NULL CHECK (price_minor_units >= 0),
  currency char(3) NOT NULL DEFAULT 'UGX' CHECK (currency IN ('UGX')),
  capacity integer NOT NULL CHECK (capacity >= 0),
  sale_starts_at timestamptz,
  sale_ends_at timestamptz,
  active boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ticket_type_sale_window_valid CHECK (
    sale_starts_at IS NULL OR sale_ends_at IS NULL OR sale_starts_at < sale_ends_at
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ticket_type_event_name_unique
  ON ticketug.ticket_type (event_id, lower(name));
CREATE INDEX IF NOT EXISTS ticket_type_event_order_idx
  ON ticketug.ticket_type (event_id, sort_order, created_at);
CREATE INDEX IF NOT EXISTS ticket_type_event_active_idx
  ON ticketug.ticket_type (event_id, active);

COMMIT;
