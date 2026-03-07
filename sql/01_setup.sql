-- ============================================================
-- In Lights — INITIAL SETUP
-- ⚠️  Run this ONLY on a brand new / empty Supabase project.
-- ⚠️  NEVER run this again once you have data — it will wipe releases.
-- For existing installs → run schema_migrations.sql instead.
-- ============================================================

-- RELEASES table
CREATE TABLE IF NOT EXISTS releases (
  id                   TEXT PRIMARY KEY,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  status               TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','approved','scheduled','released','rejected')),
  main_artist          TEXT NOT NULL,
  collaborations       JSONB NOT NULL DEFAULT '[]',
  features             JSONB NOT NULL DEFAULT '[]',
  release_type         TEXT NOT NULL CHECK (release_type IN ('single','ep','album')),
  release_title        TEXT NOT NULL,
  release_date         TEXT,
  explicit_content     BOOLEAN NOT NULL DEFAULT false,
  genre                TEXT,
  cover_art_drive_link TEXT,
  cover_art_image_url  TEXT,
  tracks               JSONB NOT NULL DEFAULT '[]',
  promo_drive_link     TEXT,
  drive_folder_link    TEXT,
  rights_confirmed     BOOLEAN NOT NULL DEFAULT false,
  label_notes          TEXT,
  upc                  TEXT,
  priority             TEXT DEFAULT 'normal' CHECK (priority IN ('urgent', 'normal', 'low')),
  checklist            JSONB DEFAULT '[]'
);

-- SETTINGS table (single row, settings_id = 1 always)
CREATE TABLE IF NOT EXISTS settings (
  settings_id                   INTEGER PRIMARY KEY,
  company_name                  TEXT    NOT NULL DEFAULT 'In Lights',
  company_logo                  TEXT    DEFAULT 'https://i.ibb.co/1fPkzkSD/IMG-1647-1.png',
  accent_color                  TEXT    DEFAULT '#7c3aed',
  admin_username                TEXT    DEFAULT 'admin',
  admin_password_hash           TEXT    DEFAULT '0a15557faae3b031ade95b1608480a5f73594f6f559e10bcfc93302f1f26c579',
  form_welcome_text             TEXT    DEFAULT 'Submit Your Release',
  form_description              TEXT    DEFAULT 'Fill out the form below to submit your music release to In Lights.',
  submission_success_message    TEXT    DEFAULT 'Your submission has been received and is under review.',
  rights_agreement_text         TEXT,
  require_drive_folder          BOOLEAN DEFAULT false,
  require_promo_materials       BOOLEAN DEFAULT false,
  require_lyrics                BOOLEAN DEFAULT false,
  require_mix_master            BOOLEAN DEFAULT false,
  require_cover_art_specs       BOOLEAN DEFAULT false,
  require_credits               BOOLEAN DEFAULT false,
  min_release_days_notice       INTEGER DEFAULT 7,
  max_tracks_album              INTEGER DEFAULT 32,
  max_collaborators             INTEGER DEFAULT 0,
  max_features                  INTEGER DEFAULT 0,
  allowed_release_types         TEXT    DEFAULT 'single,ep,album',
  custom_genres                 TEXT    DEFAULT '',
  status_label_pending          TEXT    DEFAULT 'Pending',
  status_label_approved         TEXT    DEFAULT 'Approved',
  status_label_scheduled        TEXT    DEFAULT 'Scheduled',
  status_label_released         TEXT    DEFAULT 'Released',
  status_label_rejected         TEXT    DEFAULT 'Rejected',
  notification_email            TEXT,
  discord_webhook               TEXT,
  google_sheets_webhook         TEXT,
  submission_cooldown_hours     INTEGER DEFAULT 0,
  maintenance_mode              BOOLEAN DEFAULT false,
  maintenance_mode_message      TEXT    DEFAULT 'The submission portal is temporarily unavailable.',
  auto_approve_after_days       INTEGER DEFAULT 0,
  form_accent_button_label      TEXT    DEFAULT 'Continue',
  drive_picker_enabled          BOOLEAN DEFAULT false,
  google_api_client_id          TEXT,
  google_api_key                TEXT,
  drive_upload_folder_id        TEXT,
  allow_cover_art_image_url     BOOLEAN DEFAULT true,
  show_artwork_preview          BOOLEAN DEFAULT true,
  require_tiktok_timestamp      BOOLEAN DEFAULT false,
  form_footer_text              TEXT,
  label_email                   TEXT,
  label_instagram               TEXT,
  label_website                 TEXT
);

-- Seed the single settings row (only if not already there)
INSERT INTO settings (settings_id) VALUES (1) ON CONFLICT (settings_id) DO NOTHING;

-- ADMIN USERS table
CREATE TABLE IF NOT EXISTS admin_users (
  id            UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT  NOT NULL UNIQUE,
  password_hash TEXT  NOT NULL,
  role          TEXT  NOT NULL DEFAULT 'reviewer' CHECK (role IN ('owner', 'admin', 'reviewer')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  last_login    TIMESTAMPTZ
);

-- ACTIVITY LOG table
CREATE TABLE IF NOT EXISTS admin_activity_log (
  id            UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  admin_username TEXT NOT NULL,
  admin_role    TEXT,
  action        TEXT NOT NULL,
  entity_type   TEXT NOT NULL DEFAULT 'release',
  entity_id     TEXT,
  entity_label  TEXT,
  meta          JSONB DEFAULT '{}'
);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE releases            ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_activity_log  ENABLE ROW LEVEL SECURITY;

-- Releases: artists can insert, admins can do everything
CREATE POLICY IF NOT EXISTS "releases_select" ON releases FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "releases_insert" ON releases FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "releases_update" ON releases FOR UPDATE USING (true);
CREATE POLICY IF NOT EXISTS "releases_delete" ON releases FOR DELETE USING (true);

-- Settings: read + update only (no insert from client, seeded above)
CREATE POLICY IF NOT EXISTS "settings_select" ON settings FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "settings_update" ON settings FOR UPDATE USING (true);

-- Admin users
CREATE POLICY IF NOT EXISTS "admin_users_select" ON admin_users FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "admin_users_insert" ON admin_users FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "admin_users_update" ON admin_users FOR UPDATE USING (true);
CREATE POLICY IF NOT EXISTS "admin_users_delete" ON admin_users FOR DELETE USING (true);

-- Activity log
CREATE POLICY IF NOT EXISTS "log_select" ON admin_activity_log FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "log_insert" ON admin_activity_log FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "log_delete" ON admin_activity_log FOR DELETE USING (true);

-- ============================================================
-- Realtime
-- ============================================================
ALTER TABLE releases REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE releases;
  END IF;
END $$;
