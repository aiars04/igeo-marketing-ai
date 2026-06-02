-- ══════════════════════════════════════════════════════════════
-- 001_profiles_and_roles.sql
-- Tabla profiles + roles (admin/manager/user) + RLS estricto
-- Aplicado en Supabase project zgwikjijvckekmniuqzg el 2026-06-02
-- ══════════════════════════════════════════════════════════════

-- ── Tipo enum para el rol ────────────────────────────────────────
do $$ begin
  create type public.user_role as enum ('admin', 'manager', 'user');
exception when duplicate_object then null; end $$;

-- ── Tabla profiles ───────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  role        public.user_role not null default 'user',
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_profiles_role   on public.profiles(role);
create index if not exists idx_profiles_active on public.profiles(active);

-- ── Helpers SECURITY DEFINER (evitan recursión RLS) ──────────────
create or replace function public.current_user_role()
returns public.user_role
language sql security definer stable
set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.current_user_is_active()
returns boolean
language sql security definer stable
set search_path = public
as $$ select coalesce((select active from public.profiles where id = auth.uid()), false) $$;

-- ── Trigger: auto-crear profile al registrar user en auth ────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'user')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Trigger: updated_at automático ───────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ══════════════════════════════════════════════════════════════
-- RLS
-- ══════════════════════════════════════════════════════════════
alter table public.profiles enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select
  on public.profiles for select to authenticated using (true);

drop policy if exists profiles_insert_admin on public.profiles;
create policy profiles_insert_admin
  on public.profiles for insert to authenticated
  with check (public.current_user_role() = 'admin');

drop policy if exists profiles_update on public.profiles;
create policy profiles_update
  on public.profiles for update to authenticated
  using (
    public.current_user_role() = 'admin'
    or (
      public.current_user_role() = 'manager'
      and profiles.role = 'user'
      and profiles.id != auth.uid()
    )
    or profiles.id = auth.uid()
  )
  with check (
    case
      when public.current_user_role() = 'admin'
        then not (profiles.id = auth.uid() and role != 'admin')
      when public.current_user_role() = 'manager'
        then role = 'user'
      else (
        profiles.id = auth.uid()
        and role = (select p.role from public.profiles p where p.id = auth.uid())
        and active = (select p.active from public.profiles p where p.id = auth.uid())
      )
    end
  );

drop policy if exists profiles_delete_admin on public.profiles;
create policy profiles_delete_admin
  on public.profiles for delete to authenticated
  using (
    public.current_user_role() = 'admin'
    and id != auth.uid()
  );

grant execute on function public.current_user_role()       to authenticated;
grant execute on function public.current_user_is_active()  to authenticated;
