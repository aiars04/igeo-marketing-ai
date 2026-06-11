-- ─────────────────────────────────────────────────────────────────────────
-- Migración 015: Fase 3 — Research & SEO Intelligence
--
-- 3 tablas para soportar:
--   - seo_research_sessions: agrupa investigaciones (tema + mercado)
--   - seo_keywords: keywords descubiertas en cada sesión (con intent, volumen, etc.)
--   - seo_briefs: briefs SEO generados (pueden convertirse en content_items)
--
-- Inicialmente alimentado por Gemini. Más adelante puede conectarse a
-- SerpAPI / DataForSEO / Google Search Console.
-- ─────────────────────────────────────────────────────────────────────────

-- ╔═════════════════════════════════════════════════════════════════════╗
-- ║ 1. seo_research_sessions                                           ║
-- ╚═════════════════════════════════════════════════════════════════════╝
create table if not exists public.seo_research_sessions (
  id          uuid primary key default gen_random_uuid(),
  topic       text not null,
    -- Tema base de la investigación: "control de plagas", "legionella", etc.
  market      text not null default 'spain',
  channel     text,
    -- Canal objetivo opcional (blog, newsletter, ...)
  notes       text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_seo_sessions_market on public.seo_research_sessions(market);
create index if not exists idx_seo_sessions_created_at on public.seo_research_sessions(created_at desc);


-- ╔═════════════════════════════════════════════════════════════════════╗
-- ║ 2. seo_keywords                                                    ║
-- ╚═════════════════════════════════════════════════════════════════════╝
create table if not exists public.seo_keywords (
  id                  uuid primary key default gen_random_uuid(),
  research_session_id uuid not null references public.seo_research_sessions(id) on delete cascade,
  keyword             text not null,
  intent              text,
    -- 'informational' | 'commercial' | 'transactional' | 'navigational'
  estimated_volume    text,
    -- 'high' | 'medium' | 'low' (estimación cualitativa)
  difficulty          text,
    -- 'high' | 'medium' | 'low'
  suggested_format    text,
    -- 'blog' | 'landing' | 'video' | 'guide' | 'comparison' | ...
  notes               text,
  created_at          timestamptz not null default now()
);

create index if not exists idx_seo_keywords_session on public.seo_keywords(research_session_id);
create index if not exists idx_seo_keywords_intent  on public.seo_keywords(intent);


-- ╔═════════════════════════════════════════════════════════════════════╗
-- ║ 3. seo_briefs                                                      ║
-- ╚═════════════════════════════════════════════════════════════════════╝
create table if not exists public.seo_briefs (
  id                       uuid primary key default gen_random_uuid(),
  title                    text not null,
  primary_keyword          text not null,
  secondary_keywords       text[] not null default '{}',
  market                   text not null default 'spain',
  channel                  text,
  intent                   text,
  target_length            integer,
    -- Longitud objetivo en palabras
  suggested_h2             text[] not null default '{}',
    -- Estructura sugerida (H2s del artículo)
  cta                      text,
  content_outline          text,
    -- Outline completo en markdown
  research_session_id      uuid references public.seo_research_sessions(id) on delete set null,
  related_content_item_id  uuid references public.content_items(id) on delete set null,
    -- Si ya se convirtió a content_item, queda el link
  status                   text not null default 'draft',
    -- 'draft' | 'approved' | 'converted' | 'archived'
  created_by               uuid references public.profiles(id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists idx_seo_briefs_status      on public.seo_briefs(status);
create index if not exists idx_seo_briefs_market      on public.seo_briefs(market);
create index if not exists idx_seo_briefs_session     on public.seo_briefs(research_session_id);
create index if not exists idx_seo_briefs_created_at  on public.seo_briefs(created_at desc);


-- ╔═════════════════════════════════════════════════════════════════════╗
-- ║ RLS — usa los helpers de migración 013 (is_active_user, etc.)      ║
-- ╚═════════════════════════════════════════════════════════════════════╝

-- seo_research_sessions
alter table public.seo_research_sessions enable row level security;

drop policy if exists seo_sessions_select on public.seo_research_sessions;
create policy seo_sessions_select on public.seo_research_sessions for select
  using (public.is_active_user());

drop policy if exists seo_sessions_insert on public.seo_research_sessions;
create policy seo_sessions_insert on public.seo_research_sessions for insert
  with check (public.is_active_user());

drop policy if exists seo_sessions_update on public.seo_research_sessions;
create policy seo_sessions_update on public.seo_research_sessions for update
  using (created_by = auth.uid() or public.is_admin_or_manager());

drop policy if exists seo_sessions_delete on public.seo_research_sessions;
create policy seo_sessions_delete on public.seo_research_sessions for delete
  using (created_by = auth.uid() or public.is_admin());


-- seo_keywords
alter table public.seo_keywords enable row level security;

drop policy if exists seo_keywords_select on public.seo_keywords;
create policy seo_keywords_select on public.seo_keywords for select
  using (public.is_active_user());

drop policy if exists seo_keywords_insert on public.seo_keywords;
create policy seo_keywords_insert on public.seo_keywords for insert
  with check (public.is_active_user());

drop policy if exists seo_keywords_update on public.seo_keywords;
create policy seo_keywords_update on public.seo_keywords for update
  using (public.is_active_user());

drop policy if exists seo_keywords_delete on public.seo_keywords;
create policy seo_keywords_delete on public.seo_keywords for delete
  using (public.is_active_user());


-- seo_briefs
alter table public.seo_briefs enable row level security;

drop policy if exists seo_briefs_select on public.seo_briefs;
create policy seo_briefs_select on public.seo_briefs for select
  using (public.is_active_user());

drop policy if exists seo_briefs_insert on public.seo_briefs;
create policy seo_briefs_insert on public.seo_briefs for insert
  with check (public.is_active_user());

drop policy if exists seo_briefs_update on public.seo_briefs;
create policy seo_briefs_update on public.seo_briefs for update
  using (created_by = auth.uid() or public.is_admin_or_manager());

drop policy if exists seo_briefs_delete on public.seo_briefs;
create policy seo_briefs_delete on public.seo_briefs for delete
  using (created_by = auth.uid() or public.is_admin());


-- ╔═════════════════════════════════════════════════════════════════════╗
-- ║ TRIGGERS updated_at                                                ║
-- ╚═════════════════════════════════════════════════════════════════════╝
-- Reutiliza la función set_updated_at_generic() de la migración 013

drop trigger if exists trg_seo_sessions_updated_at on public.seo_research_sessions;
create trigger trg_seo_sessions_updated_at
  before update on public.seo_research_sessions
  for each row execute function public.set_updated_at_generic();

drop trigger if exists trg_seo_briefs_updated_at on public.seo_briefs;
create trigger trg_seo_briefs_updated_at
  before update on public.seo_briefs
  for each row execute function public.set_updated_at_generic();


-- ╔═════════════════════════════════════════════════════════════════════╗
-- ║ VERIFICACIÓN                                                       ║
-- ╚═════════════════════════════════════════════════════════════════════╝
select
  to_regclass('public.seo_research_sessions')::text as seo_research_sessions,
  to_regclass('public.seo_keywords')::text          as seo_keywords,
  to_regclass('public.seo_briefs')::text            as seo_briefs;
