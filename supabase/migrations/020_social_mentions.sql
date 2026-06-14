-- ─────────────────────────────────────────────────────────────────────────
-- Migración 020: Repositorio de menciones sociales
--
-- Sugerencia 10 — guardar perfiles de clientes / partners / influencers por
-- red social para poder mencionarlos al redactar posts. Cada entrada tiene
-- un display name y un objeto JSON con su handle por canal.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.social_mentions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  -- {linkedin: "https://...", instagram: "@user", x: "@user", facebook: "...", blog: "...", email: "...", newsletter: "..."}
  -- Aceptamos URL o handle textual indistintamente; la app normaliza al insertar.
  handles     jsonb not null default '{}'::jsonb,
  tags        text[] not null default '{}',
  active      boolean not null default true,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_social_mentions_active     on public.social_mentions(active);
create index if not exists idx_social_mentions_created_at on public.social_mentions(created_at desc);
create index if not exists idx_social_mentions_name_trgm  on public.social_mentions using gin (name gin_trgm_ops);

-- pg_trgm puede no estar habilitado; lo activamos por si acaso (idempotente).
create extension if not exists pg_trgm;

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.social_mentions enable row level security;

-- Lectura: cualquier usuario activo (el repositorio es compartido)
drop policy if exists social_mentions_select on public.social_mentions;
create policy social_mentions_select on public.social_mentions for select
  using (public.is_active_user());

-- Inserción: admin/manager
drop policy if exists social_mentions_insert on public.social_mentions;
create policy social_mentions_insert on public.social_mentions for insert
  with check (public.is_admin_or_manager());

-- Update: admin/manager
drop policy if exists social_mentions_update on public.social_mentions;
create policy social_mentions_update on public.social_mentions for update
  using (public.is_admin_or_manager());

-- Delete: solo admin
drop policy if exists social_mentions_delete on public.social_mentions;
create policy social_mentions_delete on public.social_mentions for delete
  using (public.is_admin());

-- Trigger updated_at (reutiliza helper de migración 013)
drop trigger if exists trg_social_mentions_updated_at on public.social_mentions;
create trigger trg_social_mentions_updated_at
  before update on public.social_mentions
  for each row execute function public.set_updated_at_generic();

-- ── Verificación ──
select to_regclass('public.social_mentions')::text as tabla_creada;
