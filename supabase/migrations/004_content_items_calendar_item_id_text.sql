-- ══════════════════════════════════════════════════════════════
-- 004_content_items_calendar_item_id_text.sql
-- Convertir calendar_item_id de uuid FK → text libre.
--
-- Razón: el calendario vive hoy en localStorage del navegador y genera
-- IDs aleatorios cortos (Math.random().toString(36).substr(2, 9)), NO
-- uuids. El FK a calendar_items + el cast uuid hacían fallar el INSERT
-- con código 22P02 ('invalid input syntax for type uuid').
--
-- La dedup queda garantizada por un UNIQUE INDEX parcial (WHERE NOT NULL).
-- Aplicado en Supabase project zgwikjijvckekmniuqzg el 2026-06-03
-- ══════════════════════════════════════════════════════════════

-- ── 1) Quitar el FK constraint (nombre dinámico por si Supabase lo cambió) ─
do $$
declare
  fk_name text;
begin
  select conname into fk_name
  from pg_constraint
  where conrelid = 'public.content_items'::regclass
    and contype  = 'f'
    and conkey   = (select array_agg(attnum order by attnum)
                    from pg_attribute
                    where attrelid = 'public.content_items'::regclass
                      and attname = 'calendar_item_id');
  if fk_name is not null then
    execute format('alter table public.content_items drop constraint %I', fk_name);
    raise notice 'Dropped FK constraint: %', fk_name;
  end if;
end $$;

-- ── 2) Cambiar tipo uuid → text ─────────────────────────────────
alter table public.content_items
  alter column calendar_item_id type text
  using calendar_item_id::text;

-- ── 3) UNIQUE INDEX parcial — dedup garantizado a nivel DB ───────
drop index if exists idx_content_items_calendar_item_id;
create unique index idx_content_items_calendar_item_id
  on public.content_items(calendar_item_id)
  where calendar_item_id is not null;

-- ── 4) Documentación ────────────────────────────────────────────
comment on column public.content_items.calendar_item_id is
  'External event ID coming from the calendar (localStorage-based today). Free text, not a FK. Unique when non-null.';
