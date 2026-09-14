BEGIN;

CREATE TABLE IF NOT EXISTS ticketug.venue (
  id uuid PRIMARY KEY,
  organizer_id uuid NOT NULL REFERENCES ticketug.organizer(id) ON DELETE CASCADE,
  name varchar(160) NOT NULL,
  address_line1 varchar(240),
  address_line2 varchar(240),
  city varchar(120),
  region varchar(120),
  country_code char(2) NOT NULL DEFAULT 'UG',
  latitude numeric(9,6),
  longitude numeric(9,6),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizer_id, name)
);

CREATE TABLE IF NOT EXISTS ticketug.event (
  id uuid PRIMARY KEY,
  organizer_id uuid NOT NULL REFERENCES ticketug.organizer(id) ON DELETE CASCADE,
  venue_id uuid REFERENCES ticketug.venue(id) ON DELETE SET NULL,
  public_id varchar(32) NOT NULL UNIQUE,
  slug varchar(180) NOT NULL,
  title varchar(180) NOT NULL,
  description text NOT NULL DEFAULT '',
  timezone varchar(64) NOT NULL DEFAULT 'Africa/Kampala',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  publication_state varchar(16) NOT NULL DEFAULT 'PRIVATE' CHECK (publication_state IN ('PRIVATE','PUBLIC')),
  lifecycle_state varchar(16) NOT NULL DEFAULT 'DRAFT' CHECK (lifecycle_state IN ('DRAFT','PUBLISHED','SALES_OPEN','SALES_CLOSED','EVENT_LIVE','COMPLETED','CANCELLED','SUSPENDED','ARCHIVED')),
  discoverable boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES ticketug.user_profile(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  UNIQUE (organizer_id, slug)
);

CREATE TABLE IF NOT EXISTS ticketug.event_media (
  id uuid PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES ticketug.event(id) ON DELETE CASCADE,
  storage_key varchar(512) NOT NULL,
  url varchar(2048) NOT NULL,
  alt_text varchar(240) NOT NULL DEFAULT '',
  media_type varchar(32) NOT NULL DEFAULT 'IMAGE' CHECK (media_type IN ('IMAGE','VIDEO')),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, storage_key)
);

CREATE INDEX IF NOT EXISTS event_organizer_idx ON ticketug.event (organizer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS event_public_idx ON ticketug.event (discoverable, publication_state, lifecycle_state, starts_at);
CREATE INDEX IF NOT EXISTS event_media_event_idx ON ticketug.event_media (event_id, sort_order);
COMMIT;
