-- ─────────────────────────────────────────────────────────────────────────
-- Migración 018: Añadir stage 'approval' al pipeline
--
-- Inserta una nueva etapa "Aprobación" entre 'design' y 'scheduled':
--   ideas → copy → design → approval → scheduled → analyzed
--
-- Razón: separar claramente la fase de validación humana del resto del
-- ciclo. Las cards en ideas/copy/design solo se mueven adelante (sin
-- marcar human_approved). En 'approval' es donde se aprueba o rechaza
-- formalmente. Sugerencia de Ramon Salazar (ID e6f0b53f).
--
-- Items YA existentes en 'scheduled' o 'analyzed' NO se migran a
-- 'approval' — se quedan donde están por compatibilidad histórica.
-- ─────────────────────────────────────────────────────────────────────────

-- 1) Drop del CHECK constraint actual (creado en migraciones previas)
alter table public.content_items
  drop constraint if exists content_items_stage_check;

-- 2) Nuevo CHECK con los 6 stages oficiales + 'published' como legacy
--    ('published' no se emite desde código nuevo pero puede existir en
--     filas históricas; lo mantenemos para no romper datos antiguos)
alter table public.content_items
  add constraint content_items_stage_check
  check (stage in (
    'ideas',
    'copy',
    'design',
    'approval',
    'scheduled',
    'analyzed',
    'published'
  ));

-- ── Verificación ──
select
  count(*)                                       as total_items,
  count(*) filter (where stage = 'approval')     as en_approval
from public.content_items;
