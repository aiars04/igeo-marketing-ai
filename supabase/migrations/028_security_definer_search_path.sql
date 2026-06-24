-- 028_security_definer_search_path.sql
-- Hardening: fijar search_path en las funciones SECURITY DEFINER.
--
-- is_admin_or_manager / is_admin / is_active_user (definidas en 011 y 013)
-- son SECURITY DEFINER pero NO fijaban search_path. Una función SECURITY
-- DEFINER sin search_path fijo es el patrón clásico de escalada: si un rol
-- pudiera crear objetos en un esquema que precede en el search_path, podría
-- secuestrar la resolución de `profiles`/`auth.uid` y ejecutar con los
-- privilegios del owner. Las redefinimos idénticas en lógica pero con
-- `set search_path = public, pg_temp` para cerrar el vector.
--
-- Estas funciones sostienen las policies RLS de prácticamente todas las
-- tablas (011/013/015/016/020/022/023), así que el fix es transversal.
-- Idempotente: create or replace.

create or replace function public.is_admin_or_manager()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
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
set search_path = public, pg_temp
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
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.active = true
  );
$$;
