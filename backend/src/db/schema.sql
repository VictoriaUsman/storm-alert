-- Storm Alert MVP — database schema
-- Run once: npm run db:setup

-- Drop in reverse dependency order so reruns are always clean
DROP TABLE IF EXISTS alerts_sent    CASCADE;
DROP TABLE IF EXISTS coverage_zones CASCADE;
DROP TABLE IF EXISTS storm_events   CASCADE;
DROP TABLE IF EXISTS users          CASCADE;

-- ─── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  company_name  VARCHAR(255) NOT NULL DEFAULT '',
  contact_name  VARCHAR(255) NOT NULL DEFAULT '',
  phone         VARCHAR(50)  NOT NULL DEFAULT '',
  role          VARCHAR(20)  NOT NULL DEFAULT 'client'
                             CHECK (role IN ('client', 'admin')),
  email_alerts  BOOLEAN      NOT NULL DEFAULT true,
  sms_alerts    BOOLEAN      NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── Coverage Zones ───────────────────────────────────────────────────────────
CREATE TABLE coverage_zones (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         VARCHAR(255) NOT NULL,
  input_value  VARCHAR(255) NOT NULL,   -- original zip / city / address entered
  center_lat   DECIMAL(9,6) NOT NULL,
  center_lng   DECIMAL(9,6) NOT NULL,
  radius_miles DECIMAL(8,2) NOT NULL DEFAULT 25,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── Storm Events ─────────────────────────────────────────────────────────────
CREATE TABLE storm_events (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  event_date    DATE         NOT NULL,
  event_type    VARCHAR(20)  NOT NULL CHECK (event_type IN ('hail', 'wind', 'tornado')),
  severity      VARCHAR(20)  NOT NULL CHECK (severity IN ('light', 'moderate', 'severe')),
  lat           DECIMAL(9,6) NOT NULL,
  lng           DECIMAL(9,6) NOT NULL,
  location_name VARCHAR(255) NOT NULL DEFAULT '',
  county        VARCHAR(100) NOT NULL DEFAULT '',
  state         VARCHAR(2)   NOT NULL DEFAULT '',
  hail_size     DECIMAL(5,2),    -- inches
  wind_speed    DECIMAL(6,1),    -- mph
  description   TEXT         NOT NULL DEFAULT '',
  source        VARCHAR(50)  NOT NULL DEFAULT 'NOAA_SPC',
  noaa_id       VARCHAR(150) UNIQUE,   -- dedup key
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── Alerts Sent ──────────────────────────────────────────────────────────────
CREATE TABLE alerts_sent (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  storm_event_id  UUID        REFERENCES storm_events(id) ON DELETE SET NULL,
  channel         VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'sms', 'manual')),
  status          VARCHAR(20) NOT NULL DEFAULT 'sent'
                              CHECK (status IN ('sent', 'failed', 'pending')),
  message_preview TEXT        NOT NULL DEFAULT '',
  triggered_by    VARCHAR(20) NOT NULL DEFAULT 'auto'
                              CHECK (triggered_by IN ('auto', 'admin')),
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent duplicate auto-alerts for the same user+storm+channel
CREATE UNIQUE INDEX alerts_sent_auto_dedup
  ON alerts_sent (user_id, storm_event_id, channel)
  WHERE triggered_by = 'auto';

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX idx_coverage_zones_user   ON coverage_zones (user_id);
CREATE INDEX idx_storm_events_date     ON storm_events    (event_date DESC);
CREATE INDEX idx_storm_events_location ON storm_events    (lat, lng);
CREATE INDEX idx_alerts_user           ON alerts_sent     (user_id);
CREATE INDEX idx_alerts_storm          ON alerts_sent     (storm_event_id);
