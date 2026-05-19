-- ══════════════════════════════════════════════════════════════
-- iGEO Marketing AI — Supabase Schema
-- Run this in your Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════

-- Calendar items (editorial calendar)
CREATE TABLE IF NOT EXISTS calendar_items (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date        date NOT NULL,
  time        time,
  channel     text NOT NULL CHECK (channel IN ('linkedin','instagram','facebook','x','blog','email','newsletter')),
  format      text,
  campaign    text,
  topic       text NOT NULL,
  message_key text,
  cta         text,
  market      text NOT NULL DEFAULT 'spain' CHECK (market IN ('spain','latam','uk','france','italy','portugal','brasil')),
  status      text NOT NULL DEFAULT 'scheduled',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Content pipeline items
CREATE TABLE IF NOT EXISTS content_items (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  calendar_item_id  uuid REFERENCES calendar_items(id) ON DELETE SET NULL,
  stage             text NOT NULL CHECK (stage IN ('ideas','copy','design','scheduled','published','analyzed')),
  title             text NOT NULL,
  channel           text NOT NULL,
  market            text NOT NULL DEFAULT 'spain',
  campaign          text,
  content           text,
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','approved','rejected')),
  ai_generated      boolean DEFAULT false,
  clarity_pass      boolean,
  clarity_summary   text,
  human_approved    boolean DEFAULT false,
  approved_by       text,
  approved_at       timestamptz,
  scheduled_at      timestamptz,
  published_at      timestamptz,
  postiz_id         text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- Content assets (images/files)
CREATE TABLE IF NOT EXISTS content_assets (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  content_item_id  uuid REFERENCES content_items(id) ON DELETE CASCADE,
  storage_path     text NOT NULL,
  asset_type       text DEFAULT 'image',
  prompt           text,
  approved         boolean DEFAULT false,
  created_at       timestamptz DEFAULT now()
);

-- Ideas pipeline
CREATE TABLE IF NOT EXISTS ideas (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title       text NOT NULL,
  description text,
  channel     text,
  market      text NOT NULL DEFAULT 'spain',
  source      text NOT NULL DEFAULT 'human' CHECK (source IN ('human','ai')),
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','converted')),
  created_at  timestamptz DEFAULT now()
);

-- Analytics snapshots (7-day post-publish evaluation)
CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  content_item_id  uuid REFERENCES content_items(id) ON DELETE CASCADE,
  snapshot_date    date NOT NULL,
  likes            int DEFAULT 0,
  comments         int DEFAULT 0,
  shares           int DEFAULT 0,
  reach            int DEFAULT 0,
  impressions      int DEFAULT 0,
  clicks           int DEFAULT 0,
  raw_data         jsonb,
  ai_evaluation    text,
  created_at       timestamptz DEFAULT now()
);

-- Brand context (market-aware brand files)
CREATE TABLE IF NOT EXISTS brand_context (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key        text NOT NULL,
  content    text NOT NULL,
  market     text NOT NULL DEFAULT 'spain',
  updated_at timestamptz DEFAULT now(),
  UNIQUE(key, market)
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calendar_items_updated_at BEFORE UPDATE ON calendar_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_content_items_updated_at  BEFORE UPDATE ON content_items  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS: enable row-level security
ALTER TABLE calendar_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_assets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ideas                ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_context       ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can read/write everything (team-only app)
CREATE POLICY "authenticated_all" ON calendar_items      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON content_items       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON content_assets      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON ideas                FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON analytics_snapshots FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON brand_context       FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Storage bucket for content assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('content-assets', 'content-assets', false)
ON CONFLICT DO NOTHING;
