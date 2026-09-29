-- ============================================================================
-- 012: Supabase-native backend — transactional authority as SQL functions.
-- ============================================================================
-- Pair 6 (NestJS removal). The separately hosted NestJS API is removed; the
-- operations where the DATABASE must be the authority for multi-row invariants
-- become `security definer` functions in the hidden `ticketug` schema. They are
-- called ONLY by the trusted server pool (postgres role) from the Next.js tier:
--
--   ticketug.create_order            — atomic guest/user order creation
--                                      (idempotency, FOR UPDATE inventory lock,
--                                      guarded decrement, price snapshots)
--   ticketug.cancel_order            — ownership-checked cancel (inventory
--                                      restore + payment/attempt teardown)
--   ticketug.expire_order_if_due     — lazy single-order payment-window expiry
--   ticketug.expire_stale_orders     — bounded SKIP LOCKED sweep (cron surface)
--   ticketug.apply_payment_event     — verified webhook application (dedupe,
--                                      amount/currency/order checks, payment +
--                                      order state machines, ticket issuance)
--
-- Authorization model (unchanged): the calling server has already resolved the
-- session; mutating functions RE-VERIFY actor authority internally (ownership /
-- guest token hash) so a route-layer bug can never broaden access.
--
-- PostgREST hardening: every function is REVOKEd from PUBLIC/anon/authenticated.
-- The ticketug schema is not exposed via PostgREST (Pair 5.1 verified: the anon
-- role has no USAGE and no grants) — these functions keep that posture.
--
-- Error contract: failures raise exceptions whose message matches the exact
-- strings the NestJS services produced, so the Next.js tier maps them to the
-- same HTTP statuses/bodies (lib/server/errors.ts). Semantic parity over
-- inventing new codes.
-- ============================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS ticketug;

-- ---------------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------------

-- base64url random string (credential suffixes) — matches Node's
-- randomBytes(n).toString('base64url'): standard alphabet mapped to URL-safe,
-- padding stripped. Length = ceil(bytes*4/3) unpadded.
CREATE OR REPLACE FUNCTION ticketug.rand_b64url(p_bytes integer)
RETURNS text LANGUAGE sql VOLATILE PARALLEL SAFE
SET search_path = ticketug, pg_temp AS $$
  SELECT rtrim(translate(encode(extensions.gen_random_bytes(p_bytes), 'base64'), '+/', '-_'), '=')
$$;

-- Order projection identical to the previous API's `present()` shape.
CREATE OR REPLACE FUNCTION ticketug.order_json(p_order_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ticketug, pg_temp AS $$
  SELECT jsonb_build_object(
    'publicId', o.public_id,
    'orderNumber', o.order_number,
    'status', o.status,
    'purchaserName', o.purchaser_name,
    'purchaserEmail', o.purchaser_email,
    'currency', o.currency,
    'totalMinorUnits', o.total_minor_units,
    'createdAt', o.created_at,
    'updatedAt', o.updated_at,
    'cancelledAt', o.cancelled_at,
    'paymentExpiresAt', o.payment_expires_at,
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'ticketTypeId', i.ticket_type_id,
        'ticketName', i.ticket_name_snapshot,
        'quantity', i.quantity,
        'unitPriceMinorUnits', i.unit_price_minor_units,
        'currency', i.currency_snapshot,
        'lineTotalMinorUnits', i.line_total_minor_units
      ) ORDER BY i.created_at)
      FROM ticketug.order_item i WHERE i.order_id = o.id
    ), '[]'::jsonb)
  )
  FROM ticketug.order o WHERE o.id = p_order_id
$$;

-- Restores one order item's quantity back to inventory (guarded increment,
-- same as the previous API: never exceeds capacity → idempotent restores).
CREATE OR REPLACE FUNCTION ticketug._restock_item(p_ticket_type_id uuid, p_quantity integer)
RETURNS void LANGUAGE sql VOLATILE
SET search_path = ticketug, pg_temp AS $$
  UPDATE ticketug.ticket_type
     SET remaining_capacity = remaining_capacity + p_quantity, updated_at = now()
   WHERE id = p_ticket_type_id AND remaining_capacity + p_quantity <= capacity
$$;

