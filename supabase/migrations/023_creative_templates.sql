-- ─────────────────────────────────────────────────────────────────────────
-- Migración 023: Creativos digitales (Fase 1 — catálogo).
--
-- Plantillas maestras de identidad visual asociadas a uno o varios canales y
-- (opcionalmente) a uno o varios content_types. Sirven de referencia visual
-- a la hora de generar contenido (Fase 2 — integración con Nano Banana).
--
-- Decisiones:
--   - asset_role es text libre ("banner", "thumbnail", "cover", lo que el user
--     quiera). Sin enum para no ahogar futuros usos.
--   - Una plantilla pertenece a un único canal (1:1) — los archivos son
--     visualmente distintos entre LinkedIn e Instagram, así que multiplexar
--     canales en una misma fila no aporta y complica las queries.
--   - Vinculación a content_types via tabla pivote M:N — la misma plantilla
--     puede aplicar a varios tipos del mismo canal. Si no hay filas pivote,
--     se interpreta como "aplica a TODOS los content_types del canal".
--   - market opcional. NULL = aplica a todos los mercados.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.creative_templates (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  description     text,
  channel         text not null,
    -- Canal al que pertenece. Validado a nivel API contra el enum Channel.
  market          text,
    -- NULL = aplica a todos los mercados. Si está set, debe ser un Market válido.
  asset_role      text not null default 'banner',
    -- Vocabulario libre: "banner", "thumbnail", "cover", "background", etc.
  storage_path    text not null,
    -- Ruta en bucket 'content-assets', prefijo 'templates/<channel>/...'
  mime_type       text not null,
  width           integer,
  height          integer,
  aspect_ratio    text,
    -- "1:1", "16:9", "9:16", "4:5", "free". Se calcula al subir.
  file_size       integer,
    -- bytes
  notes           text,
    -- Guía libre para humanos y para el prompt de la IA:
    -- "respetar paleta corporativa, mantener el logo en abajo-derecha".
  active          boolean not null default true,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_creative_templates_channel    on public.creative_templates(channel);
create index if not exists idx_creative_templates_market     on public.creative_templates(market);
create index if not exists idx_creative_templates_active     on public.creative_templates(active);
create index if not exists idx_creative_templates_created_at on public.creative_templates(created_at desc);

-- ── Tabla pivote: M:N con content_types ───────────────────────────────────
create table if not exists public.creative_template_content_types (
  template_id     uuid not null references public.creative_templates(id) on delete cascade,
  content_type_id uuid not null references public.content_types(id)      on delete cascade,
  primary key (template_id, content_type_id)
);

create index if not exists idx_ctct_template     on public.creative_template_content_types(template_id);
create index if not exists idx_ctct_content_type on public.creative_template_content_types(content_type_id);

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.creative_templates                  enable row level security;
alter table public.creative_template_content_types     enable row level security;

-- Lectura: cualquier usuario activo (el catálogo es compartido).
drop policy if exists creative_templates_select on public.creative_templates;
create policy creative_templates_select on public.creative_templates for select
  using (public.is_active_user());

-- Inserción / Update / Delete: admin/manager (mismo nivel que content_types,
-- playbooks, mentions). Manager debe poder gestionar el catálogo completo.
drop policy if exists creative_templates_insert on public.creative_templates;
create policy creative_templates_insert on public.creative_templates for insert
  with check (public.is_admin_or_manager());

drop policy if exists creative_templates_update on public.creative_templates;
create policy creative_templates_update on public.creative_templates for update
  using (public.is_admin_or_manager());

drop policy if exists creative_templates_delete on public.creative_templates;
create policy creative_templates_delete on public.creative_templates for delete
  using (public.is_admin_or_manager());

-- Pivote: mismas políticas (lectura abierta a authenticated, escritura priv).
drop policy if exists ctct_select on public.creative_template_content_types;
create policy ctct_select on public.creative_template_content_types for select
  using (public.is_active_user());

drop policy if exists ctct_insert on public.creative_template_content_types;
create policy ctct_insert on public.creative_template_content_types for insert
  with check (public.is_admin_or_manager());

drop policy if exists ctct_delete on public.creative_template_content_types;
create policy ctct_delete on public.creative_template_content_types for delete
  using (public.is_admin_or_manager());

-- ── Trigger updated_at ────────────────────────────────────────────────────
drop trigger if exists trg_creative_templates_updated_at on public.creative_templates;
create trigger trg_creative_templates_updated_at
  before update on public.creative_templates
  for each row execute function public.set_updated_at_generic();

-- ── Verificación ──
select to_regclass('public.creative_templates')::text             as templates_table,
       to_regclass('public.creative_template_content_types')::text as pivot_table;
