-- Workspace: marcas e projetos. A marca guarda o contexto (público, tom, oferta)
-- que as ferramentas de texto usam; o projeto agrupa o que foi gerado. Toda
-- geração pode apontar para uma marca e um projeto do mesmo dono.

-- Quantas marcas cada plano mantém. Projetos são do plano que inclui a ferramenta `projects` (0005).
alter table public.subscription_plans
  add column max_brands integer not null default 1 check (max_brands between 1 and 100);

update public.subscription_plans set max_brands = 1 where slug = 'gratis';
update public.subscription_plans set max_brands = 1 where slug = 'starter';
update public.subscription_plans set max_brands = 3 where slug = 'pro';
update public.subscription_plans set max_brands = 10 where slug = 'studio';

-- ---------------------------------------------------------------- marcas

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  niche text not null default '' check (char_length(niche) <= 120),
  audience text not null default '' check (char_length(audience) <= 500),
  tone text not null default '' check (char_length(tone) <= 300),
  offer text not null default '' check (char_length(offer) <= 500),
  avoid text not null default '' check (char_length(avoid) <= 300),
  visual_style text not null default '' check (char_length(visual_style) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index brands_user_recent on public.brands (user_id, created_at desc);

-- -------------------------------------------------------------- projetos

create type public.project_status as enum ('planning', 'producing', 'done');

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  brand_id uuid references public.brands (id) on delete set null,
  name text not null check (char_length(trim(name)) between 1 and 80),
  goal text not null default '' check (char_length(goal) <= 500),
  status public.project_status not null default 'planning',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_user_recent on public.projects (user_id, created_at desc);

-- ----------------------------------------------- gerações ganham contexto

alter table public.generations
  add column brand_id uuid references public.brands (id) on delete set null,
  add column project_id uuid references public.projects (id) on delete set null;

create index generations_project on public.generations (project_id, created_at desc) where project_id is not null;

-- ------------------------------------------------------------------ travas

-- Teto de marcas pelo plano em vigor, contado na hora de criar.
create function public.enforce_brand_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform 1 from public.credit_balances where user_id = new.user_id for update;
  if (select count(*) from public.brands where user_id = new.user_id) >= (public.effective_plan(new.user_id)).max_brands then
    raise exception 'too_many_brands';
  end if;
  return new;
end;
$$;

create trigger brands_limit before insert on public.brands
  for each row execute function public.enforce_brand_limit();

-- Projeto é ferramenta de plano; o teto de 200 só segura abuso.
create function public.enforce_project_rules() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if not ('projects' = any ((public.effective_plan(new.user_id)).tools)) then
      raise exception 'plan_required';
    end if;
    if (select count(*) from public.projects where user_id = new.user_id) >= 200 then
      raise exception 'too_many_projects';
    end if;
  end if;
  if new.brand_id is not null and not exists (
    select 1 from public.brands where id = new.brand_id and user_id = new.user_id
  ) then
    raise exception 'brand_not_found';
  end if;
  return new;
end;
$$;

create trigger projects_rules before insert or update of brand_id on public.projects
  for each row execute function public.enforce_project_rules();

-- A geração só aponta para marca e projeto do próprio dono. Quem grava é o
-- service role (edge functions), por isso a conferência fica no banco.
create function public.enforce_generation_context() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.brand_id is not null and not exists (
    select 1 from public.brands where id = new.brand_id and user_id = new.user_id
  ) then
    raise exception 'brand_not_found';
  end if;
  if new.project_id is not null and not exists (
    select 1 from public.projects where id = new.project_id and user_id = new.user_id
  ) then
    raise exception 'project_not_found';
  end if;
  return new;
end;
$$;

create trigger generations_context before insert or update of brand_id, project_id on public.generations
  for each row execute function public.enforce_generation_context();

create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger brands_touch before update on public.brands for each row execute function public.touch_updated_at();
create trigger projects_touch before update on public.projects for each row execute function public.touch_updated_at();

-- -------------------------------------------------------------------- RLS

alter table public.brands enable row level security;
alter table public.projects enable row level security;

revoke all on public.brands, public.projects from anon, authenticated;
grant select, delete on public.brands, public.projects to authenticated;
grant insert (name, niche, audience, tone, offer, avoid, visual_style),
  update (name, niche, audience, tone, offer, avoid, visual_style) on public.brands to authenticated;
grant insert (brand_id, name, goal, status), update (brand_id, name, goal, status) on public.projects to authenticated;

create policy "own brands" on public.brands for select to authenticated using (user_id = auth.uid());
create policy "own brands insert" on public.brands for insert to authenticated with check (user_id = auth.uid());
create policy "own brands update" on public.brands for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own brands delete" on public.brands for delete to authenticated using (user_id = auth.uid());

create policy "own projects" on public.projects for select to authenticated using (user_id = auth.uid());
create policy "own projects insert" on public.projects for insert to authenticated with check (user_id = auth.uid());
create policy "own projects update" on public.projects for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own projects delete" on public.projects for delete to authenticated using (user_id = auth.uid());
