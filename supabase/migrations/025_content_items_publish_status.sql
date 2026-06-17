-- 025_content_items_publish_status.sql
-- Estado de publicación real (vs lo que pidió el usuario):
--   publish_state — null | 'queued' | 'published' | 'failed'
--   publish_error — texto del último error de Postiz/red social (si failed)
--   publish_synced_at — última vez que el cron consultó el estado en Postiz
--
-- Esto permite al cron de sync (cada 15 min) actualizar el estado sin pisar
-- otros campos (status, scheduled_at). El frontend lo usa para mostrar
-- estado real "Publicado" / "Falló en LinkedIn (token caducado)" / etc.

alter table public.content_items
  add column if not exists publish_state text,
  add column if not exists publish_error text,
  add column if not exists publish_synced_at timestamptz;

alter table public.content_items
  drop constraint if exists content_items_publish_state_check;
alter table public.content_items
  add constraint content_items_publish_state_check
  check (publish_state is null or publish_state in ('queued', 'published', 'failed'));

create index if not exists idx_content_items_publish_state
  on public.content_items(publish_state)
  where publish_state is not null;

comment on column public.content_items.publish_state is
  'Estado real reportado por Postiz tras intentar publicar. null = nunca se envió, queued = programado pendiente, published = publicado OK, failed = la red social rechazó.';
comment on column public.content_items.publish_error is
  'Mensaje de error del último intento si publish_state = failed.';
comment on column public.content_items.publish_synced_at is
  'Última vez que el cron sincronizó el estado con Postiz.';
