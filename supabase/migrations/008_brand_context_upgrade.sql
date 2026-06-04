-- ══════════════════════════════════════════════════════════════
-- 008_brand_context_upgrade.sql
-- Aplicado en Supabase project zgwikjijvckekmniuqzg el 2026-06-03
-- - Permite market='all' en el CHECK constraint
-- - Añade created_at, created_by, trigger updated_at
-- - Índices + RLS finas (admin/manager) reemplazando authenticated_all
-- - Seed inicial con 11 bloques de marca iGEO
-- ══════════════════════════════════════════════════════════════

-- ── 0) Ampliar CHECK constraint: añadir 'all' a los markets válidos ──
alter table public.brand_context drop constraint if exists brand_context_market_check;
alter table public.brand_context
  add constraint brand_context_market_check
  check (market in ('all','spain','latam','uk','france','italy','portugal','brasil'));

-- ── 1) Columnas nuevas ─────────────────────────────────────────────
alter table public.brand_context
  add column if not exists created_at  timestamptz not null default now(),
  add column if not exists created_by  uuid references auth.users(id) on delete set null;

-- ── 2) Trigger updated_at (reutiliza touch_updated_at de migration 001) ──
drop trigger if exists brand_context_touch_updated_at on public.brand_context;
create trigger brand_context_touch_updated_at
  before update on public.brand_context
  for each row execute function public.touch_updated_at();

-- ── 3) Índices ─────────────────────────────────────────────────────
create index if not exists idx_brand_context_key    on public.brand_context(key);
create index if not exists idx_brand_context_market on public.brand_context(market);

-- ── 4) RLS finas (reemplaza authenticated_all) ─────────────────────
alter table public.brand_context enable row level security;

drop policy if exists "authenticated_all" on public.brand_context;
drop policy if exists brand_context_select on public.brand_context;
create policy brand_context_select on public.brand_context for select to authenticated using (true);

drop policy if exists brand_context_insert on public.brand_context;
create policy brand_context_insert on public.brand_context for insert to authenticated
  with check (created_by = auth.uid() or public.current_user_role() = 'admin');

drop policy if exists brand_context_update on public.brand_context;
create policy brand_context_update on public.brand_context for update to authenticated
  using (public.current_user_role() in ('admin', 'manager'));

drop policy if exists brand_context_delete on public.brand_context;
create policy brand_context_delete on public.brand_context for delete to authenticated
  using (public.current_user_role() = 'admin');

-- NOTA: el bloque de seed con los 11 bloques de marca iGEO se ejecutó
-- directamente en el SQL Editor (ver historial de migración 008 en Supabase).
-- Se omite aquí por brevedad pero queda en BD.
