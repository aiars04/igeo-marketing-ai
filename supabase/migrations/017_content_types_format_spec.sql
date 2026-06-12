-- ─────────────────────────────────────────────────────────────────────────
-- Migración 017: format_spec en content_types
--
-- Añade una columna JSONB 'format_spec' a content_types para definir
-- estructuradamente los assets que necesita cada formato:
--   - needs_copy / needs_script: booleanos
--   - images: lista de {label, width, height, required}
--   - carousel: opcional { min, max, width, height }
--
-- Dimensiones SUGERIDAS — no se valida obligatoriedad en BD ni endpoint.
-- Se inyectan en el prompt de Gemini y se muestran como checklist en
-- el ImageDrivePanel del pipeline.
--
-- Los content_types existentes mantienen format_spec = '{}'::jsonb
-- (sin defaults), conforme decisión del usuario.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.content_types
  add column if not exists format_spec jsonb not null default '{}'::jsonb;

-- Garantiza que format_spec siempre sea un objeto JSON (no array, no escalar).
-- Permite vacío {} y cualquier estructura interna.
alter table public.content_types
  drop constraint if exists content_types_format_spec_is_object;
alter table public.content_types
  add constraint content_types_format_spec_is_object
  check (jsonb_typeof(format_spec) = 'object');

-- Índice GIN para queries futuras tipo "qué content_types necesitan banner".
-- Opcional pero barato — útil cuando se filtra por estructura interna.
create index if not exists idx_content_types_format_spec
  on public.content_types using gin (format_spec);

-- ── Verificación ──
select
  count(*)                                       as total_content_types,
  count(*) filter (where format_spec = '{}')     as con_spec_vacia,
  count(*) filter (where format_spec != '{}')    as con_spec_configurada
from public.content_types;
