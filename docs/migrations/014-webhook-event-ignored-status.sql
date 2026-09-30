-- 014 — webhook_event: allow the IGNORED processing status.
--
-- Migration 013 taught apply_payment_event to acknowledge in-flight provider
-- notifications (e.g. NylonPay transaction.processing) as no-ops recorded
-- with processing_status = 'IGNORED'. The 008-era CHECK constraint on
-- webhook_event.processing_status predates that state and rejects it.
-- Audit clarity beats overloading PROCESSED: extend the domain instead.

BEGIN;

ALTER TABLE ticketug.webhook_event
  DROP CONSTRAINT webhook_event_processing_status_check;

ALTER TABLE ticketug.webhook_event
  ADD CONSTRAINT webhook_event_processing_status_check
  CHECK (processing_status IN ('RECEIVED','PROCESSED','DUPLICATE','REJECTED','FAILED','IGNORED'));

COMMIT;