-- Tears down any in-flight payment/attempts for a locked order (PENDING and
-- PROCESSING are the only legal sources for CANCELLED/EXPIRED — asserted by the
-- callers' status filter; both transitions are legal for both targets).
CREATE OR REPLACE FUNCTION ticketug._teardown_payments(p_order_id uuid, p_target text)
RETURNS void LANGUAGE plpgsql VOLATILE
SET search_path = ticketug, pg_temp AS $$
BEGIN
  IF p_target NOT IN ('CANCELLED', 'EXPIRED') THEN
    RAISE EXCEPTION 'PAYMENT_STATE_TRANSITION_INVALID: -> %', p_target;
  END IF;
  UPDATE ticketug.payment
     SET status = p_target, updated_at = now()
   WHERE order_id = p_order_id AND status IN ('PENDING', 'PROCESSING');
  UPDATE ticketug.payment_attempt a
     SET status = p_target, completed_at = now()
   WHERE a.status IN ('PENDING', 'PROCESSING')
     AND a.payment_id IN (SELECT id FROM ticketug.payment WHERE order_id = p_order_id);
END
$$;

-- Issuance core: proves PAID + SUCCEEDED, de-duplicates by issuance event,
-- mints one ticket per unit with credential + sha256 + full snapshots.
CREATE OR REPLACE FUNCTION ticketug._issue_paid_tickets(
  p_order_id uuid, p_payment_id uuid, p_provider_reference text
) RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ticketug, pg_temp AS $$
DECLARE
  v_order record;
  v_payment_status text;
  v_item record;
  v_unit integer;
  v_credential text;
  v_total integer := 0;
  v_existing uuid;
BEGIN
  SELECT * INTO v_order FROM ticketug.order WHERE id = p_order_id FOR UPDATE;
  SELECT status INTO v_payment_status FROM ticketug.payment WHERE id = p_payment_id AND order_id = p_order_id FOR UPDATE;
  IF v_order IS NULL OR v_payment_status IS NULL OR v_order.status <> 'PAID' OR v_payment_status <> 'SUCCEEDED' THEN
    RAISE EXCEPTION 'TICKETS_REQUIRE_VERIFIED_PAYMENT';
  END IF;

  SELECT id INTO v_existing FROM ticketug.ticket_issuance_event
   WHERE order_id = p_order_id AND payment_id = p_payment_id AND provider_reference = p_provider_reference
   FOR UPDATE;
  IF v_existing IS NOT NULL THEN RETURN; END IF;

  FOR v_item IN
    SELECT oi.id AS order_item_id, oi.quantity, oi.ticket_type_id, oi.ticket_name_snapshot,
           oi.unit_price_minor_units, oi.currency_snapshot, t.event_id,
           e.title AS event_title, e.starts_at, e.ends_at, v.name AS venue_name, v.city AS venue_city
      FROM ticketug.order_item oi
      JOIN ticketug.ticket_type t ON t.id = oi.ticket_type_id
      JOIN ticketug.event e ON e.id = t.event_id
      LEFT JOIN ticketug.venue v ON v.id = e.venue_id
     WHERE oi.order_id = p_order_id
     ORDER BY oi.created_at
     FOR UPDATE OF oi, t, e
  LOOP
    FOR v_unit IN 1..v_item.quantity LOOP
      v_credential := 'tkt_' || ticketug.rand_b64url(32);
      INSERT INTO ticketug.ticket (
        id, public_id, credential, credential_hash, order_id, order_item_id, event_id, ticket_type_id,
        owner_profile_id, unit_number, attendee_name, attendee_email, ticket_type_name_snapshot,
        unit_price_minor_units, currency, event_title_snapshot, event_starts_at, event_ends_at,
        venue_name_snapshot, venue_city_snapshot
      ) VALUES (
        gen_random_uuid(), 'tkt_' || encode(extensions.gen_random_bytes(12), 'hex'), v_credential,
        encode(extensions.digest(v_credential, 'sha256'), 'hex'), p_order_id, v_item.order_item_id, v_item.event_id,
        v_item.ticket_type_id, v_order.user_profile_id, v_unit, v_order.purchaser_name, v_order.purchaser_email,
        v_item.ticket_name_snapshot, v_item.unit_price_minor_units, v_item.currency_snapshot,
        v_item.event_title, v_item.starts_at, v_item.ends_at, v_item.venue_name, v_item.venue_city
      );
      v_total := v_total + 1;
    END LOOP;
  END LOOP;

  INSERT INTO ticketug.ticket_issuance_event (id, order_id, payment_id, provider_reference, status, ticket_count, completed_at)
  VALUES (gen_random_uuid(), p_order_id, p_payment_id, p_provider_reference, 'ISSUED', v_total, now());
END
$$;

-- ---------------------------------------------------------------------------
-- create_order — atomic order creation for signed-in AND guest buyers.
-- Mirrors the previous OrdersService.create() semantics exactly:
--   * idempotency (user: reuse; guest: hard conflict)
--   * deterministic FOR UPDATE lock order (items sorted by reference)
--   * per-line: active + event SALES_OPEN/PUBLIC + sale window + inventory
--   * server-calculated totals in integer minor units (BigInt-safe range)
--   * guarded decrement (remaining_capacity >= quantity)
--   * immutable price/name snapshots on order_item
-- Expects p_items = [{"ticketTypeId": "...", "quantity": n}, …].
-- Returns {"reused": bool, "order": <order_json>}. The guest access token is
-- generated by the CALLER (Node CSPRNG); only its sha256 hash is passed in.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ticketug.create_order(
  p_items jsonb,
  p_purchaser_name text,
  p_purchaser_email text,
  p_idempotency_key text DEFAULT NULL,
  p_user_profile_id uuid DEFAULT NULL,
  p_guest_token_hash text DEFAULT NULL,
  p_window_minutes integer DEFAULT 15
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
    id, public_id, order_number, user_profile_id, purchaser_name, purchaser_email,
    guest_access_token_hash, currency, total_minor_units, idempotency_key, payment_expires_at
  ) VALUES (
    gen_random_uuid(),
    'ord_' || encode(extensions.gen_random_bytes(12), 'hex'),
    'UG-' || to_char(now() AT TIME ZONE 'utc', 'YYYY') || '-' || upper(encode(extensions.gen_random_bytes(5), 'hex')),
    p_user_profile_id, btrim(p_purchaser_name), lower(btrim(p_purchaser_email)),
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

-- ---------------------------------------------------------------------------
-- cancel_order — ownership-checked cancellation of a locked order.
-- Authority: exactly one of p_user_profile_id / p_guest_token_hash. Mirrors the
-- previous semantics: user path does NOT lazy-expire first (an EXPIRED order
-- cannot be cancelled → 409), guest path expires first (caller invokes
-- expire_order_if_due beforehand, as before).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ticketug.cancel_order(
  p_public_id text,
  p_user_profile_id uuid DEFAULT NULL,
  p_guest_token_hash text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ticketug, pg_temp AS $fn$
DECLARE
  v_order ticketug.order%ROWTYPE;
  v_item record;
BEGIN
  IF p_user_profile_id IS NULL AND p_guest_token_hash IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  SELECT * INTO v_order FROM ticketug.order WHERE public_id = p_public_id FOR UPDATE;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF p_guest_token_hash IS NOT NULL THEN
    IF v_order.user_profile_id IS NOT NULL OR v_order.guest_access_token_hash IS NULL
       OR v_order.guest_access_token_hash <> p_guest_token_hash THEN
      RAISE EXCEPTION 'Order not found';
    END IF;
  ELSE
    IF v_order.user_profile_id IS NULL OR v_order.user_profile_id <> p_user_profile_id THEN
      RAISE EXCEPTION 'Order not found';
    END IF;
  END IF;

  IF v_order.status NOT IN ('AWAITING_PAYMENT', 'PAYMENT_PROCESSING') THEN
    RAISE EXCEPTION 'ORDER_STATE_TRANSITION_INVALID: % -> CANCELLED', v_order.status;
  END IF;

  FOR v_item IN SELECT ticket_type_id, quantity FROM ticketug.order_item WHERE order_id = v_order.id LOOP
    PERFORM ticketug._restock_item(v_item.ticket_type_id, v_item.quantity);
  END LOOP;
  PERFORM ticketug._teardown_payments(v_order.id, 'CANCELLED');

  UPDATE ticketug.order
     SET status = 'CANCELLED', payment_state = 'CANCELLED', cancelled_at = now(), updated_at = now()
   WHERE id = v_order.id;

  RETURN jsonb_build_object('reused', false, 'order', ticketug.order_json(v_order.id));
END
$fn$;

-- ---------------------------------------------------------------------------
-- expire_order_if_due — lazy expiry for read/initiate paths. Returns NULL when
-- the order is missing or not due. Caller already holds the semantic contract
-- of the previous order-expiry engine (FOR UPDATE serialises against a
-- concurrent webhook; guarded restock is idempotent).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ticketug.expire_order_if_due(p_public_id text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ticketug, pg_temp AS $fn$
DECLARE
  v_order record;
  v_restocked integer := 0;
  v_item record;
BEGIN
  SELECT id, public_id, order_number, status, payment_expires_at INTO v_order
    FROM ticketug.order WHERE public_id = p_public_id FOR UPDATE;
  IF v_order.id IS NULL THEN RETURN NULL; END IF;
  IF v_order.status NOT IN ('AWAITING_PAYMENT', 'PAYMENT_PROCESSING') THEN RETURN NULL; END IF;
  IF v_order.payment_expires_at IS NULL OR v_order.payment_expires_at > now() THEN RETURN NULL; END IF;

  FOR v_item IN SELECT ticket_type_id, quantity FROM ticketug.order_item WHERE order_id = v_order.id LOOP
    PERFORM ticketug._restock_item(v_item.ticket_type_id, v_item.quantity);
    v_restocked := v_restocked + v_item.quantity;
  END LOOP;

  UPDATE ticketug.order SET status = 'EXPIRED', payment_state = 'EXPIRED', updated_at = now() WHERE id = v_order.id;
  PERFORM ticketug._teardown_payments(v_order.id, 'EXPIRED');

  RETURN jsonb_build_object('publicId', v_order.public_id, 'orderNumber', v_order.order_number,
                            'status', 'EXPIRED', 'inventoryRestored', v_restocked);
END
$fn$;

-- ---------------------------------------------------------------------------
-- expire_stale_orders — bounded sweep with FOR UPDATE SKIP LOCKED (two sweepers
-- never block each other). Returns an array of expiry summaries.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ticketug.expire_stale_orders(p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ticketug, pg_temp AS $fn$
DECLARE
  v_capped integer;
  v_due record;
  v_item record;
  v_restocked integer;
  v_result jsonb := '[]'::jsonb;
BEGIN
  v_capped := greatest(1, least(500, coalesce(p_limit, 100)));
  FOR v_due IN
    SELECT id, public_id, order_number FROM ticketug.order
     WHERE status IN ('AWAITING_PAYMENT', 'PAYMENT_PROCESSING')
       AND payment_expires_at IS NOT NULL AND payment_expires_at <= now()
     ORDER BY payment_expires_at
     LIMIT v_capped
     FOR UPDATE SKIP LOCKED
  LOOP
    v_restocked := 0;
    FOR v_item IN SELECT ticket_type_id, quantity FROM ticketug.order_item WHERE order_id = v_due.id LOOP
      PERFORM ticketug._restock_item(v_item.ticket_type_id, v_item.quantity);
      v_restocked := v_restocked + v_item.quantity;
    END LOOP;
    UPDATE ticketug.order SET status = 'EXPIRED', payment_state = 'EXPIRED', updated_at = now() WHERE id = v_due.id;
    PERFORM ticketug._teardown_payments(v_due.id, 'EXPIRED');
    v_result := v_result || jsonb_build_object('publicId', v_due.public_id, 'orderNumber', v_due.order_number,
                                               'status', 'EXPIRED', 'inventoryRestored', v_restocked);
  END LOOP;
  RETURN v_result;
END
$fn$;

-- ---------------------------------------------------------------------------
-- apply_payment_event — the verified webhook's transactional core (also used by
-- the staging test-complete path, which builds and HMAC-verifies the same event
-- shape). Mirrors PaymentsService.webhook() exactly:
--   * dedupe by (provider, provider_event_id) — replay → {"status":"DUPLICATE"}
--   * attempt locked FOR UPDATE (with payment + order)
--   * amount / currency / order-reference validation
--   * SUCCEEDED attempt + new event → DUPLICATE (committed)
--   * state-machine-asserted attempt → payment → order transitions
--   * ticket issuance ONLY here, once, idempotently
-- ---------------------------------------------------------------------------
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
  IF p_status NOT IN ('SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED') THEN
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

-- ---------------------------------------------------------------------------
-- transition_event_lifecycle — centralized event state machine (Case D: the
-- rules move from the removed NestJS EventsController into the database).
-- Authority re-verified inside: ACTIVE organizer membership; owner-only for
-- PUBLISHED / CANCELLED. Guarded UPDATE makes the transition atomic even under
-- concurrent callers. Returns the full event row as jsonb.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ticketug.transition_event_lifecycle(
  p_actor_profile_id uuid,
  p_event_id uuid,
  p_to text
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ticketug, pg_temp AS $fn$
DECLARE
  v_event record;
  v_role text;
  v_allowed jsonb;
  v_publication text;
  v_discoverable boolean;
  v_updated record;
BEGIN
  IF p_to IS NULL OR p_to NOT IN ('DRAFT','PUBLISHED','SALES_OPEN','SALES_CLOSED','EVENT_LIVE','COMPLETED','CANCELLED','SUSPENDED','ARCHIVED') THEN
    RAISE EXCEPTION 'Unknown lifecycle state';
  END IF;

  SELECT * INTO v_event FROM ticketug.event WHERE id = p_event_id;
  IF v_event.id IS NULL THEN RAISE EXCEPTION 'Event not found'; END IF;

  SELECT om.role INTO v_role
    FROM ticketug.organizer_member om
   WHERE om.organizer_id = v_event.organizer_id
     AND om.user_profile_id = p_actor_profile_id
     AND om.status = 'ACTIVE';
  IF v_role IS NULL OR v_role NOT IN ('ORGANIZER_OWNER', 'ORGANIZER_MANAGER') THEN
    RAISE EXCEPTION 'Organizer access denied';
  END IF;
  IF p_to IN ('PUBLISHED', 'CANCELLED') AND v_role <> 'ORGANIZER_OWNER' THEN
    RAISE EXCEPTION 'Organizer access denied';
  END IF;

  -- Transition map (event-lifecycle.ts) encoded as adjacency.
  v_allowed := jsonb_build_object(
    'DRAFT',        '["PUBLISHED","CANCELLED"]'::jsonb,
    'PUBLISHED',    '["SALES_OPEN","CANCELLED","SUSPENDED"]'::jsonb,
    'SALES_OPEN',   '["SALES_CLOSED","SUSPENDED","CANCELLED"]'::jsonb,
    'SALES_CLOSED', '["EVENT_LIVE","CANCELLED"]'::jsonb,
    'EVENT_LIVE',   '["COMPLETED","CANCELLED"]'::jsonb,
    'COMPLETED',    '["ARCHIVED"]'::jsonb,
    'CANCELLED',    '["ARCHIVED"]'::jsonb,
    'SUSPENDED',    '["PUBLISHED","CANCELLED","ARCHIVED"]'::jsonb,
    'ARCHIVED',     '[]'::jsonb
  );
  IF NOT (p_to = ANY (ARRAY(SELECT jsonb_array_elements_text(v_allowed -> v_event.lifecycle_state)))) THEN
    RAISE EXCEPTION 'Invalid event lifecycle transition';
  END IF;

  v_publication := CASE WHEN p_to = 'PUBLISHED' THEN 'PUBLIC' WHEN p_to = 'DRAFT' THEN 'PRIVATE' END;
  v_discoverable := (p_to = 'PUBLISHED');

  UPDATE ticketug.event e
     SET lifecycle_state = p_to,
         publication_state = coalesce(v_publication, e.publication_state),
         discoverable = v_discoverable,
         updated_at = now()
   WHERE e.id = p_event_id AND e.lifecycle_state = v_event.lifecycle_state
  RETURNING * INTO v_updated;
  IF v_updated.id IS NULL THEN RAISE EXCEPTION 'Invalid event lifecycle transition'; END IF;

  RETURN to_jsonb(v_updated);
END
$fn$;

-- ---------------------------------------------------------------------------
-- PostgREST hardening: these functions are server-pool-only. Nothing else may
-- execute them (the ticketug schema itself is not exposed via PostgREST).
-- ---------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS fn
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'ticketug'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.fn);
  END LOOP;
END
$$;

COMMIT;
