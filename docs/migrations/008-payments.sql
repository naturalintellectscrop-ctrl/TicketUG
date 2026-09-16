CREATE SCHEMA IF NOT EXISTS ticketug;

ALTER TABLE ticketug.order ADD COLUMN IF NOT EXISTS payment_state text NOT NULL DEFAULT 'AWAITING_PAYMENT';
ALTER TABLE ticketug.order ADD COLUMN IF NOT EXISTS payment_expires_at timestamptz;
ALTER TABLE ticketug.order DROP CONSTRAINT IF EXISTS order_status_valid;
ALTER TABLE ticketug.order ADD CONSTRAINT order_status_valid CHECK (status IN ('AWAITING_PAYMENT','PAYMENT_PROCESSING','PAID','CANCELLED','EXPIRED'));
ALTER TABLE ticketug.order ADD CONSTRAINT order_payment_state_valid CHECK (payment_state IN ('AWAITING_PAYMENT','PAYMENT_PROCESSING','PAID','CANCELLED','EXPIRED'));
CREATE INDEX IF NOT EXISTS order_payment_expiry_idx ON ticketug.order(payment_expires_at) WHERE payment_expires_at IS NOT NULL AND status IN ('AWAITING_PAYMENT','PAYMENT_PROCESSING');

CREATE TABLE IF NOT EXISTS ticketug.payment (
  id uuid PRIMARY KEY,
  public_id text NOT NULL UNIQUE,
  order_id uuid NOT NULL UNIQUE REFERENCES ticketug.order(id) ON DELETE RESTRICT,
  provider text NOT NULL,
  amount_minor_units bigint NOT NULL CHECK (amount_minor_units >= 0),
  currency text NOT NULL CHECK (currency = 'UGX'),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','SUCCEEDED','FAILED','CANCELLED','EXPIRED')),
  provider_customer_reference text,
  successful_provider_reference text,
  failure_code text,
  failure_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  succeeded_at timestamptz,
  failed_at timestamptz
);
CREATE INDEX IF NOT EXISTS payment_status_idx ON ticketug.payment(status);
CREATE INDEX IF NOT EXISTS payment_provider_reference_idx ON ticketug.payment(provider, successful_provider_reference) WHERE successful_provider_reference IS NOT NULL;

CREATE TABLE IF NOT EXISTS ticketug.payment_attempt (
  id uuid PRIMARY KEY,
  public_id text NOT NULL UNIQUE,
  payment_id uuid NOT NULL REFERENCES ticketug.payment(id) ON DELETE RESTRICT,
  provider text NOT NULL,
  provider_attempt_reference text,
  amount_minor_units bigint NOT NULL CHECK (amount_minor_units >= 0),
  currency text NOT NULL CHECK (currency = 'UGX'),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','SUCCEEDED','FAILED','CANCELLED','EXPIRED')),
  idempotency_key text,
  provider_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  initiated_at timestamptz NOT NULL DEFAULT now(),
  processing_at timestamptz,
  completed_at timestamptz,
  failure_code text,
  failure_message text,
  UNIQUE(payment_id, idempotency_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS payment_attempt_provider_ref_idx ON ticketug.payment_attempt(provider, provider_attempt_reference) WHERE provider_attempt_reference IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payment_active_attempt_idx ON ticketug.payment_attempt(payment_id) WHERE status IN ('PENDING','PROCESSING');

CREATE TABLE IF NOT EXISTS ticketug.webhook_event (
  id uuid PRIMARY KEY,
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  signature_verified boolean NOT NULL DEFAULT false,
  processing_status text NOT NULL DEFAULT 'RECEIVED' CHECK (processing_status IN ('RECEIVED','PROCESSED','DUPLICATE','REJECTED','FAILED')),
  processed_at timestamptz,
  provider_reference text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  failure_message text,
  UNIQUE(provider, provider_event_id)
);
CREATE INDEX IF NOT EXISTS webhook_processing_idx ON ticketug.webhook_event(processing_status, received_at);
