-- 013 — NylonPay live payments + Supabase-linter hardening.
--
-- Contents:
--   1. ticketug.order.purchaser_phone — the mobile-money number the provider
--      prompt is sent to (NylonPay collectPayment requires a customer phone).
--      Nullable: existing rows keep working; the adapter enforces presence
--      for the live provider at initiation time.
--   2. search_path pinning for the two trigger functions the Supabase
--      Security Advisor flagged ("Function Search Path Mutable") — same
--      posture every other SECURITY DEFINER function already has.
--   3. create_order re-defined to accept and persist the purchaser phone
--      (appended parameter with DEFAULT NULL — every existing call stays
--      byte-compatible).
--   4. apply_payment_event re-defined to tolerate provider PROCESSING
--      notifications (recorded in webhook_event, answered IGNORED, no state
--      change) — NylonPay emits transaction.processing events; refusing them
--      would 500 and trigger provider retries forever. Terminal-state rules,
--      amount/currency/order cross-checks and idempotency are UNCHANGED.

BEGIN;

-- 1) Purchaser phone on the order -------------------------------------------
ALTER TABLE ticketug.order ADD COLUMN IF NOT EXISTS purchaser_phone varchar(24);

-- 2) Security Advisor: Function Search Path Mutable -------------------------
ALTER FUNCTION ticketug.set_ticket_type_remaining_capacity() SET search_path = ticketug, pg_temp;
ALTER FUNCTION ticketug.enforce_ticket_quantity() SET search_path = ticketug, pg_temp;

