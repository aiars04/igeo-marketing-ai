-- ─────────────────────────────────────────────────────────────────────────
-- Migración 012: Eventos del calendario persistidos en Supabase
--
-- Reemplaza el almacenamiento en localStorage del navegador (igeo_cal_events_v2)
-- por una tabla compartida. Los eventos del pipeline (items con scheduled_at)
-- siguen viniendo de content_items — esta tabla es solo para eventos NATIVOS
-- del calendario (presenciales, ferias, reuniones, posts genéricos, etc.).
--
-- Tablas afectadas:
--   - calendar_events → nueva tabla
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.calendar_events (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text,
  start_time      timestamptz not null,
  end_time        timestamptz not null,
  all_day         boolean not null default false,
  color           text not null default 'blue',
  category        text,
  tags            text[] not null default '{}',
  -- Tipo de evento: presencial (tiene location) | digital (tiene channel/market)
  event_type      text check (event_type in ('presential', 'digital')),
  location        text,
  channel         text,
  market          text,
  -- Trazabilidad
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_calendar_events_start_time on public.calendar_events(start_time);
create index if not exists idx_calendar_events_event_type on public.calendar_events(event_type);
create index if not exists idx_calendar_events_created_by on public.calendar_events(created_by);

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.calendar_events enable row level security;

-- Cualquier usuario activo puede leer los eventos
drop policy if exists calendar_events_select on public.calendar_events;
create policy calendar_events_select on public.calendar_events
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.active = true
    )
  );

-- Cualquier usuario activo puede crear eventos
drop policy if exists calendar_events_insert on public.calendar_events;
create policy calendar_events_insert on public.calendar_events
  for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.active = true
    )
  );

-- El creador o admin/manager pueden editar
drop policy if exists calendar_events_update on public.calendar_events;
create policy calendar_events_update on public.calendar_events
  for update
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.active = true
        and p.role in ('admin', 'manager')
    )
  );

-- El creador o admin pueden borrar
drop policy if exists calendar_events_delete on public.calendar_events;
create policy calendar_events_delete on public.calendar_events
  for delete
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.active = true
        and p.role = 'admin'
    )
  );

-- Trigger updated_at
create or replace function public.set_calendar_events_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_calendar_events_updated_at on public.calendar_events;
create trigger trg_calendar_events_updated_at
  before update on public.calendar_events
  for each row execute function public.set_calendar_events_updated_at();
