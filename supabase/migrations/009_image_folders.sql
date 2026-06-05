-- ══════════════════════════════════════════════════════════════
-- 009_image_folders.sql
-- Aplicado en Supabase project zgwikjijvckekmniuqzg el 2026-06-04
-- Sistema de carpetas para imágenes (opción A híbrida):
--   - Nueva tabla image_folders (system + custom)
--   - Columnas channel + folder_id en content_assets
--   - Seed: 7 carpetas system (una por canal)
--   - Backfill: rellena content_assets.channel desde el content_item vinculado
-- ══════════════════════════════════════════════════════════════

alter table public.content_assets
  add column if not exists channel   text,
  add column if not exists folder_id uuid;

alter table public.content_assets drop constraint if exists content_assets_channel_check;
alter table public.content_assets
  add constraint content_assets_channel_check
  check (
    channel is null
    or channel in ('linkedin','instagram','facebook','x','blog','email','newsletter','uncategorized')
  );

create table if not exists public.image_folders (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  channel     text check (
                channel is null
                or channel in ('linkedin','instagram','facebook','x','blog','email','newsletter')
              ),
  system      boolean not null default false,
  color       text,
  icon        text,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.content_assets drop constraint if exists content_assets_folder_id_fkey;
alter table public.content_assets
  add constraint content_assets_folder_id_fkey
    foreign key (folder_id) references public.image_folders(id) on delete set null;

create index if not exists idx_assets_channel    on public.content_assets(channel)    where channel    is not null;
create index if not exists idx_assets_folder_id  on public.content_assets(folder_id)  where folder_id  is not null;
create index if not exists idx_folders_channel   on public.image_folders(channel);
create index if not exists idx_folders_system    on public.image_folders(system);

drop trigger if exists image_folders_touch_updated_at on public.image_folders;
create trigger image_folders_touch_updated_at
  before update on public.image_folders
  for each row execute function public.touch_updated_at();

alter table public.image_folders enable row level security;

drop policy if exists folders_select on public.image_folders;
create policy folders_select on public.image_folders for select to authenticated using (true);

drop policy if exists folders_insert on public.image_folders;
create policy folders_insert on public.image_folders for insert to authenticated
  with check (created_by = auth.uid() or public.current_user_role() = 'admin');

drop policy if exists folders_update on public.image_folders;
create policy folders_update on public.image_folders for update to authenticated
  using (system = false and public.current_user_role() in ('admin','manager'));

drop policy if exists folders_delete on public.image_folders;
create policy folders_delete on public.image_folders for delete to authenticated
  using (system = false and public.current_user_role() = 'admin');

-- Seed 7 system folders (idempotente)
insert into public.image_folders (name, channel, system, color, icon)
select * from (values
  ('LinkedIn',   'linkedin',   true, '#0071e3', 'Linkedin'),
  ('Instagram',  'instagram',  true, '#e8388c', 'Instagram'),
  ('Newsletter', 'newsletter', true, '#34c759', 'Mail'),
  ('Blog',       'blog',       true, '#ff9f0a', 'FileText'),
  ('X',          'x',          true, '#6e6e73', 'Twitter'),
  ('Facebook',   'facebook',   true, '#0071e3', 'Facebook'),
  ('Email',      'email',      true, '#ff9f0a', 'AtSign')
) as seed(name, channel, system, color, icon)
where not exists (select 1 from public.image_folders where system = true limit 1);

-- Backfill desde content_items.channel
update public.content_assets ca
set channel = ci.channel,
    folder_id = sf.id
from public.content_items ci
left join public.image_folders sf
  on sf.system = true and sf.channel = ci.channel
where ca.content_item_id = ci.id
  and ca.channel is null
  and ci.channel in ('linkedin','instagram','facebook','x','blog','email','newsletter');