-- 3) create_order + purchaser phone -----------------------------------------
CREATE OR REPLACE FUNCTION ticketug.create_order(
  p_items jsonb,
  p_purchaser_name text,
  p_purchaser_email text,
  p_idempotency_key text DEFAULT NULL,
  p_user_profile_id uuid DEFAULT NULL,
  p_guest_token_hash text DEFAULT NULL,
  p_window_minutes integer DEFAULT 15,
  p_purchaser_phone text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ticketug, pg_temp AS $fn$
DECLARE
  v_guest boolean := p_guest_token_hash IS NOT NULL;
  v_item jsonb;
  v_ref text;
  v_qty integer;
  v_seen text[];
  v_ticket record;
  v_line bigint;
  v_total bigint := 0;
  v_lines jsonb := '[]'::jsonb;
  v_existing record;
  v_order ticketug.order%ROWTYPE;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one order item is required';
  END IF;
  IF p_user_profile_id IS NULL AND NOT v_guest THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF v_guest AND (p_purchaser_email IS NULL OR length(btrim(p_purchaser_email)) = 0) THEN
    RAISE EXCEPTION 'Guest email is required';
  END IF;

  FOREACH v_item IN ARRAY ARRAY(SELECT * FROM jsonb_array_elements(p_items)) LOOP
    v_ref := v_item->>'ticketTypeId';
    v_qty := (v_item->>'quantity');
    IF v_ref IS NULL OR length(v_ref) = 0 THEN RAISE EXCEPTION 'Ticket type not found'; END IF;
    IF v_qty IS NULL OR v_qty <= 0 OR v_qty > 100 OR v_qty::text <> (v_item->>'quantity') OR strpos((v_item->>'quantity'), '.') > 0 THEN
      RAISE EXCEPTION 'Quantity must be a positive integer';
    END IF;
    IF v_ref = ANY(v_seen) THEN RAISE EXCEPTION 'Each ticket type may appear once per order'; END IF;
    v_seen := v_seen || v_ref;
  END LOOP;

  IF p_idempotency_key IS NOT NULL THEN
    IF v_guest THEN
      SELECT o.public_id INTO v_existing FROM ticketug.order o
       WHERE o.user_profile_id IS NULL AND o.purchaser_email = lower(btrim(p_purchaser_email))
         AND o.idempotency_key = p_idempotency_key LIMIT 1;
      IF v_existing IS NOT NULL THEN
        RAISE EXCEPTION 'Guest idempotency key was already used; use the original access token';
      END IF;
    ELSE
      SELECT o.id INTO v_existing FROM ticketug.order o
       WHERE o.user_profile_id = p_user_profile_id AND o.idempotency_key = p_idempotency_key LIMIT 1;
      IF v_existing IS NOT NULL THEN
        RETURN jsonb_build_object('reused', true, 'order', ticketug.order_json(v_existing.id));
      END IF;
    END IF;
  END IF;

  -- Deterministic lock order (same as the previous implementation).
  FOR v_ref IN
    SELECT DISTINCT j->>'ticketTypeId' AS ref FROM jsonb_array_elements(p_items) j ORDER BY 1
  LOOP
    PERFORM 1
      FROM ticketug.ticket_type t
      JOIN ticketug.event e ON e.id = t.event_id
     WHERE t.id::text = v_ref OR t.public_id = v_ref
       FOR UPDATE OF t;
    IF NOT FOUND THEN RAISE EXCEPTION 'Ticket type not found'; END IF;
  END LOOP;

  FOREACH v_item IN ARRAY ARRAY(SELECT * FROM jsonb_array_elements(p_items)) LOOP
    v_ref := v_item->>'ticketTypeId';
    v_qty := (v_item->>'quantity')::integer;
    SELECT t.*, e.lifecycle_state AS event_state, e.publication_state INTO v_ticket
      FROM ticketug.ticket_type t JOIN ticketug.event e ON e.id = t.event_id
     WHERE t.id::text = v_ref OR t.public_id = v_ref;
    IF NOT v_ticket.active THEN RAISE EXCEPTION 'Ticket type is inactive'; END IF;
    IF v_ticket.event_state <> 'SALES_OPEN' OR v_ticket.publication_state <> 'PUBLIC' THEN
      RAISE EXCEPTION 'Event is not accepting orders';
    END IF;
    IF v_ticket.sale_starts_at IS NOT NULL AND now() < v_ticket.sale_starts_at THEN
      RAISE EXCEPTION 'Ticket sales have not started';
    END IF;
    IF v_ticket.sale_ends_at IS NOT NULL AND now() >= v_ticket.sale_ends_at THEN
      RAISE EXCEPTION 'Ticket sales have ended';
    END IF;
    IF v_ticket.remaining_capacity < v_qty THEN RAISE EXCEPTION 'Insufficient ticket inventory'; END IF;
    v_line := v_ticket.price_minor_units * v_qty;
    IF v_line > 9007199254740991 THEN RAISE EXCEPTION 'Order total exceeds supported range'; END IF;
    v_total := v_total + v_line;
    v_lines := v_lines || jsonb_build_object(
      'ticket_type_id', v_ticket.id, 'ticket_name_snapshot', v_ticket.name, 'quantity', v_qty,
      'unit_price_minor_units', v_ticket.price_minor_units, 'currency_snapshot', v_ticket.currency,
      'line_total_minor_units', v_line);
  END LOOP;
  IF v_total > 9007199254740991 THEN RAISE EXCEPTION 'Order total exceeds supported range'; END IF;

  -- Guarded decrement — the overselling barrier.
  FOREACH v_item IN ARRAY ARRAY(SELECT * FROM jsonb_array_elements(v_lines)) LOOP
    UPDATE ticketug.ticket_type
       SET remaining_capacity = remaining_capacity - (v_item->>'quantity')::integer, updated_at = now()
     WHERE id = (v_item->>'ticket_type_id')::uuid
       AND remaining_capacity >= (v_item->>'quantity')::integer;
    IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient ticket inventory'; END IF;
  END LOOP;

  INSERT INTO ticketug.order (
    id, public_id, order_number, user_profile_id, purchaser_name, purchaser_email, purchaser_phone,
    guest_access_token_hash, currency, total_minor_units, idempotency_key, payment_expires_at
  ) VALUES (
    gen_random_uuid(),
    'ord_' || encode(extensions.gen_random_bytes(12), 'hex'),
    'UG-' || to_char(now() AT TIME ZONE 'utc', 'YYYY') || '-' || upper(encode(extensions.gen_random_bytes(5), 'hex')),
    p_user_profile_id, btrim(p_purchaser_name), lower(btrim(p_purchaser_email)),
    nullif(btrim(coalesce(p_purchaser_phone, '')), ''),
    p_guest_token_hash, 'UGX', v_total, p_idempotency_key,
    now() + make_interval(mins => greatest(1, least(120, coalesce(p_window_minutes, 15))))
  ) RETURNING * INTO v_order;

  INSERT INTO ticketug.order_item (
    id, order_id, ticket_type_id, quantity, ticket_name_snapshot,
    unit_price_minor_units, currency_snapshot, line_total_minor_units
  )
  SELECT gen_random_uuid(), v_order.id, (l->>'ticket_type_id')::uuid, (l->>'quantity')::integer,
         l->>'ticket_name_snapshot', (l->>'unit_price_minor_units')::bigint,
         l->>'currency_snapshot', (l->>'line_total_minor_units')::bigint
    FROM jsonb_array_elements(v_lines) l;

  RETURN jsonb_build_object('reused', false, 'order', ticketug.order_json(v_order.id));
END
$fn$;

-- 4) apply_payment_event — tolerate PROCESSING notifications ----------------
CREATE OR REPLACE FUNCTION ticketug.apply_payment_event(
  p_provider text,
  p_provider_event_id text,
  p_event_type text,
  p_attempt_reference text,
  p_order_reference text,
  p_amount_minor_units bigint,
  p_currency text,
  p_status text,
  p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ticketug, pg_temp AS $fn$
DECLARE
  v_event_id uuid;
  v_attempt record;
  v_legal text[] := ARRAY['SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED'];
BEGIN
  IF p_status NOT IN ('SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED', 'PROCESSING') THEN
    RAISE EXCEPTION 'PAYMENT_STATE_TRANSITION_INVALID: -> %', p_status;
  END IF;

  INSERT INTO ticketug.webhook_event (
    id, provider, provider_event_id, event_type, signature_verified, payload, provider_reference
  ) VALUES (
    gen_random_uuid(), p_provider, p_provider_event_id, coalesce(p_event_type, 'payment.updated'),
    true, p_payload, p_attempt_reference
  ) ON CONFLICT (provider, provider_event_id) DO NOTHING
  RETURNING id INTO v_event_id;

  IF v_event_id IS NULL THEN
    RETURN jsonb_build_object('status', 'DUPLICATE');
  END IF;

  IF p_status = 'PROCESSING' THEN
    -- In-flight notification (e.g. NylonPay transaction.processing): the
    -- attempt was already marked PROCESSING at initiation. Record the event
    -- for the audit trail and acknowledge — never touch payment state here.
    UPDATE ticketug.webhook_event SET processing_status = 'IGNORED', processed_at = now() WHERE id = v_event_id;
    RETURN jsonb_build_object('status', 'IGNORED');
  END IF;

  SELECT a.id AS attempt_id, a.public_id AS attempt_public_id, a.status AS attempt_status,
         a.amount_minor_units, a.currency, p.id AS payment_id, o.id AS order_id,
         o.public_id AS order_public_id
    INTO v_attempt
    FROM ticketug.payment_attempt a
    JOIN ticketug.payment p ON p.id = a.payment_id
    JOIN ticketug.order o ON o.id = p.order_id
   WHERE p.provider = p_provider AND a.provider_attempt_reference = p_attempt_reference
     FOR UPDATE OF p, a, o;

  IF v_attempt.attempt_id IS NULL THEN RAISE EXCEPTION 'Unknown provider transaction'; END IF;
  IF v_attempt.amount_minor_units <> p_amount_minor_units THEN RAISE EXCEPTION 'INVALID_PAYMENT_AMOUNT'; END IF;
  IF v_attempt.currency <> p_currency THEN RAISE EXCEPTION 'INVALID_PAYMENT_CURRENCY'; END IF;
  IF p_order_reference <> v_attempt.order_public_id THEN RAISE EXCEPTION 'INVALID_PAYMENT_ORDER'; END IF;

  IF v_attempt.attempt_status = 'SUCCEEDED' THEN
    UPDATE ticketug.webhook_event SET processing_status = 'DUPLICATE', processed_at = now() WHERE id = v_event_id;
    RETURN jsonb_build_object('status', 'DUPLICATE');
  END IF;

  -- Payment state machine (payment.rules.ts): only PENDING/PROCESSING can move
  -- to a terminal status; SUCCEEDED/FAILED/CANCELLED/EXPIRED are terminal.
  IF NOT (v_attempt.attempt_status = ANY (ARRAY['PENDING', 'PROCESSING'])) OR NOT (p_status = ANY (v_legal)) THEN
    RAISE EXCEPTION 'PAYMENT_STATE_TRANSITION_INVALID: % -> %', v_attempt.attempt_status, p_status;
  END IF;

  UPDATE ticketug.payment_attempt SET status = p_status, completed_at = now() WHERE id = v_attempt.attempt_id;
  UPDATE ticketug.payment
     SET status = p_status,
         successful_provider_reference = CASE WHEN p_status = 'SUCCEEDED' THEN p_attempt_reference ELSE successful_provider_reference END,
         succeeded_at = CASE WHEN p_status = 'SUCCEEDED' THEN now() ELSE succeeded_at END,
         updated_at = now()
   WHERE id = v_attempt.payment_id;
  UPDATE ticketug.order
     SET status = CASE WHEN p_status = 'SUCCEEDED' THEN 'PAID' ELSE status END,
         payment_state = CASE WHEN p_status = 'SUCCEEDED' THEN 'PAID' ELSE payment_state END,
         updated_at = now()
   WHERE id = v_attempt.order_id;

  IF p_status = 'SUCCEEDED' THEN
    PERFORM ticketug._issue_paid_tickets(v_attempt.order_id, v_attempt.payment_id, p_attempt_reference);
  END IF;

  UPDATE ticketug.webhook_event SET processing_status = 'PROCESSED', processed_at = now() WHERE id = v_event_id;
  RETURN jsonb_build_object('status', 'PROCESSED');
END
$fn$;

COMMIT;
