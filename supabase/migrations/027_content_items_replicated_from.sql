-- 027_content_items_replicated_from.sql
-- Trazabilidad + dedup de réplicas multi-mercado.
--
-- Cuando se replica un item a otros mercados (POST /content-items/[id]/replicate)
-- creamos un content_item nuevo por mercado. Antes no quedaba registro de qué
-- réplica venía de qué original, así que:
--   - replicar 2 veces al mismo mercado creaba DUPLICADOS sin control, y
--   - era imposible agrupar/auditar las variantes de mercado de una pieza.
--
-- `replicated_from` apunta al content_item ORIGEN. NULL = item nativo (no es
-- réplica). ON DELETE SET NULL: si se borra el original, las réplicas
-- sobreviven como items independientes (no se borran en cascada).

alter table public.content_items
  add column if not exists replicated_from uuid;

alter table public.content_items
  drop constraint if exists content_items_replicated_from_fkey;
alter table public.content_items
  add constraint content_items_replicated_from_fkey
  foreign key (replicated_from) references public.content_items(id) on delete set null;

create index if not exists idx_content_items_replicated_from
  on public.content_items(replicated_from)
  where replicated_from is not null;

-- Índice único parcial: como mucho UNA réplica por (origen, mercado). Esto es
-- lo que impide crear duplicados al replicar dos veces al mismo mercado — el
-- endpoint hace el check en código, pero el índice lo garantiza a nivel de BD.
create unique index if not exists uq_content_items_replicated_from_market
  on public.content_items(replicated_from, market)
  where replicated_from is not null;

comment on column public.content_items.replicated_from is
  'FK al content_item origen si este item fue creado por replicación multi-mercado. NULL = item nativo. Único por (replicated_from, market): una réplica por origen+mercado.';
