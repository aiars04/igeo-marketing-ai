-- ══════════════════════════════════════════════════════════════
-- 005_content_assets_carousel.sql
-- Soporte para carruseles: agrupa N content_assets bajo un mismo
-- carousel_id con position 0..N-1. carousel_id NULL = imagen suelta.
-- Aplicado en Supabase project zgwikjijvckekmniuqzg el 2026-06-03
-- ══════════════════════════════════════════════════════════════

-- ── 1) Columnas nuevas ───────────────────────────────────────────
alter table public.content_assets
  add column if not exists carousel_id uuid,
  add column if not exists position    int;

-- ── 2) Índices ────────────────────────────────────────────────────
create index if not exists idx_content_assets_carousel_id
  on public.content_assets(carousel_id)
  where carousel_id is not null;

create unique index if not exists idx_content_assets_carousel_position
  on public.content_assets(carousel_id, position)
  where carousel_id is not null;

-- ── 3) Documentación ──────────────────────────────────────────────
comment on column public.content_assets.carousel_id is
  'UUID que agrupa N assets como carrusel. NULL = imagen individual. Todos los assets con el mismo carousel_id forman un grupo ordenado por position.';
comment on column public.content_assets.position is
  'Orden 0..N-1 dentro del carrusel. NULL si la imagen no es parte de un carrusel.';
