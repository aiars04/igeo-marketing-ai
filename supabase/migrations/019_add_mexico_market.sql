-- Sugerencia 9 — añadir México como mercado válido.
--
-- El slug `uk` se mantiene en BD por compatibilidad con datos existentes;
-- solo cambia su LABEL visual a "Internacional" en el cliente (MARKET_CONFIG).
--
-- Único CHECK constraint sobre `market` actualmente en BD: brand_context.
-- El resto de tablas que usan market (content_items, market_rules, ideas,
-- calendar_items, calendar_events, brand_context, campaign_packages,
-- seo_research_sessions, seo_briefs) usan columna `text` sin CHECK — la
-- validación se hace a nivel API contra el enum Market.

alter table public.brand_context
  drop constraint if exists brand_context_market_check;

alter table public.brand_context
  add constraint brand_context_market_check
  check (market in (
    'all', 'spain', 'latam', 'uk', 'france', 'italy', 'portugal', 'brasil', 'mexico'
  ));

-- Verificación
select market, count(*) as filas
from public.brand_context
group by market
order by market;
