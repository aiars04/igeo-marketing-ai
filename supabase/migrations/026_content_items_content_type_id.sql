-- 026_content_items_content_type_id.sql
-- Vincular cada content_item con su content_type específico (Post/Carrusel/
-- Stories/etc.) para que el matching de plantillas creativas sea exacto
-- en vez de adivinar "el más reciente activo del canal".
--
-- Antes: content_items solo guardaba `channel` (instagram), y el matcher
-- usaba HEURÍSTICA "último content_type activo del canal". Si el admin
-- creaba "Carrusel IG" después de "Post IG", todo iba a Carrusel aunque
-- el usuario quisiera Post.
--
-- Ahora: content_item.content_type_id apunta explícitamente al subtipo.
-- Nullable para compatibilidad con items históricos y casos donde el
-- usuario no especifique (en ese caso, el matcher cae al fallback).
--
-- ON DELETE SET NULL: si se borra un content_type, los items quedan
-- huérfanos pero NO se borran (no es destructivo).

alter table public.content_items
  add column if not exists content_type_id uuid;

alter table public.content_items
  drop constraint if exists content_items_content_type_id_fkey;
alter table public.content_items
  add constraint content_items_content_type_id_fkey
  foreign key (content_type_id) references public.content_types(id) on delete set null;

create index if not exists idx_content_items_content_type_id
  on public.content_items(content_type_id)
  where content_type_id is not null;

comment on column public.content_items.content_type_id is
  'Subtipo del canal elegido por el usuario al crear el item (FK content_types.id). NULL si no se especificó — el matcher de plantillas usa fallback "más reciente activo del canal" en ese caso.';
