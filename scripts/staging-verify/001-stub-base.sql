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
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Pair 3: the UI/API upsert path (acceptInvitation ON CONFLICT) requires the
  -- workspace-scoped uniqueness and the updated_at column.
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organizer_member_org_profile_unique UNIQUE (organizer_id, user_profile_id)
);

-- Pair 3 additions: tables the authenticated UI journey proved the app reads
-- and writes (all part of the untracked 001-004 schema, mirrored from usage —
-- see lib/request-context.ts, lib/invitations.ts, app/api/organizers,
-- app/api/profile). Same stub rules apply: verification only, never production.

CREATE TABLE IF NOT EXISTS ticketug.platform_role (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_profile_id uuid NOT NULL REFERENCES ticketug.user_profile(id) ON DELETE CASCADE,
  role varchar(40) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_profile_id, role)
);

CREATE TABLE IF NOT EXISTS ticketug.security_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_profile_id uuid REFERENCES ticketug.user_profile(id) ON DELETE SET NULL,
  event_type varchar(60) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ticketug.organizer_invitation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid NOT NULL REFERENCES ticketug.organizer(id) ON DELETE CASCADE,
  invited_email varchar(320) NOT NULL,
  role varchar(40) NOT NULL,
  invited_by uuid REFERENCES ticketug.user_profile(id),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'PENDING',
  accepted_at timestamptz,
  accepted_by uuid REFERENCES ticketug.user_profile(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ticketug.attendee_profile (
  user_profile_id uuid PRIMARY KEY REFERENCES ticketug.user_profile(id) ON DELETE CASCADE,
  delivery_email varchar(320),
  delivery_phone varchar(40),
  updated_at timestamptz NOT NULL DEFAULT now()
);
