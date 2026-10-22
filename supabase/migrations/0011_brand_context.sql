-- Contexto de marca em tudo: perfil completo da marca, marca ativa por pessoa,
-- personagem ligado a marca, opções que cada modelo aceita e o planejamento
-- editorial no Vynkio AI. Só colunas novas com default: nada existente muda.

-- ------------------------------------------------------- perfil da marca

alter table public.brands
  add column description text not null default '' check (char_length(description) <= 500),
  add column goals text not null default '' check (char_length(goals) <= 500),
  add column platforms text[] not null default '{}'
    check (platforms <@ array['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'whatsapp', 'pinterest']),
  add column communication text not null default '' check (char_length(communication) <= 500),
  add column references_notes text not null default '' check (char_length(references_notes) <= 1000);

grant insert (description, goals, platforms, communication, references_notes),
  update (description, goals, platforms, communication, references_notes) on public.brands to authenticated;

-- A marca apontada precisa ser do mesmo dono da linha. A coluna vem no argumento do trigger.
create function public.enforce_own_brand() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_brand uuid := (to_jsonb(new) ->> tg_argv[0])::uuid;
begin
  if v_brand is not null and not exists (
    select 1 from public.brands where id = v_brand and user_id = new.user_id
  ) then
    raise exception 'brand_not_found';
  end if;
  return new;
end;
$$;

-- ------------------------------------------------------------ marca ativa

alter table public.user_preferences
  add column active_brand_id uuid references public.brands (id) on delete set null;

create trigger user_preferences_brand before insert or update of active_brand_id on public.user_preferences
  for each row execute function public.enforce_own_brand('active_brand_id');

grant insert (active_brand_id), update (active_brand_id) on public.user_preferences to authenticated;

-- ------------------------------------------------- personagem com marca

alter table public.personas
  add column brand_id uuid references public.brands (id) on delete set null;

create index personas_brand on public.personas (brand_id) where brand_id is not null;

create trigger personas_brand before insert or update of brand_id on public.personas
  for each row execute function public.enforce_own_brand('brand_id');

grant update (brand_id) on public.personas to authenticated;
create policy "own personas update" on public.personas for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- --------------------------------------------- opções aceitas por modelo

-- `options` lista o que a pessoa pode escolher e os valores aceitos, ex.:
-- {"aspect_ratio": ["4:5", "1:1"]}. O primeiro valor é o padrão. A function
-- `generate` recusa valor fora da lista antes de reservar crédito. Opção que
-- muda o custo do fornecedor (duração, resolução) não entra aqui sem custo por parâmetro.
alter table public.models
  add column options jsonb not null default '{}'::jsonb check (jsonb_typeof(options) = 'object');

-- Leitura por coluna (0004 esconde o custo do fornecedor): a coluna nova precisa do grant.
grant select (options) on public.models to anon, authenticated;

update public.models set options = '{"aspect_ratio": ["4:5", "1:1", "9:16", "16:9"]}'
where slug in ('foto', 'foto-persona');
update public.models set options = '{"aspect_ratio": ["9:16", "16:9"]}'
where slug = 'video-veo';

-- O que foi escolhido fica na geração, para o histórico e o suporte.
alter table public.generations
  add column options jsonb not null default '{}'::jsonb check (jsonb_typeof(options) = 'object');

-- ------------------------------------------------ planejamento editorial

insert into public.models (slug, name, description, kind, provider, endpoint, requires_image, credits, defaults, badge, position, allowed_plans) values
  ('planejamento', 'Planejamento editorial', 'Uma semana ou um mês de posts com formato, gancho e objetivo.', 'text',
   'anthropic', 'claude-opus-5-5', false, 3, '{"effort": "low"}', 'NOVO', 140, null)
on conflict (slug) do nothing;

-- UGC apresenta e demonstra; não se passa por depoimento de cliente real.
update public.models set description = 'Vídeo estilo criador apresentando o produto, com cenas para o Studio.'
where slug = 'ugc-roteiro';
