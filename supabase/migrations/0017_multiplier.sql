-- Vynkio Multiplicador: a pessoa envia takes e fotos próprios, o Claude escreve variações de
-- roteiro (gancho, cenas, CTA, legenda) e o navegador monta um vídeo por variação.
--
-- Os arquivos de vídeo não sobem: ficam no aparelho da pessoa e são montados lá. O banco guarda
-- só o projeto, a descrição dos takes e os roteiros. Por isso a montagem não tem custo de servidor
-- nem de armazenamento; o que cobra crédito é o roteiro (IA), pelo motor de sempre.
--
-- Regra de produto: variação é roteiro e montagem diferentes. Nada de mexer em velocidade, filtro
-- ou metadado para driblar detecção de conteúdo duplicado.

-- --------------------------------------------------------------- plano

alter table public.subscription_plans
  add column max_variations integer not null default 3 check (max_variations between 1 and 20);

update public.subscription_plans set max_variations = 3 where slug = 'gratis';
update public.subscription_plans set max_variations = 5 where slug = 'starter';
update public.subscription_plans set max_variations = 10 where slug = 'pro';
update public.subscription_plans set max_variations = 10 where slug = 'studio';

-- Um lote de roteiros = um pedido ao Claude. Preço fixo por lote; trocar = `update`, sem deploy.
insert into public.models (slug, name, description, kind, provider, endpoint, requires_image, credits, defaults, badge, position, allowed_plans, charges_on_failure) values
  ('multiplicador', 'Multiplicador', 'Variações de roteiro a partir dos seus takes, prontas para montar.', 'text',
   'anthropic', 'claude-opus-5-5', false, 8, '{"effort": "low"}', 'NOVO', 140, null, true)
on conflict (slug) do nothing;

-- ------------------------------------------------------------- projetos

create table public.multiplier_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  brand_id uuid references public.brands (id) on delete set null,
  name text not null check (char_length(trim(name)) between 1 and 80),
  product_name text not null default '' check (char_length(product_name) <= 120),
  product_description text not null default '' check (char_length(product_description) <= 2000),
  audience text not null default '' check (char_length(audience) <= 500),
  platform text not null default 'instagram'
    check (platform in ('instagram', 'tiktok', 'shorts', 'youtube', 'anuncio', 'facebook')),
  objective text not null default 'vendas'
    check (objective in ('vendas', 'engajamento', 'alcance', 'leads', 'lancamento', 'autoridade')),
  aspect text not null default '9:16' check (aspect in ('9:16', '1:1', '4:5', '16:9')),
  -- O que a pessoa diz no vídeo, colado por ela (transcrição automática ainda não existe).
  transcript text not null default '' check (char_length(transcript) <= 6000),
  -- Descrição dos arquivos: [{id, name, kind, duration, note}]. Os arquivos ficam no aparelho.
  takes jsonb not null default '[]'::jsonb,
  rights_confirmed boolean not null default false,
  -- Leitura do material feita pelo Claude no último lote: benefícios citados, limites, oportunidades.
  analysis jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(takes) = 'array' and jsonb_array_length(takes) <= 12 and pg_column_size(takes) <= 20000)
);

create index multiplier_projects_owner on public.multiplier_projects (user_id, updated_at desc);

create function public.enforce_multiplier_project() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and (select count(*) from public.multiplier_projects where user_id = new.user_id) >= 200 then
    raise exception 'too_many_projects';
  end if;
  if exists (
    select 1 from jsonb_array_elements(new.takes) as take
    where jsonb_typeof(take) <> 'object'
       or coalesce(take ->> 'kind', '') not in ('video', 'image')
       or char_length(coalesce(take ->> 'name', '')) not between 1 and 200
       or char_length(coalesce(take ->> 'note', '')) > 300
       or coalesce((take ->> 'duration')::numeric, 0) not between 0.5 and 600
  ) then
    raise exception 'invalid_takes';
  end if;
  return new;
end;
$$;

create trigger multiplier_projects_rules before insert or update of takes on public.multiplier_projects
  for each row execute function public.enforce_multiplier_project();
create trigger multiplier_projects_brand before insert or update of brand_id on public.multiplier_projects
  for each row execute function public.enforce_own_brand('brand_id');
create trigger multiplier_projects_touch before update on public.multiplier_projects
  for each row execute function public.touch_updated_at();

alter table public.multiplier_projects enable row level security;

revoke all on public.multiplier_projects from anon, authenticated;
grant select, delete on public.multiplier_projects to authenticated;
grant insert (brand_id, name, product_name, product_description, audience, platform, objective, aspect, transcript, takes, rights_confirmed),
  update (brand_id, name, product_name, product_description, audience, platform, objective, aspect, transcript, takes, rights_confirmed)
  on public.multiplier_projects to authenticated;

create policy "own multiplier projects" on public.multiplier_projects for select to authenticated using (user_id = auth.uid());
create policy "own multiplier projects insert" on public.multiplier_projects for insert to authenticated with check (user_id = auth.uid());
create policy "own multiplier projects update" on public.multiplier_projects for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own multiplier projects delete" on public.multiplier_projects for delete to authenticated using (user_id = auth.uid());

