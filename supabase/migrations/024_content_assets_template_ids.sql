-- ─────────────────────────────────────────────────────────────────────────
-- Migración 024: Trazabilidad plantilla → asset generado (Fase 2 creatives).
--
-- Cuando /api/images/generate inyecta plantillas maestras como referencia
-- visual para Nano Banana 2, guardamos los UUIDs de las plantillas usadas en
-- content_assets.template_ids. Sirve para auditar después qué plantillas
-- influyeron en cada imagen y para mostrar un pill "Generada con plantilla X"
-- en el panel del item.
--
-- No usamos FK ni ON DELETE CASCADE: si una plantilla se borra, los assets
-- generados con ella mantienen el ID huérfano (la UI lo trata como
-- "plantilla eliminada"). Esto es deliberado — borrar una plantilla NO debe
-- borrar el historial visual de los items que la usaron.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.content_assets
  add column if not exists template_ids uuid[] not null default '{}';

-- Índice GIN para queries del tipo "qué assets usaron la plantilla X"
create index if not exists idx_content_assets_template_ids
  on public.content_assets using gin (template_ids);

-- Verificación
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'content_assets'
  and column_name = 'template_ids';
