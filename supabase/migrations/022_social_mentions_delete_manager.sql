-- Ajuste de permisos: el repositorio de menciones es colaborativo.
-- Antes solo admin podía BORRAR menciones, pero admin y manager ya pueden
-- crear/editar (is_admin_or_manager). Alineamos el DELETE para que un manager
-- (p.ej. Ramón) pueda gestionar las menciones por completo.

drop policy if exists social_mentions_delete on public.social_mentions;
create policy social_mentions_delete on public.social_mentions for delete
  using (public.is_admin_or_manager());

-- Verificación
select policyname, cmd, qual
from pg_policies
where tablename = 'social_mentions' and policyname = 'social_mentions_delete';
