-- 015 — drop the obsolete 7-argument create_order overload.
--
-- Migration 013 re-defined ticketug.create_order with an appended
-- p_purchaser_phone parameter. PostgreSQL treats a different argument list as
-- a NEW function, so both arities coexisted and every 7-argument call became
-- ambiguous (SQLSTATE 42725 "function is not unique"). All in-repo callers
-- now pass the phone explicitly; the old overload is dead weight and a
-- resolution hazard. Dropping it restores a single, unambiguous signature.

BEGIN;

DROP FUNCTION IF EXISTS ticketug.create_order(jsonb, text, text, text, uuid, text, integer);

COMMIT;
