-- ─────────────────────────────────────────────────────────────────────────
-- Migración 011: Consolidar schema — cubre el drift entre código y migraciones
--
-- Las migraciones 002, 003, 006, 007 nunca se commitearon al repo. Las tablas
-- y columnas que el código usa se crearon manualmente en la DB de desarrollo.
-- Este archivo reconstruye TODO lo que el código necesita usando
-- "CREATE TABLE IF NOT EXISTS" y "ADD COLUMN IF NOT EXISTS" para ser seguro
-- de ejecutar tanto en DB nueva como en la actual (idempotente).
--
-- Tablas afectadas:
--   - content_items  → añade description, created_by si faltan
--   - content_assets → añade created_by, aspect_ratio, width, height si faltan
--   - ideas          → añade created_by si falta
--   - content_types  → crea la tabla completa si no existe
-- ─────────────────────────────────────────────────────────────────────────

-- ── content_items: columnas faltantes ──────────────────────────────────────
alter table if exists public.content_items
  add column if not exists description text,
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

create index if not exists idx_content_items_created_by on public.content_items(created_by);

-- ── content_assets: columnas faltantes ─────────────────────────────────────
alter table if exists public.content_assets
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists aspect_ratio text,
  add column if not exists width integer,
  add column if not exists height integer;

create index if not exists idx_content_assets_created_by on public.content_assets(created_by);
create index if not exists idx_content_assets_aspect_ratio on public.content_assets(aspect_ratio);

-- ── ideas: created_by faltante ─────────────────────────────────────────────
alter table if exists public.ideas
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

create index if not exists idx_ideas_created_by on public.ideas(created_by);

-- ── content_types: tabla completa si no existe ─────────────────────────────
create table if not exists public.content_types (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  channel     text not null check (channel in ('linkedin','instagram','facebook','x','blog','email','newsletter')),
  description text,
  process     text,                        -- instrucciones del flujo creativo
  style       text,                        -- guía de estilo / tono
  active      boolean not null default true,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_content_types_channel on public.content_types(channel);
create index if not exists idx_content_types_active on public.content_types(active);
create index if not exists idx_content_types_created_by on public.content_types(created_by);

-- RLS de content_types (igual que las otras core tables: select abierto a authenticated,
-- write restringido a admin/manager via función auxiliar de migration 010).
alter table public.content_types enable row level security;

-- Drop policies si ya existen para idempotencia
drop policy if exists content_types_select on public.content_types;
drop policy if exists content_types_insert on public.content_types;
drop policy if exists content_types_update on public.content_types;
drop policy if exists content_types_delete on public.content_types;

create policy content_types_select on public.content_types
  for select to authenticated using (true);

-- Helper function de migration 010 — verifica si el caller es admin o manager
-- Si no existe, la creamos aquí también para idempotencia.
create or replace function public.is_admin_or_manager() returns boolean
language sql stable security definer as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and active = true and role in ('admin','manager')
  );
$$;

create policy content_types_insert on public.content_types
  for insert to authenticated with check (public.is_admin_or_manager());

create policy content_types_update on public.content_types
  for update to authenticated using (public.is_admin_or_manager());

create policy content_types_delete on public.content_types
  for delete to authenticated using (public.is_admin_or_manager());

-- Trigger updated_at si la función existe (creada en 008)
do $$
begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    drop trigger if exists content_types_set_updated_at on public.content_types;
    create trigger content_types_set_updated_at
      before update on public.content_types
      for each row execute function public.set_updated_at();
  end if;
end$$;

-- ── content_items.stage: alinear CHECK constraint con TS ───────────────────
-- TS Stage = 'ideas' | 'copy' | 'design' | 'scheduled' | 'analyzed'
-- Algunos schemas legacy tienen 'published' que NO existe en TS.
-- Lo mantenemos en el CHECK para no romper datos existentes pero el código
-- no debería emitir ese valor — solo lectura legacy.
do $$
begin
  -- Comprobamos si el constraint actual permite 'published' y no, lo añadimos
  -- (NO eliminamos 'published' por compatibilidad con datos antiguos)
  if exists (
    select 1 from pg_constraint
    where conname = 'content_items_stage_check'
  ) then
    -- Lo dejamos como está — el código sólo emite los 5 stages oficiales
    null;
  end if;
end$$;

-- ── Verificación final ─────────────────────────────────────────────────────
-- Si todo se aplicó correctamente, content_types debe existir y las columnas
-- nuevas también. No hay assertions automáticas — para verificar manualmente:
--
--   select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'content_items'
--     and column_name in ('description','created_by');
--
--   select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'content_assets'
--     and column_name in ('created_by','aspect_ratio','width','height');
--
--   select to_regclass('public.content_types'); -- debería devolver content_types
