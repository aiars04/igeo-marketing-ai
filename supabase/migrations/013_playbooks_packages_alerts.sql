-- ─────────────────────────────────────────────────────────────────────────
-- Migración 013: Fase 1A — Cimientos para Editorial Orchestrator
--
-- Crea las tablas base para los próximos módulos del blueprint:
--   - playbooks + playbook_steps → plantillas reutilizables (webinar, evento, release...)
--   - campaign_packages          → agrupador de piezas relacionadas
--   - alerts                     → sistema de avisos (item sin material, sin aprobación, etc.)
--   - market_rules               → reglas operativas por mercado (no solo brand context textual)
--
-- También extiende content_items con package_id y playbook_step_id para
-- enganchar las piezas existentes a paquetes y a pasos de playbook.
--
-- TODO el SQL es idempotente (IF NOT EXISTS / DROP POLICY IF EXISTS) — seguro
-- de re-ejecutar.
-- ─────────────────────────────────────────────────────────────────────────

-- ╔═════════════════════════════════════════════════════════════════════╗
-- ║ 1. PLAYBOOKS                                                       ║
-- ╚═════════════════════════════════════════════════════════════════════╝
create table if not exists public.playbooks (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  type                 text not null,
    -- Tipo: webinar | event_presential | event_online | release |
    --       newsletter | campaign | alliance | workshop | lead_magnet |
    --       reactivation | podcast
  description          text,
  market_scope         text not null default 'all',
    -- 'all' o 'spain'|'latam'|'uk'|'france'|'italy'|'portugal'|'brasil'
  default_channels     text[] not null default '{}',
    -- Canales por defecto que aplica este playbook
  required_assets      text[] not null default '{}',
    -- Activos obligatorios: 'image', 'landing', 'cta', 'video', 'pdf'
  required_copy_blocks text[] not null default '{}',
    -- Bloques de copy obligatorios para validación: 'hook', 'cta', 'closing'
  approval_required    boolean not null default true,
  active               boolean not null default true,
  created_by           uuid references public.profiles(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_playbooks_type    on public.playbooks(type);
create index if not exists idx_playbooks_active  on public.playbooks(active);
create index if not exists idx_playbooks_market  on public.playbooks(market_scope);


-- ╔═════════════════════════════════════════════════════════════════════╗
-- ║ 2. PLAYBOOK_STEPS                                                  ║
-- ╚═════════════════════════════════════════════════════════════════════╝
create table if not exists public.playbook_steps (
  id                   uuid primary key default gen_random_uuid(),
  playbook_id          uuid not null references public.playbooks(id) on delete cascade,
  step_order           integer not null,
  relative_day_offset  integer not null default 0,
    -- Días respecto a anchor_date del package:
    -- negativo = días antes (ej. -7 = anuncio una semana antes)
    -- 0 = día del evento
    -- positivo = días después (ej. +3 = follow-up 3 días después)
  channel              text,
  content_type         text,
    -- Nombre del content_type a aplicar (ej. 'webinar_announcement')
  task_type            text not null,
    -- 'post' | 'email' | 'newsletter' | 'landing' | 'reminder' |
    -- 'follow_up' | 'blog' | 'video' | 'banner' | 'pdf'
  title_template       text,
    -- Plantilla con placeholders: "Recordatorio: {{event_name}} mañana"
  instructions         text,
    -- Instrucciones específicas para este paso (se inyecta en el prompt IA)
  required             boolean not null default true,
  approval_gate        boolean not null default true,
  depends_on_step_id   uuid references public.playbook_steps(id) on delete set null
);

create index if not exists idx_playbook_steps_playbook on public.playbook_steps(playbook_id);
create index if not exists idx_playbook_steps_order    on public.playbook_steps(playbook_id, step_order);


-- ╔═════════════════════════════════════════════════════════════════════╗
-- ║ 3. CAMPAIGN_PACKAGES                                               ║
-- ╚═════════════════════════════════════════════════════════════════════╝
create table if not exists public.campaign_packages (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  package_type text not null,
    -- Mismo enum que playbooks.type
  market       text not null default 'spain',
  objective    text,
    -- Objetivo de negocio del paquete (texto libre)
  anchor_date  timestamptz,
    -- Fecha del evento principal (webinar, feria, lanzamiento)
    -- Los relative_day_offset de los steps se calculan desde aquí
  start_date   timestamptz,
  end_date     timestamptz,
  playbook_id  uuid references public.playbooks(id) on delete set null,
  status       text not null default 'draft',
    -- 'draft' | 'active' | 'completed' | 'cancelled'
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_packages_status      on public.campaign_packages(status);
create index if not exists idx_packages_market      on public.campaign_packages(market);
create index if not exists idx_packages_anchor      on public.campaign_packages(anchor_date);
create index if not exists idx_packages_playbook    on public.campaign_packages(playbook_id);


-- ╔═════════════════════════════════════════════════════════════════════╗
-- ║ 4. CONTENT_ITEMS: añadir package_id y playbook_step_id            ║
-- ╚═════════════════════════════════════════════════════════════════════╝
alter table public.content_items
  add column if not exists package_id uuid references public.campaign_packages(id) on delete set null,
  add column if not exists playbook_step_id uuid references public.playbook_steps(id) on delete set null;

create index if not exists idx_content_items_package_id        on public.content_items(package_id);
create index if not exists idx_content_items_playbook_step_id  on public.content_items(playbook_step_id);


-- ╔═════════════════════════════════════════════════════════════════════╗
-- ║ 5. ALERTS                                                          ║
-- ╚═════════════════════════════════════════════════════════════════════╝
create table if not exists public.alerts (
  id                       uuid primary key default gen_random_uuid(),
  level                    text not null default 'warning',
    -- 'info' | 'warning' | 'critical'
  type                     text not null,
    -- 'missing_copy' | 'missing_image' | 'missing_approval' |
    -- 'missing_cta'  | 'missing_landing' | 'package_incomplete' |
    -- 'scheduled_no_material' | 'dependency_not_met' | 'market_inconsistency'
  title                    text not null,
  description              text,
  related_content_item_id  uuid references public.content_items(id) on delete cascade,
  related_package_id       uuid references public.campaign_packages(id) on delete cascade,
  due_at                   timestamptz,
    -- Fecha para la que debe estar resuelta (típicamente scheduled_at - 10 días)
  resolved                 boolean not null default false,
  resolved_by              uuid references public.profiles(id) on delete set null,
  resolved_at              timestamptz,
  created_at               timestamptz not null default now()
);

create index if not exists idx_alerts_resolved    on public.alerts(resolved);
create index if not exists idx_alerts_level       on public.alerts(level);
create index if not exists idx_alerts_type        on public.alerts(type);
create index if not exists idx_alerts_due_at      on public.alerts(due_at);
create index if not exists idx_alerts_content     on public.alerts(related_content_item_id);
create index if not exists idx_alerts_package     on public.alerts(related_package_id);


-- ╔═════════════════════════════════════════════════════════════════════╗
-- ║ 6. MARKET_RULES                                                    ║
-- ╚═════════════════════════════════════════════════════════════════════╝
-- Una fila por mercado. brand_context sigue siendo para texto narrativo
-- (tone of voice, claims). market_rules es para reglas operativas
-- estructuradas (keywords, no-decir, CTAs) que la IA debe respetar.
create table if not exists public.market_rules (
  id                  uuid primary key default gen_random_uuid(),
  market              text not null unique,
    -- 'spain' | 'latam' | 'uk' | 'france' | 'italy' | 'portugal' | 'brasil'
  keyword_rules       jsonb not null default '{}'::jsonb,
    -- {"primary": [...], "secondary": [...], "forbidden": [...]}
  terminology_rules   jsonb not null default '{}'::jsonb,
    -- {"prefer": {"sanidad ambiental": "control de plagas"}, ...}
  no_say_rules        text[] not null default '{}',
    -- Lista de frases prohibidas (legal/compliance)
  cta_rules           jsonb not null default '{}'::jsonb,
    -- {"default": "Solicita demo", "linkedin": "Conecta con nosotros"}
  notes               text,
  updated_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_market_rules_market on public.market_rules(market);


-- ╔═════════════════════════════════════════════════════════════════════╗
-- ║ HELPER FUNCTION                                                     ║
-- ╚═════════════════════════════════════════════════════════════════════╝
-- Verifica si el usuario actual es admin o manager activo
create or replace function public.is_admin_or_manager()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('admin', 'manager')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role = 'admin'
  );
$$;

create or replace function public.is_active_user()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.active = true
  );
$$;


-- ╔═════════════════════════════════════════════════════════════════════╗
-- ║ RLS — PLAYBOOKS                                                    ║
-- ╚═════════════════════════════════════════════════════════════════════╝
alter table public.playbooks enable row level security;

drop policy if exists playbooks_select on public.playbooks;
create policy playbooks_select on public.playbooks for select
  using (public.is_active_user());

drop policy if exists playbooks_insert on public.playbooks;
create policy playbooks_insert on public.playbooks for insert
  with check (public.is_admin_or_manager());

drop policy if exists playbooks_update on public.playbooks;
create policy playbooks_update on public.playbooks for update
  using (public.is_admin_or_manager());

drop policy if exists playbooks_delete on public.playbooks;
create policy playbooks_delete on public.playbooks for delete
  using (public.is_admin());


-- ╔═════════════════════════════════════════════════════════════════════╗
-- ║ RLS — PLAYBOOK_STEPS                                               ║
-- ╚═════════════════════════════════════════════════════════════════════╝
alter table public.playbook_steps enable row level security;

drop policy if exists playbook_steps_select on public.playbook_steps;
create policy playbook_steps_select on public.playbook_steps for select
  using (public.is_active_user());

drop policy if exists playbook_steps_insert on public.playbook_steps;
create policy playbook_steps_insert on public.playbook_steps for insert
  with check (public.is_admin_or_manager());

drop policy if exists playbook_steps_update on public.playbook_steps;
create policy playbook_steps_update on public.playbook_steps for update
  using (public.is_admin_or_manager());

drop policy if exists playbook_steps_delete on public.playbook_steps;
create policy playbook_steps_delete on public.playbook_steps for delete
  using (public.is_admin_or_manager());


-- ╔═════════════════════════════════════════════════════════════════════╗
-- ║ RLS — CAMPAIGN_PACKAGES                                            ║
-- ╚═════════════════════════════════════════════════════════════════════╝
alter table public.campaign_packages enable row level security;

drop policy if exists packages_select on public.campaign_packages;
create policy packages_select on public.campaign_packages for select
  using (public.is_active_user());

drop policy if exists packages_insert on public.campaign_packages;
create policy packages_insert on public.campaign_packages for insert
  with check (public.is_active_user());

drop policy if exists packages_update on public.campaign_packages;
create policy packages_update on public.campaign_packages for update
  using (created_by = auth.uid() or public.is_admin_or_manager());

drop policy if exists packages_delete on public.campaign_packages;
create policy packages_delete on public.campaign_packages for delete
  using (created_by = auth.uid() or public.is_admin());


-- ╔═════════════════════════════════════════════════════════════════════╗
-- ║ RLS — ALERTS                                                       ║
-- ╚═════════════════════════════════════════════════════════════════════╝
alter table public.alerts enable row level security;

drop policy if exists alerts_select on public.alerts;
create policy alerts_select on public.alerts for select
  using (public.is_active_user());

drop policy if exists alerts_insert on public.alerts;
create policy alerts_insert on public.alerts for insert
  with check (public.is_active_user());

drop policy if exists alerts_update on public.alerts;
create policy alerts_update on public.alerts for update
  using (public.is_active_user());

drop policy if exists alerts_delete on public.alerts;
create policy alerts_delete on public.alerts for delete
  using (public.is_admin_or_manager());


-- ╔═════════════════════════════════════════════════════════════════════╗
-- ║ RLS — MARKET_RULES                                                 ║
-- ╚═════════════════════════════════════════════════════════════════════╝
alter table public.market_rules enable row level security;

drop policy if exists market_rules_select on public.market_rules;
create policy market_rules_select on public.market_rules for select
  using (public.is_active_user());

drop policy if exists market_rules_insert on public.market_rules;
create policy market_rules_insert on public.market_rules for insert
  with check (public.is_admin_or_manager());

drop policy if exists market_rules_update on public.market_rules;
create policy market_rules_update on public.market_rules for update
  using (public.is_admin_or_manager());

drop policy if exists market_rules_delete on public.market_rules;
create policy market_rules_delete on public.market_rules for delete
  using (public.is_admin());


-- ╔═════════════════════════════════════════════════════════════════════╗
-- ║ TRIGGERS updated_at                                                 ║
-- ╚═════════════════════════════════════════════════════════════════════╝
create or replace function public.set_updated_at_generic()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_playbooks_updated_at on public.playbooks;
create trigger trg_playbooks_updated_at
  before update on public.playbooks
  for each row execute function public.set_updated_at_generic();

drop trigger if exists trg_packages_updated_at on public.campaign_packages;
create trigger trg_packages_updated_at
  before update on public.campaign_packages
  for each row execute function public.set_updated_at_generic();

drop trigger if exists trg_market_rules_updated_at on public.market_rules;
create trigger trg_market_rules_updated_at
  before update on public.market_rules
  for each row execute function public.set_updated_at_generic();


-- ╔═════════════════════════════════════════════════════════════════════╗
-- ║ SEED — fila base por cada mercado en market_rules                  ║
-- ╚═════════════════════════════════════════════════════════════════════╝
insert into public.market_rules (market) values
  ('spain'), ('latam'), ('uk'), ('france'),
  ('italy'), ('portugal'), ('brasil')
on conflict (market) do nothing;


-- ╔═════════════════════════════════════════════════════════════════════╗
-- ║ VERIFICACIÓN                                                       ║
-- ╚═════════════════════════════════════════════════════════════════════╝
select
  to_regclass('public.playbooks')::text          as playbooks,
  to_regclass('public.playbook_steps')::text     as playbook_steps,
  to_regclass('public.campaign_packages')::text  as campaign_packages,
  to_regclass('public.alerts')::text             as alerts,
  to_regclass('public.market_rules')::text       as market_rules,
  (select count(*) from public.market_rules)     as market_rules_seeded;