-- ------------------------------------------------------------ variações

create table public.multiplier_variations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.multiplier_projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- O lote: a geração de texto que escreveu a variação (crédito, custo e data ficam nela).
  generation_id uuid not null references public.generations (id) on delete cascade,
  position integer not null check (position between 1 and 20),
  script jsonb not null check (jsonb_typeof(script) = 'object' and pg_column_size(script) <= 20000),
  edited boolean not null default false,
  render_status text not null default 'pending' check (render_status in ('pending', 'rendered', 'failed')),
  rendered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (generation_id, position)
);

create index multiplier_variations_project on public.multiplier_variations (project_id, created_at desc, position);

-- Editar o roteiro marca a variação como editada; montar marca a data.
create function public.stamp_multiplier_variation() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.script is distinct from old.script then new.edited := true; end if;
  if new.render_status = 'rendered' and old.render_status <> 'rendered' then new.rendered_at := now(); end if;
  if new.render_status <> 'rendered' then new.rendered_at := null; end if;
  return new;
end;
$$;

create trigger multiplier_variations_stamp before update on public.multiplier_variations
  for each row execute function public.stamp_multiplier_variation();
create trigger multiplier_variations_touch before update on public.multiplier_variations
  for each row execute function public.touch_updated_at();

alter table public.multiplier_variations enable row level security;

-- Variação nasce só pela function (service role). A pessoa lê, edita o roteiro, marca a montagem e apaga.
revoke all on public.multiplier_variations from anon, authenticated;
grant select, delete on public.multiplier_variations to authenticated;
grant update (script, render_status) on public.multiplier_variations to authenticated;

create policy "own variations" on public.multiplier_variations for select to authenticated using (user_id = auth.uid());
create policy "own variations update" on public.multiplier_variations for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own variations delete" on public.multiplier_variations for delete to authenticated using (user_id = auth.uid());

-- ------------------------------------------------------------- lote

-- Abre o lote: confere o projeto, o tamanho pedido contra o plano e passa pelo motor
-- (saldo, limites, teto de gasto, reserva). Só a function `multiplier` chama.
create function public.start_multiplier_batch(p_user_id uuid, p_project_id uuid, p_count integer, p_idempotency_key text default null)
returns public.generations
language plpgsql security definer set search_path = public as $$
declare
  project public.multiplier_projects;
  plan public.subscription_plans;
begin
  select * into project from public.multiplier_projects where id = p_project_id and user_id = p_user_id;
  if not found then raise exception 'project_not_found'; end if;
  if not project.rights_confirmed then raise exception 'rights_not_confirmed'; end if;
  if jsonb_array_length(project.takes) = 0 then raise exception 'takes_required'; end if;

  plan := public.effective_plan(p_user_id);
  if p_count is null or p_count < 1 then raise exception 'invalid_count'; end if;
  if p_count > plan.max_variations then raise exception 'too_many_variations'; end if;

  return public.create_generation(
    p_user_id, 'multiplicador',
    left(format('Multiplicador: %s variações de %s', p_count, coalesce(nullif(project.product_name, ''), project.name)), 2000),
    p_idempotency_key => p_idempotency_key
  );
end;
$$;
revoke execute on function public.start_multiplier_batch(uuid, uuid, integer, text) from public, anon, authenticated;
grant execute on function public.start_multiplier_batch(uuid, uuid, integer, text) to service_role;

-- Fecha o lote numa transação só: grava as variações e a leitura do material e captura o crédito.
create function public.complete_multiplier_batch(p_generation_id uuid, p_project_id uuid, p_analysis jsonb, p_scripts jsonb)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  g public.generations;
  inserted integer;
begin
  select * into g from public.generations where id = p_generation_id and model_slug = 'multiplicador' for update;
  if not found or g.status not in ('queued', 'running') then return 0; end if;
  if not exists (select 1 from public.multiplier_projects where id = p_project_id and user_id = g.user_id) then
    raise exception 'project_not_found';
  end if;
  if jsonb_typeof(p_scripts) <> 'array' or jsonb_array_length(p_scripts) not between 1 and 20 then
    raise exception 'invalid_scripts';
  end if;

  insert into public.multiplier_variations (project_id, user_id, generation_id, position, script)
  select p_project_id, g.user_id, g.id, item.ordinality::integer, item.value
  from jsonb_array_elements(p_scripts) with ordinality as item (value, ordinality);
  get diagnostics inserted = row_count;

  update public.multiplier_projects set analysis = p_analysis, updated_at = now() where id = p_project_id;
  perform public.complete_text_generation(g.id, jsonb_build_object('project_id', p_project_id, 'variations', inserted)::text);
  return inserted;
end;
$$;
revoke execute on function public.complete_multiplier_batch(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.complete_multiplier_batch(uuid, uuid, jsonb, jsonb) to service_role;
