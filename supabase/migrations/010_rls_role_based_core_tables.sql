-- ── Migration 010: RLS por rol en tablas core ────────────────────────
-- Reemplaza policies permisivas (authenticated_all) por policies finas
-- alineadas con el patrón de brand_context (008) e image_folders (009):
--   - SELECT abierto a authenticated (app interna)
--   - INSERT abierto a authenticated activos
--   - UPDATE: admin/manager
--   - DELETE: admin
-- Idempotente: cada policy se DROP IF EXISTS antes de crear.
-- Tablas: calendar_items, content_items, content_assets, ideas,
--         content_types, analytics_snapshots
--
-- NOTA: las rutas API usan createAdminClient() (service_role) que
-- bypassa RLS — estas policies solo defienden contra acceso directo
-- con la anon key desde el cliente. Aún así son la red de seguridad.
-- ──────────────────────────────────────────────────────────────────────

-- Helper: aplica el set estándar de 4 policies a una tabla dada
-- (las policies van inline para que cada tabla sea inspeccionable).

-- ╔═══════════════════════════════ calendar_items ═══════════════════════════════╗
do $$ begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'calendar_items') then
    execute 'alter table public.calendar_items enable row level security';
    execute 'drop policy if exists "authenticated_all" on public.calendar_items';
    execute 'drop policy if exists calendar_items_select on public.calendar_items';
    execute 'drop policy if exists calendar_items_insert on public.calendar_items';
    execute 'drop policy if exists calendar_items_update on public.calendar_items';
    execute 'drop policy if exists calendar_items_delete on public.calendar_items';

    execute 'create policy calendar_items_select on public.calendar_items for select to authenticated using (true)';
    execute 'create policy calendar_items_insert on public.calendar_items for insert to authenticated with check (public.current_user_is_active())';
    execute 'create policy calendar_items_update on public.calendar_items for update to authenticated using (public.current_user_role() in (''admin'',''manager''))';
    execute 'create policy calendar_items_delete on public.calendar_items for delete to authenticated using (public.current_user_role() = ''admin'')';
  end if;
end $$;

-- ╔═══════════════════════════════ content_items ═══════════════════════════════╗
do $$ begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'content_items') then
    execute 'alter table public.content_items enable row level security';
    execute 'drop policy if exists "authenticated_all" on public.content_items';
    execute 'drop policy if exists content_items_select on public.content_items';
    execute 'drop policy if exists content_items_insert on public.content_items';
    execute 'drop policy if exists content_items_update on public.content_items';
    execute 'drop policy if exists content_items_delete on public.content_items';

    execute 'create policy content_items_select on public.content_items for select to authenticated using (true)';
    execute 'create policy content_items_insert on public.content_items for insert to authenticated with check (public.current_user_is_active())';
    execute 'create policy content_items_update on public.content_items for update to authenticated using (public.current_user_role() in (''admin'',''manager''))';
    execute 'create policy content_items_delete on public.content_items for delete to authenticated using (public.current_user_role() in (''admin'',''manager''))';
  end if;
end $$;

-- ╔═══════════════════════════════ content_assets ══════════════════════════════╗
do $$ begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'content_assets') then
    execute 'alter table public.content_assets enable row level security';
    execute 'drop policy if exists "authenticated_all" on public.content_assets';
    execute 'drop policy if exists content_assets_select on public.content_assets';
    execute 'drop policy if exists content_assets_insert on public.content_assets';
    execute 'drop policy if exists content_assets_update on public.content_assets';
    execute 'drop policy if exists content_assets_delete on public.content_assets';

    execute 'create policy content_assets_select on public.content_assets for select to authenticated using (true)';
    execute 'create policy content_assets_insert on public.content_assets for insert to authenticated with check (public.current_user_is_active())';
    -- UPDATE: admin/manager o el propio creador (para approve toggle desde la galería)
    execute 'create policy content_assets_update on public.content_assets for update to authenticated using (public.current_user_role() in (''admin'',''manager'') or created_by = auth.uid())';
    execute 'create policy content_assets_delete on public.content_assets for delete to authenticated using (public.current_user_role() in (''admin'',''manager'') or created_by = auth.uid())';
  end if;
