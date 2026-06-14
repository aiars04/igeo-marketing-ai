-- ══════════════════════════════════════════════════════════════
-- 021_brand_context_market_blocks.sql
-- Seed de bloques de brand_context para los mercados que faltaban.
--
-- El editor (BrandContextEditor) solo muestra/edita bloques que ya existen
-- en BD. Hasta ahora solo había market_spain_latam y market_uk, así que el
-- admin no podía dar contexto cultural/lingüístico a Francia, Italia,
-- Portugal, Brasil ni México — y /api/content-items/[id]/generate los ignoraba.
--
-- Insertamos los bloques con market='all' y contenido placeholder (idempotente).
-- ══════════════════════════════════════════════════════════════

insert into public.brand_context (key, content, market)
select v.key, v.content, 'all'
from (values
  ('market_france',   'Contexto de mercado para Francia. (Edítalo en Admin → Estrategia & Marca: idioma, tono, regulaciones y particularidades culturales del mercado francés.)'),
  ('market_italy',    'Contexto de mercado para Italia. (Edítalo en Admin → Estrategia & Marca: idioma, tono, regulaciones y particularidades culturales del mercado italiano.)'),
  ('market_portugal', 'Contexto de mercado para Portugal. (Edítalo en Admin → Estrategia & Marca: idioma, tono, regulaciones y particularidades culturales del mercado portugués.)'),
  ('market_brasil',   'Contexto de mercado para Brasil. (Edítalo en Admin → Estrategia & Marca: idioma, tono, regulaciones y particularidades culturales del mercado brasileño.)'),
  ('market_mexico',   'Contexto de mercado para México. (Edítalo en Admin → Estrategia & Marca: idioma, tono, regulaciones y particularidades culturales del mercado mexicano.)')
) as v(key, content)
where not exists (
  select 1 from public.brand_context bc where bc.key = v.key
);

-- Verificación
select key, market, left(content, 40) as preview
from public.brand_context
where key like 'market_%'
order by key;
