BEGIN;

CREATE TABLE IF NOT EXISTS ticketug.ticket (
  id uuid PRIMARY KEY,
  public_id varchar(40) NOT NULL UNIQUE,
  credential_hash char(64) NOT NULL UNIQUE,
  credential varchar(120) NOT NULL UNIQUE,
  order_id uuid NOT NULL REFERENCES ticketug.order(id) ON DELETE RESTRICT,
  order_item_id uuid NOT NULL REFERENCES ticketug.order_item(id) ON DELETE RESTRICT,
  event_id uuid NOT NULL REFERENCES ticketug.event(id) ON DELETE RESTRICT,
  ticket_type_id uuid NOT NULL REFERENCES ticketug.ticket_type(id) ON DELETE RESTRICT,
  owner_profile_id uuid REFERENCES ticketug.user_profile(id) ON DELETE RESTRICT,
  unit_number integer NOT NULL CHECK (unit_number > 0),
  attendee_name varchar(180) NOT NULL,
  attendee_email varchar(320) NOT NULL,
  ticket_type_name_snapshot varchar(180) NOT NULL,
  unit_price_minor_units bigint NOT NULL CHECK (unit_price_minor_units >= 0),
  currency char(3) NOT NULL CHECK (currency IN ('UGX')),
  event_title_snapshot varchar(180) NOT NULL,
  event_starts_at timestamptz NOT NULL,
  event_ends_at timestamptz NOT NULL,
  venue_name_snapshot varchar(160),
  venue_city_snapshot varchar(120),
  status varchar(16) NOT NULL DEFAULT 'ISSUED' CHECK (status IN ('ISSUED','CHECKED_IN','CANCELLED','REFUNDED','VOID')),
  issued_at timestamptz NOT NULL DEFAULT now(),
  checked_in_at timestamptz,
  cancelled_at timestamptz,
  refunded_at timestamptz,
  voided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_item_id, unit_number)
);
CREATE INDEX IF NOT EXISTS ticket_owner_idx ON ticketug.ticket(owner_profile_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS ticket_order_idx ON ticketug.ticket(order_id, issued_at);
CREATE INDEX IF NOT EXISTS ticket_event_idx ON ticketug.ticket(event_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS ticket_credential_hash_idx ON ticketug.ticket(credential_hash);

CREATE TABLE IF NOT EXISTS ticketug.ticket_issuance_event (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES ticketug.order(id) ON DELETE RESTRICT,
  payment_id uuid NOT NULL REFERENCES ticketug.payment(id) ON DELETE RESTRICT,
  provider_reference varchar(240) NOT NULL,
  status varchar(16) NOT NULL CHECK (status IN ('ISSUED','FAILED')),
  ticket_count integer NOT NULL CHECK (ticket_count >= 0),
  error_code varchar(80),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE(order_id, payment_id, provider_reference)
);
CREATE INDEX IF NOT EXISTS ticket_issuance_order_idx ON ticketug.ticket_issuance_event(order_id, created_at DESC);

CREATE OR REPLACE FUNCTION ticketug.enforce_ticket_quantity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE purchased integer; issued integer;
BEGIN
  SELECT quantity INTO purchased FROM ticketug.order_item WHERE id = NEW.order_item_id;
  SELECT count(*) INTO issued FROM ticketug.ticket WHERE order_item_id = NEW.order_item_id;
  IF issued > purchased THEN RAISE EXCEPTION 'ticket quantity exceeded for order item'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ticket_quantity_guard ON ticketug.ticket;
CREATE CONSTRAINT TRIGGER ticket_quantity_guard AFTER INSERT ON ticketug.ticket DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION ticketug.enforce_ticket_quantity();

COMMIT;
