-- ============================================================
-- In Lights — MIGRATIONS ONLY
-- ✅ 100% SAFE to run on an existing database with live data.
-- Only adds new columns/tables — never drops, never truncates.
-- Run this whenever you pull a new version of the project.
-- ============================================================

-- releases: new columns added over time
ALTER TABLE releases ADD COLUMN IF NOT EXISTS cover_art_image_url  TEXT;
ALTER TABLE releases ADD COLUMN IF NOT EXISTS upc                  TEXT;
ALTER TABLE releases ADD COLUMN IF NOT EXISTS priority             TEXT DEFAULT 'normal'
  CHECK (priority IN ('urgent', 'normal', 'low'));
ALTER TABLE releases ADD COLUMN IF NOT EXISTS checklist            JSONB DEFAULT '[]';

-- settings: all columns ever added
ALTER TABLE settings ADD COLUMN IF NOT EXISTS accent_color                  TEXT    DEFAULT '#7c3aed';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS submission_success_message    TEXT    DEFAULT 'Your submission has been received and is under review.';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS rights_agreement_text         TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS require_drive_folder          BOOLEAN DEFAULT false;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS require_promo_materials       BOOLEAN DEFAULT false;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS require_lyrics                BOOLEAN DEFAULT false;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS require_mix_master            BOOLEAN DEFAULT false;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS require_cover_art_specs       BOOLEAN DEFAULT false;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS require_credits               BOOLEAN DEFAULT false;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS min_release_days_notice       INTEGER DEFAULT 7;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS max_tracks_album              INTEGER DEFAULT 32;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS max_collaborators             INTEGER DEFAULT 0;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS max_features                  INTEGER DEFAULT 0;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS allowed_release_types         TEXT    DEFAULT 'single,ep,album';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS custom_genres                 TEXT    DEFAULT '';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS status_label_pending          TEXT    DEFAULT 'Pending';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS status_label_approved         TEXT    DEFAULT 'Approved';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS status_label_scheduled        TEXT    DEFAULT 'Scheduled';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS status_label_released         TEXT    DEFAULT 'Released';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS status_label_rejected         TEXT    DEFAULT 'Rejected';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS submission_cooldown_hours     INTEGER DEFAULT 0;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS maintenance_mode              BOOLEAN DEFAULT false;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS maintenance_mode_message      TEXT    DEFAULT 'The submission portal is temporarily unavailable.';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS auto_approve_after_days       INTEGER DEFAULT 0;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS form_accent_button_label      TEXT    DEFAULT 'Continue';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS drive_picker_enabled          BOOLEAN DEFAULT false;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS google_api_client_id          TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS google_api_key                TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS drive_upload_folder_id        TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS allow_cover_art_image_url     BOOLEAN DEFAULT true;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS show_artwork_preview          BOOLEAN DEFAULT true;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS require_tiktok_timestamp      BOOLEAN DEFAULT false;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS form_footer_text              TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS label_email                   TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS label_instagram               TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS label_website                 TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS admin_username                TEXT    DEFAULT 'admin';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS admin_password_hash           TEXT    DEFAULT '0a15557faae3b031ade95b1608480a5f73594f6f559e10bcfc93302f1f26c579';

-- Ensure the default password hash is set if null
UPDATE settings
SET admin_password_hash = '0a15557faae3b031ade95b1608480a5f73594f6f559e10bcfc93302f1f26c579'
WHERE admin_password_hash IS NULL;

-- admin_users table (new)
CREATE TABLE IF NOT EXISTS admin_users (
  id            UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT  NOT NULL UNIQUE,
  password_hash TEXT  NOT NULL,
  role          TEXT  NOT NULL DEFAULT 'reviewer' CHECK (role IN ('owner', 'admin', 'reviewer')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  last_login    TIMESTAMPTZ
);

-- activity log table (new)
CREATE TABLE IF NOT EXISTS admin_activity_log (
  id             UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  admin_username TEXT  NOT NULL,
  admin_role     TEXT,
  action         TEXT  NOT NULL,
  entity_type    TEXT  NOT NULL DEFAULT 'release',
  entity_id      TEXT,
  entity_label   TEXT,
  meta           JSONB DEFAULT '{}'
);

-- RLS for new tables (safe to re-run, IF NOT EXISTS on policies)
ALTER TABLE admin_users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_activity_log  ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='admin_users' AND policyname='admin_users_select') THEN
    CREATE POLICY "admin_users_select" ON admin_users FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='admin_users' AND policyname='admin_users_insert') THEN
    CREATE POLICY "admin_users_insert" ON admin_users FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='admin_users' AND policyname='admin_users_update') THEN
    CREATE POLICY "admin_users_update" ON admin_users FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='admin_users' AND policyname='admin_users_delete') THEN
    CREATE POLICY "admin_users_delete" ON admin_users FOR DELETE USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='admin_activity_log' AND policyname='log_select') THEN
    CREATE POLICY "log_select" ON admin_activity_log FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='admin_activity_log' AND policyname='log_insert') THEN
    CREATE POLICY "log_insert" ON admin_activity_log FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='admin_activity_log' AND policyname='log_delete') THEN
    CREATE POLICY "log_delete" ON admin_activity_log FOR DELETE USING (true);
  END IF;
END $$;

-- Realtime
ALTER TABLE releases REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE releases;
  END IF;
END $$;

-- v13: Email notifications + artist email
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS resend_api_key TEXT,
  ADD COLUMN IF NOT EXISTS email_from_name TEXT,
  ADD COLUMN IF NOT EXISTS email_from_address TEXT,
  ADD COLUMN IF NOT EXISTS email_notify_on_submission BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_notify_artist_on_status BOOLEAN DEFAULT false;

ALTER TABLE releases
  ADD COLUMN IF NOT EXISTS artist_email TEXT;
