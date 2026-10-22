-- Vynkio Content: cada conteúdo junta título, rede, formato, roteiro, copy, imagens
-- e vídeos, com status e data planejada. O calendário editorial é uma visão desta
-- tabela por `planned_for`; não existe tabela de calendário à parte.
-- Publicação automática não mora aqui: depende de integração autorizada por rede.

create type public.content_status as enum ('idea', 'planned', 'producing', 'review', 'ready', 'published');

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  brand_id uuid references public.brands (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  title text not null check (char_length(trim(title)) between 1 and 120),
  channel text check (channel in ('instagram', 'tiktok', 'youtube', 'shorts', 'anuncio', 'whatsapp', 'linkedin', 'facebook')),
  format text not null default 'post'
    check (format in ('reels', 'carrossel', 'post', 'story', 'video', 'shorts', 'anuncio', 'outro')),
  status public.content_status not null default 'idea',
  planned_for date,
  script text not null default '' check (char_length(script) <= 10000),
  copy text not null default '' check (char_length(copy) <= 5000),
  notes text not null default '' check (char_length(notes) <= 2000),
  -- O texto do Vynkio AI de onde o conteúdo saiu, quando saiu de lá.
  source_generation_id uuid references public.generations (id) on delete set null,
  -- Imagens e vídeos gerados que fazem parte do conteúdo.
  asset_ids uuid[] not null default '{}' check (cardinality(asset_ids) <= 20),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index content_items_calendar on public.content_items (user_id, planned_for) where planned_for is not null;
create index content_items_board on public.content_items (user_id, status, updated_at desc);

-- Tudo que o conteúdo aponta é do mesmo dono; o teto de 2.000 só segura abuso.
create function public.enforce_content_rules() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and (select count(*) from public.content_items where user_id = new.user_id) >= 2000 then
    raise exception 'too_many_contents';
  end if;
  if new.project_id is not null and not exists (
    select 1 from public.projects where id = new.project_id and user_id = new.user_id
  ) then
    raise exception 'project_not_found';
  end if;
  if new.source_generation_id is not null and not exists (
    select 1 from public.generations where id = new.source_generation_id and user_id = new.user_id and kind = 'text'
  ) then
    raise exception 'source_not_found';
  end if;
  if exists (
    select 1 from unnest(new.asset_ids) as asset (id)
    where not exists (
      select 1 from public.generations g
      where g.id = asset.id and g.user_id = new.user_id and g.kind in ('image', 'video') and g.status = 'succeeded'
    )
  ) then
    raise exception 'asset_not_found';
  end if;
  -- Data de publicação acompanha o status, para relatório e histórico.
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  elsif new.status <> 'published' then
    new.published_at := null;
  end if;
  return new;
end;
$$;

create trigger content_items_rules before insert or update on public.content_items
  for each row execute function public.enforce_content_rules();
create trigger content_items_brand before insert or update of brand_id on public.content_items
  for each row execute function public.enforce_own_brand('brand_id');
create trigger content_items_touch before update on public.content_items
  for each row execute function public.touch_updated_at();

alter table public.content_items enable row level security;

revoke all on public.content_items from anon, authenticated;
grant select, delete on public.content_items to authenticated;
grant insert (brand_id, project_id, title, channel, format, status, planned_for, script, copy, notes, source_generation_id, asset_ids),
  update (brand_id, project_id, title, channel, format, status, planned_for, script, copy, notes, asset_ids)
  on public.content_items to authenticated;

create policy "own contents" on public.content_items for select to authenticated using (user_id = auth.uid());
create policy "own contents insert" on public.content_items for insert to authenticated with check (user_id = auth.uid());
create policy "own contents update" on public.content_items for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own contents delete" on public.content_items for delete to authenticated using (user_id = auth.uid());