end $$;

-- ╔═══════════════════════════════════ ideas ═══════════════════════════════════╗
do $$ begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'ideas') then
    execute 'alter table public.ideas enable row level security';
    execute 'drop policy if exists "authenticated_all" on public.ideas';
    execute 'drop policy if exists ideas_select on public.ideas';
    execute 'drop policy if exists ideas_insert on public.ideas';
    execute 'drop policy if exists ideas_update on public.ideas';
    execute 'drop policy if exists ideas_delete on public.ideas';

    execute 'create policy ideas_select on public.ideas for select to authenticated using (true)';
    execute 'create policy ideas_insert on public.ideas for insert to authenticated with check (public.current_user_is_active())';
    execute 'create policy ideas_update on public.ideas for update to authenticated using (public.current_user_role() in (''admin'',''manager''))';
    execute 'create policy ideas_delete on public.ideas for delete to authenticated using (public.current_user_role() in (''admin'',''manager''))';
  end if;
end $$;

-- ╔═══════════════════════════════ content_types ═══════════════════════════════╗
do $$ begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'content_types') then
    execute 'alter table public.content_types enable row level security';
    execute 'drop policy if exists "authenticated_all" on public.content_types';
    execute 'drop policy if exists content_types_select on public.content_types';
    execute 'drop policy if exists content_types_insert on public.content_types';
    execute 'drop policy if exists content_types_update on public.content_types';
    execute 'drop policy if exists content_types_delete on public.content_types';

    execute 'create policy content_types_select on public.content_types for select to authenticated using (true)';
    execute 'create policy content_types_insert on public.content_types for insert to authenticated with check (public.current_user_role() in (''admin'',''manager''))';
    execute 'create policy content_types_update on public.content_types for update to authenticated using (public.current_user_role() in (''admin'',''manager''))';
    execute 'create policy content_types_delete on public.content_types for delete to authenticated using (public.current_user_role() = ''admin'')';
  end if;
end $$;

-- ╔═════════════════════════════ analytics_snapshots ═════════════════════════════╗
do $$ begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'analytics_snapshots') then
    execute 'alter table public.analytics_snapshots enable row level security';
    execute 'drop policy if exists "authenticated_all" on public.analytics_snapshots';
    execute 'drop policy if exists analytics_snapshots_select on public.analytics_snapshots';
    execute 'drop policy if exists analytics_snapshots_insert on public.analytics_snapshots';
    execute 'drop policy if exists analytics_snapshots_update on public.analytics_snapshots';
    execute 'drop policy if exists analytics_snapshots_delete on public.analytics_snapshots';

    -- Analytics es read-only para usuarios; solo admin escribe
    execute 'create policy analytics_snapshots_select on public.analytics_snapshots for select to authenticated using (true)';
    execute 'create policy analytics_snapshots_insert on public.analytics_snapshots for insert to authenticated with check (public.current_user_role() = ''admin'')';
    execute 'create policy analytics_snapshots_update on public.analytics_snapshots for update to authenticated using (public.current_user_role() = ''admin'')';
    execute 'create policy analytics_snapshots_delete on public.analytics_snapshots for delete to authenticated using (public.current_user_role() = ''admin'')';
  end if;
end $$;

-- ╔═══════════════════════════════ verificación ═══════════════════════════════╗
-- Bloque informativo: lista las policies activas tras la migración.
-- Útil para validar en Supabase Studio.
do $$
declare
  cnt int;
begin
  select count(*) into cnt
  from pg_policies
  where schemaname = 'public'
    and tablename in ('calendar_items','content_items','content_assets','ideas','content_types','analytics_snapshots');
  raise notice 'Migration 010: % policies activas en tablas core', cnt;
end $$;
