-- ─────────────────────────────────────────────────────────────────────────
-- Migración 016: Sistema de sugerencias / mejoras
--
-- Tabla improvements: cualquier usuario activo puede crear sugerencias
-- (bug / mejora / idea) con captura obligatoria. Solo admin/manager las
-- gestionan desde /admin → Sugerencias. Las capturas viven en el bucket
-- 'improvements' de Supabase Storage.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.improvements (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  description         text not null default '',
  attachment_url      text not null,
    -- Captura obligatoria. URL pública del bucket 'improvements'.
  type                text not null default 'mejora',
    -- 'bug' | 'mejora' | 'idea'
  priority            text not null default 'media',
    -- 'baja' | 'media' | 'alta'
  status              text not null default 'pendiente',
    -- 'pendiente' | 'revisada' | 'completada' | 'descartada'
  created_by          uuid references public.profiles(id) on delete set null,
  created_by_email    text,
  created_by_name     text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_improvements_status     on public.improvements(status);
create index if not exists idx_improvements_type       on public.improvements(type);
create index if not exists idx_improvements_priority   on public.improvements(priority);
create index if not exists idx_improvements_created_at on public.improvements(created_at desc);

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.improvements enable row level security;

-- Lectura: solo admin/manager (la app expone esto vía endpoint server)
drop policy if exists improvements_select on public.improvements;
create policy improvements_select on public.improvements for select
  using (public.is_admin_or_manager());

-- Inserción: cualquier usuario activo
drop policy if exists improvements_insert on public.improvements;
create policy improvements_insert on public.improvements for insert
  with check (public.is_active_user());

-- Update: solo admin/manager
drop policy if exists improvements_update on public.improvements;
create policy improvements_update on public.improvements for update
  using (public.is_admin_or_manager());

-- Delete: solo admin
drop policy if exists improvements_delete on public.improvements;
create policy improvements_delete on public.improvements for delete
  using (public.is_admin());

-- Trigger updated_at (reutiliza helper de migración 013)
drop trigger if exists trg_improvements_updated_at on public.improvements;
create trigger trg_improvements_updated_at
  before update on public.improvements
  for each row execute function public.set_updated_at_generic();

-- ╔═════════════════════════════════════════════════════════════════════╗
-- ║ STORAGE BUCKET 'improvements'                                      ║
-- ║ ──────────────────────────────────────────────────────────────────  ║
-- ║ Hay que crearlo desde Supabase Dashboard → Storage → New bucket:   ║
-- ║   - Nombre: improvements                                            ║
-- ║   - Public: true                                                    ║
-- ║   - File size limit: 50 MB                                          ║
-- ║   - Allowed MIME: image/*, video/*                                  ║
-- ╚═════════════════════════════════════════════════════════════════════╝

-- ── Verificación ──
select to_regclass('public.improvements')::text as tabla_creada;
