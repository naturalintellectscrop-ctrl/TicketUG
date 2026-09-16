BEGIN;

ALTER TABLE ticketug.ticket_type
  ADD COLUMN IF NOT EXISTS remaining_capacity integer;
UPDATE ticketug.ticket_type SET remaining_capacity = capacity WHERE remaining_capacity IS NULL;
ALTER TABLE ticketug.ticket_type ALTER COLUMN remaining_capacity SET NOT NULL;
ALTER TABLE ticketug.ticket_type DROP CONSTRAINT IF EXISTS ticket_type_remaining_capacity_valid;
ALTER TABLE ticketug.ticket_type ADD CONSTRAINT ticket_type_remaining_capacity_valid CHECK (remaining_capacity >= 0 AND remaining_capacity <= capacity);
CREATE OR REPLACE FUNCTION ticketug.set_ticket_type_remaining_capacity() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.remaining_capacity IS NULL THEN NEW.remaining_capacity := NEW.capacity; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS ticket_type_remaining_capacity_default ON ticketug.ticket_type;
CREATE TRIGGER ticket_type_remaining_capacity_default BEFORE INSERT ON ticketug.ticket_type FOR EACH ROW EXECUTE FUNCTION ticketug.set_ticket_type_remaining_capacity();

CREATE TABLE IF NOT EXISTS ticketug.order (
  id uuid PRIMARY KEY,
  public_id text NOT NULL UNIQUE,
  order_number text NOT NULL UNIQUE,
  user_profile_id uuid REFERENCES ticketug.user_profile(id) ON DELETE RESTRICT,
  purchaser_name varchar(180) NOT NULL,
  purchaser_email varchar(320) NOT NULL,
  guest_access_token_hash text,
  status varchar(24) NOT NULL DEFAULT 'AWAITING_PAYMENT' CHECK (status IN ('AWAITING_PAYMENT','CANCELLED')),
  currency char(3) NOT NULL DEFAULT 'UGX' CHECK (currency IN ('UGX')),
  total_minor_units bigint NOT NULL CHECK (total_minor_units >= 0),
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  CONSTRAINT order_guest_contact_valid CHECK (user_profile_id IS NOT NULL OR (guest_access_token_hash IS NOT NULL AND purchaser_email <> ''))
);

CREATE UNIQUE INDEX IF NOT EXISTS order_user_idempotency_unique ON ticketug.order (user_profile_id, idempotency_key) WHERE user_profile_id IS NOT NULL AND idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS order_guest_idempotency_unique ON ticketug.order (purchaser_email, idempotency_key) WHERE user_profile_id IS NULL AND idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS order_user_created_idx ON ticketug.order (user_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS order_number_idx ON ticketug.order (order_number);

CREATE TABLE IF NOT EXISTS ticketug.order_item (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES ticketug.order(id) ON DELETE RESTRICT,
  ticket_type_id uuid NOT NULL REFERENCES ticketug.ticket_type(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  ticket_name_snapshot varchar(180) NOT NULL,
  unit_price_minor_units bigint NOT NULL CHECK (unit_price_minor_units >= 0),
  currency_snapshot char(3) NOT NULL CHECK (currency_snapshot IN ('UGX')),
  line_total_minor_units bigint NOT NULL CHECK (line_total_minor_units >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, ticket_type_id)
);
CREATE INDEX IF NOT EXISTS order_item_order_idx ON ticketug.order_item (order_id);
CREATE INDEX IF NOT EXISTS order_item_ticket_type_idx ON ticketug.order_item (ticket_type_id);

COMMIT;
