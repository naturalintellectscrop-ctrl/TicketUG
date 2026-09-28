-- ============================================================================
-- THROWAWAY VERIFICATION HARNESS — NOT A MIGRATION. NEVER APPLY TO PRODUCTION.
-- ============================================================================
-- TicketUG tracks migrations 005+ in docs/migrations/. The base schema that
-- 005-011 build on (ticketug.user_profile, ticketug.organizer,
-- ticketug.organizer_member) was applied to the production Neon database
-- before the repository began tracking migrations (the untracked "001-004").
-- Those files are intentionally NOT reconstructed here.
--
-- This stub exists ONLY so the verbatim 005→011 migrations and the DB-backed
-- verification runner (verify-gates.ts) can execute against a real Postgres
-- engine on a THROWAWAY database (local container / staging box / Neon
-- branch). It mirrors exactly the columns those migrations and services
-- reference — nothing more.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS ticketug;

CREATE TABLE IF NOT EXISTS ticketug.user_profile (
  id uuid PRIMARY KEY,
  auth_user_id text UNIQUE NOT NULL,
  display_name varchar(200) NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ticketug.organizer (
  id uuid PRIMARY KEY,
  name varchar(200) NOT NULL,
  slug varchar(200) NOT NULL UNIQUE,
  created_by uuid REFERENCES ticketug.user_profile(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ticketug.organizer_member (
  id uuid PRIMARY KEY,
  organizer_id uuid NOT NULL REFERENCES ticketug.organizer(id) ON DELETE CASCADE,
  user_profile_id uuid NOT NULL REFERENCES ticketug.user_profile(id) ON DELETE CASCADE,
  role varchar(40) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'ACTIVE',
  invited_by uuid REFERENCES ticketug.user_profile(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
