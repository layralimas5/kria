-- Preços v3: tarifa oficial por modelo, motor de cotação por configuração, bloqueio de modelo sem
-- custo confiável, reconciliação do custo de texto, boas-vindas com proteção contra abuso, proposta
-- comercial v3 nos rascunhos, vitrine lendo do banco, checagem da virada, virada com trava de margem
-- e volta da virada. Só acrescenta: plano no ar, saldo e assinatura não mudam aqui. Ver docs/precos-v3.md.

-- ------------------------------------------------------------ parâmetros

alter table public.pricing_settings
  -- Ligado na virada: modelo sem custo conferido (ou com preço mudado no fornecedor) não gera.
  add column require_trusted_cost boolean not null default false,
  -- Teto de custo de uma operação (US$). Acima disso o modelo não gera, mesmo com crédito.
  add column max_operation_cost_usd numeric(8, 2) not null default 5 check (max_operation_cost_usd > 0),
  -- Boas-vindas que a virada vai aplicar (escala v2). Hoje vale `welcome_credits` (escala atual).
  add column next_welcome_credits integer not null default 100 check (next_welcome_credits between 0 and 1000),
  -- Quantas contas novas por dia recebem boas-vindas (fuso de São Paulo). Limita o estrago de cadastro em massa.
  add column welcome_daily_cap integer not null default 300 check (welcome_daily_cap between 0 and 100000),
  -- Diferença aceita entre o preço guardado e o que o fornecedor devolve na checagem.
  add column price_drift_tolerance numeric(5, 4) not null default 0.01 check (price_drift_tolerance between 0 and 0.5);

alter table public.finance_settings
  add column payment_fee_fixed_cents integer not null default 0 check (payment_fee_fixed_cents >= 0),
  add column storage_cents_per_subscriber integer not null default 0 check (storage_cents_per_subscriber >= 0),
  add column transfer_cents_per_subscriber integer not null default 0 check (transfer_cents_per_subscriber >= 0),
  add column other_variable_cents_per_subscriber integer not null default 0 check (other_variable_cents_per_subscriber >= 0);

-- Meta inicial: 60% de margem de contribuição com o plano usado por inteiro. Só troca se ninguém mexeu.
update public.finance_settings set min_margin_rate = 0.60, updated_at = now() where min_margin_rate = 0.40;

-- --------------------------------------------------------------- tarifas

-- Tarifa oficial do fornecedor, na unidade em que ele cobra:
--   {"unit": "image", "usd": 0.08, "resolution_multipliers": {"1K": 1, "2K": 1.5}}
--   {"unit": "second", "usd": 0.084, "usd_audio": 0.126}
--   {"unit": "token", "input_usd_per_mtok": 4, "output_usd_per_mtok": 20, "est_input_tokens": null, "est_output_tokens": null}
-- `provider_cost_usd` continua sendo o custo de uma operação; agora sai da tarifa × `defaults`.
alter table public.models
  add column pricing jsonb check (pricing is null or jsonb_typeof(pricing) = 'object'),
  -- Preço no fornecedor diferente do guardado: o modelo deixa de ser confiável até o admin rever.
  add column cost_drift_at timestamptz,
  add column cost_drift_note text check (char_length(cost_drift_note) <= 300);

-- Duração em segundos a partir de "5", "8s" ou 8.
create function public.duration_seconds(p_value jsonb) returns numeric
language sql immutable set search_path = public as $$
  select nullif(regexp_replace(coalesce(p_value #>> '{}', ''), '[^0-9.]', '', 'g'), '')::numeric;
$$;

-- Custo de uma operação pela tarifa e pelas configurações. Nulo quando não dá para saber
-- (tarifa incompleta, duração ausente, volume de tokens ainda não medido). Nunca inventa.
create function public.operation_cost_usd(p_pricing jsonb, p_params jsonb) returns numeric
language plpgsql immutable set search_path = public as $$
declare
  unit text := p_pricing ->> 'unit';
  images numeric;
  multiplier numeric;
  seconds numeric;
  rate numeric;
begin
  if p_pricing is null then return null; end if;
  if unit = 'image' then
    images := coalesce((p_params ->> 'num_images')::numeric, 1);
    multiplier := coalesce((p_pricing -> 'resolution_multipliers' ->> coalesce(p_params ->> 'resolution', '1K'))::numeric,
      case when p_params ? 'resolution' then null else 1 end);
    if multiplier is null then return null; end if;
    return round((p_pricing ->> 'usd')::numeric * images * multiplier, 6);
  elsif unit = 'second' then
    seconds := public.duration_seconds(p_params -> 'duration');
    rate := case when coalesce((p_params ->> 'generate_audio')::boolean, false)
      then (p_pricing ->> 'usd_audio')::numeric else (p_pricing ->> 'usd')::numeric end;
    if seconds is null or rate is null then return null; end if;
    return round(rate * seconds, 6);
  elsif unit = 'token' then
    return public.token_cost_usd(p_pricing, (p_pricing ->> 'est_input_tokens')::integer, (p_pricing ->> 'est_output_tokens')::integer);
  end if;
  return null;
end;
$$;

create function public.token_cost_usd(p_pricing jsonb, p_input_tokens integer, p_output_tokens integer) returns numeric
language sql immutable set search_path = public as $$
  select case when p_pricing ->> 'unit' = 'token' and p_input_tokens is not null and p_output_tokens is not null then
    round((p_input_tokens * (p_pricing ->> 'input_usd_per_mtok')::numeric + p_output_tokens * (p_pricing ->> 'output_usd_per_mtok')::numeric) / 1000000, 6)
  end;
$$;

-- Tarifa válida: unidade conhecida, números positivos, nada além do esperado.
create function public.valid_pricing(p_pricing jsonb) returns boolean
language plpgsql immutable set search_path = public as $$
declare
  key text;
begin
  if p_pricing is null or jsonb_typeof(p_pricing) <> 'object' then return false; end if;
  case p_pricing ->> 'unit'
    when 'image' then
      if jsonb_typeof(p_pricing -> 'usd') <> 'number' or (p_pricing ->> 'usd')::numeric not between 0.0001 and 50 then return false; end if;
      if p_pricing ? 'resolution_multipliers' then
        if jsonb_typeof(p_pricing -> 'resolution_multipliers') <> 'object' then return false; end if;
        for key in select jsonb_object_keys(p_pricing -> 'resolution_multipliers') loop
          if jsonb_typeof(p_pricing -> 'resolution_multipliers' -> key) <> 'number'
             or (p_pricing -> 'resolution_multipliers' ->> key)::numeric not between 0.1 and 10 then return false; end if;
        end loop;
      end if;
      return (select count(*) from jsonb_object_keys(p_pricing) k where k not in ('unit', 'usd', 'resolution_multipliers')) = 0;
    when 'second' then
      if jsonb_typeof(p_pricing -> 'usd') <> 'number' or (p_pricing ->> 'usd')::numeric not between 0.0001 and 20 then return false; end if;
      if p_pricing ? 'usd_audio' and (jsonb_typeof(p_pricing -> 'usd_audio') <> 'number' or (p_pricing ->> 'usd_audio')::numeric not between 0.0001 and 20) then
        return false;
      end if;
      return (select count(*) from jsonb_object_keys(p_pricing) k where k not in ('unit', 'usd', 'usd_audio')) = 0;
    when 'token' then
      if jsonb_typeof(p_pricing -> 'input_usd_per_mtok') <> 'number' or (p_pricing ->> 'input_usd_per_mtok')::numeric not between 0.01 and 500
         or jsonb_typeof(p_pricing -> 'output_usd_per_mtok') <> 'number' or (p_pricing ->> 'output_usd_per_mtok')::numeric not between 0.01 and 500 then
        return false;
      end if;
      for key in select unnest(array['est_input_tokens', 'est_output_tokens']) loop
        if p_pricing ? key and jsonb_typeof(p_pricing -> key) <> 'null'
           and (jsonb_typeof(p_pricing -> key) <> 'number' or (p_pricing ->> key)::numeric not between 1 and 1000000) then
          return false;
        end if;
      end loop;
      return (select count(*) from jsonb_object_keys(p_pricing) k
        where k not in ('unit', 'input_usd_per_mtok', 'output_usd_per_mtok', 'est_input_tokens', 'est_output_tokens')) = 0;
    else
      return false;
  end case;
end;
$$;

-- Custo confiável = tarifa cadastrada, custo calculado, conferido dentro do prazo e sem mudança no fornecedor.
create function public.model_cost_trusted(m public.models, settings public.pricing_settings) returns boolean
language sql stable set search_path = public as $$
  select m.provider_cost_usd is not null
    and m.cost_checked_at is not null
    and m.cost_checked_at >= now() - make_interval(days => settings.cost_stale_days)
    and m.cost_drift_at is null;
$$;

revoke execute on function public.duration_seconds(jsonb) from public, anon, authenticated;
revoke execute on function public.operation_cost_usd(jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.token_cost_usd(jsonb, integer, integer) from public, anon, authenticated;
revoke execute on function public.valid_pricing(jsonb) from public, anon, authenticated;
revoke execute on function public.model_cost_trusted(public.models, public.pricing_settings) from public, anon, authenticated;

-- Tarifas oficiais lidas nas páginas do fal e da Anthropic em 07/11/2026. Entram como cadastro,
-- não como conferência: `cost_checked_at` fica vazio até o admin confirmar no painel.
-- Texto: a tarifa por token é oficial, o volume por operação ainda não foi medido, então o custo fica nulo.
update public.models set
  pricing = '{"unit": "image", "usd": 0.08, "resolution_multipliers": {"0.5K": 0.75, "1K": 1, "2K": 1.5, "4K": 2}}',
  cost_source = 'https://fal.ai/models/fal-ai/nano-banana-2 (lido em 07/11/2026)'
where endpoint = 'fal-ai/nano-banana-2';
update public.models set
  pricing = '{"unit": "image", "usd": 0.08, "resolution_multipliers": {"1K": 1, "2K": 1.5, "4K": 2}}',
  cost_source = 'https://fal.ai/models/fal-ai/nano-banana-2/edit (lido em 07/11/2026)'
where endpoint = 'fal-ai/nano-banana-2/edit';
update public.models set
  pricing = '{"unit": "second", "usd": 0.084, "usd_audio": 0.126}',
  cost_source = 'https://fal.ai/models/fal-ai/kling-video/v3/standard/image-to-video (lido em 07/11/2026)'
where endpoint = 'fal-ai/kling-video/v3/standard/image-to-video';
update public.models set
  pricing = '{"unit": "second", "usd": 0.20, "usd_audio": 0.40}',
  cost_source = 'https://fal.ai/models/fal-ai/veo3.1/image-to-video (lido em 07/11/2026; o fal avisa remoção em 17/11/2026)'
where endpoint = 'fal-ai/veo3.1/image-to-video';
update public.models set
  pricing = '{"unit": "token", "input_usd_per_mtok": 4, "output_usd_per_mtok": 20, "est_input_tokens": null, "est_output_tokens": null}',
  cost_source = 'https://platform.claude.com/docs/en/about-claude/pricing (Claude Opus 5.5, tabela de 06/10/2026)'
where provider = 'anthropic' and endpoint = 'claude-opus-5-5';

update public.models set provider_cost_usd = public.operation_cost_usd(pricing, defaults), updated_at = now()
where pricing is not null and public.operation_cost_usd(pricing, defaults) is not null;

-- --------------------------------------------- trava na criação da geração

-- Vale para toda geração, venha de onde vier (Studio, assistente, Multiplicador): roda dentro da
-- mesma transação do `create_generation`, então a recusa desfaz a reserva junto.
create function public.enforce_model_cost_policy() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  settings public.pricing_settings;
  m public.models;
begin
  select * into settings from public.pricing_settings;
  select * into m from public.models where slug = new.model_slug;
  if m.slug is null then return new; end if;
  if settings.require_trusted_cost and not public.model_cost_trusted(m, settings) then
    raise exception 'model_cost_unverified';
  end if;
  if m.provider_cost_usd is not null and m.provider_cost_usd > settings.max_operation_cost_usd then
    raise exception 'operation_cost_above_cap';
  end if;
  return new;
end;
$$;
revoke execute on function public.enforce_model_cost_policy() from public, anon, authenticated;

create trigger generations_cost_policy before insert on public.generations
  for each row execute function public.enforce_model_cost_policy();

-- ------------------------------------------------ custo efetivo do texto

alter table public.generations
  add column actual_cost_usd numeric(10, 6) check (actual_cost_usd >= 0),
  add column input_tokens integer check (input_tokens >= 0),
  add column output_tokens integer check (output_tokens >= 0),
  add column cost_reconciled_at timestamptz;

-- Chamada pelas functions de texto depois da resposta: grava os tokens e o custo real. O custo real
-- passa a valer para a guarda de gasto (`spend_usd`); os créditos cobrados não mudam (nada retroativo).
create function public.record_text_usage(p_id uuid, p_input_tokens integer, p_output_tokens integer) returns numeric
language plpgsql security definer set search_path = public as $$
declare
  g public.generations;
  cost numeric;
begin
  if p_input_tokens is null or p_output_tokens is null or p_input_tokens < 0 or p_output_tokens < 0 then raise exception 'invalid_usage'; end if;
  select * into g from public.generations where id = p_id for update;
  if g.id is null then raise exception 'generation_not_found'; end if;
  if g.cost_reconciled_at is not null then return g.actual_cost_usd; end if;
  cost := public.token_cost_usd((select pricing from public.models where slug = g.model_slug), p_input_tokens, p_output_tokens);
  update public.generations
  set input_tokens = p_input_tokens, output_tokens = p_output_tokens, actual_cost_usd = cost,
      spend_usd = coalesce(round(cost, 4), spend_usd), cost_reconciled_at = now()
  where id = p_id;
  return cost;
end;
$$;
revoke execute on function public.record_text_usage(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.record_text_usage(uuid, integer, integer) to service_role;

-- -------------------------------------------- boas-vindas, uma vez por e-mail

-- Uma linha por e-mail normalizado que já recebeu boas-vindas. Apagar a conta e criar de novo
-- com o mesmo e-mail (ou com pontos e +apelido no Gmail) não dá crédito outra vez.
create table public.welcome_grants (
  email_hash text primary key,
  user_id uuid references auth.users (id) on delete set null,
  credits integer not null check (credits >= 0),
  granted_at timestamptz not null default now()
);
create index welcome_grants_recent on public.welcome_grants (granted_at desc);
alter table public.welcome_grants enable row level security;
revoke all on public.welcome_grants from anon, authenticated;

create function public.normalize_email(p_email text) returns text
language sql immutable set search_path = public as $$
  with parts as (
    select split_part(lower(trim(p_email)), '@', 1) as local, split_part(lower(trim(p_email)), '@', 2) as domain
  )
  select case
    when local = '' or domain = '' then null
    when domain in ('gmail.com', 'googlemail.com') then replace(split_part(local, '+', 1), '.', '') || '@gmail.com'
    else split_part(local, '+', 1) || '@' || domain
  end
  from parts;
$$;
revoke execute on function public.normalize_email(text) from public, anon, authenticated;

-- Concede as boas-vindas se a conta é elegível: e-mail confirmado, nunca usado antes e dentro do teto do dia.
create function public.grant_welcome_credits(p_user_id uuid, p_email text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  settings public.pricing_settings;
  hash text := encode(sha256(convert_to(coalesce(public.normalize_email(p_email), p_user_id::text), 'UTF8')), 'hex');
  today_start timestamptz := public.spend_day_start();
begin
  select * into settings from public.pricing_settings;
  if settings.welcome_credits <= 0 then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended('welcome-grant', 0));
  if exists (select 1 from public.welcome_grants where email_hash = hash) then return false; end if;
  if exists (select 1 from public.credit_ledger where user_id = p_user_id and reason = 'signup_bonus') then return false; end if;
  if (select count(*) from public.welcome_grants where granted_at >= today_start) >= settings.welcome_daily_cap then return false; end if;
  insert into public.welcome_grants (email_hash, user_id, credits) values (hash, p_user_id, settings.welcome_credits);
  perform public.wallet_move(p_user_id, 0, settings.welcome_credits, 'signup_bonus', 'Créditos de boas-vindas');
  return true;
end;
$$;
revoke execute on function public.grant_welcome_credits(uuid, text) from public, anon, authenticated;

-- Conta nova nasce sem crédito; as boas-vindas vêm quando o e-mail está confirmado (no cadastro,
-- para Google e e-mail sem confirmação; depois, no clique do link).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, username)
  values (new.id, left(nullif(new.raw_user_meta_data ->> 'display_name', ''), 80), public.unique_username(new.email));
  insert into public.credit_balances (user_id, balance, purchased_balance) values (new.id, 0, 0);
  insert into public.user_preferences (user_id) values (new.id);
  if new.email_confirmed_at is not null then
    perform public.grant_welcome_credits(new.id, new.email);
  end if;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create function public.handle_user_email_confirmed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    perform public.grant_welcome_credits(new.id, new.email);
  end if;
  return new;
end;
$$;
revoke execute on function public.handle_user_email_confirmed() from public, anon, authenticated;

create trigger on_auth_user_email_confirmed after update of email_confirmed_at on auth.users
  for each row execute function public.handle_user_email_confirmed();

-- Contas que já existem: o e-mail entra na lista para não receber boas-vindas de novo.
-- Nenhum crédito é concedido aqui.
insert into public.welcome_grants (email_hash, user_id, credits, granted_at)
select distinct on (hash) hash, u.id, coalesce(l.delta, 0), coalesce(l.created_at, now())
from auth.users u
cross join lateral (select encode(sha256(convert_to(coalesce(public.normalize_email(u.email), u.id::text), 'UTF8')), 'hex') as hash) h
left join public.credit_ledger l on l.user_id = u.id and l.reason = 'signup_bonus'
order by hash, l.created_at nulls last
on conflict (email_hash) do nothing;

-- ---------------------------------------------- planos: proposta comercial v3

alter table public.subscription_plans
  -- Itens que ainda não existem no produto: a vitrine mostra como "Em breve", sem data.
  add column soon_features text[] not null default '{}',
  -- O que o plano não tem, dito com clareza na vitrine.
  add column limits text[] not null default '{}',
  -- Texto da vitrine quando difere do que o app mostra (o Free, que segue no ar com o texto de hoje).
  add column storefront_features text[],
  -- Candidato à vitrine. Quem decide se aparece é `storefront_plans`: só à venda, por contato ou o Free.
  add column showcase boolean not null default false;

-- Os números (preço, créditos, exportações, usuários) saem das colunas; os textos não repetem número.
-- O Free está no ar: o texto do app (`features`) não muda; a vitrine usa o dela.
update public.subscription_plans set
  storefront_features = array['Créditos de boas-vindas, uma vez só', 'Créditos avulsos por Pix quando quiser'],
  limits = array['Sem modelos de vídeo premium', '1 personagem salvo'],
  showcase = true
where slug = 'gratis';

update public.subscription_plans set
  price_cents = 7990, monthly_credits = 2500, daily_credit_limit = 2500, monthly_credit_limit = 12500,
  features = array['Multiplicador de vídeos (até 5 variações por lote)', 'Gerador de imagens', 'Roteiros, ideias e copys', 'Formatos prontos por nicho', 'Biblioteca de projetos'],
  soon_features = '{}', limits = array['Sem geração de vídeo por IA', 'Até 2 personagens'],
  showcase = true, updated_at = now()
where slug = 'creator-start' and status = 'draft';

update public.subscription_plans set
  price_cents = 16990, monthly_credits = 6000, daily_credit_limit = 6000, monthly_credit_limit = 30000, highlight = true,
  features = array['Multiplicador em lote (até 10 variações)', 'Imagens e vídeos com IA (Kling 3.0)', 'UGC com roteiro e cenas', 'Personagens com o mesmo rosto', 'Até 3 marcas com público e tom'],
  soon_features = array['Legendas automáticas'], limits = array['Veo 3.1 só no Creator Max', 'Até 5 personagens'],
  showcase = true, updated_at = now()
where slug = 'creator-pro' and status = 'draft';

update public.subscription_plans set
  price_cents = 34990, monthly_credits = 13000, daily_credit_limit = 13000, monthly_credit_limit = 65000,
  features = array['Tudo do Creator Pro', 'Vídeo com fala e som (Veo 3.1)', 'Lotes de até 15 variações', '6 gerações ao mesmo tempo', 'Até 15 personagens e 10 marcas'],
  soon_features = array['Motion Control'], limits = array['Modelos premium consomem mais créditos por geração'],
  showcase = true, updated_at = now()
where slug = 'creator-max' and status = 'draft';

update public.subscription_plans set
  features = array['Conteúdo e planejamento com IA', 'Multiplicador de vídeos'],
  soon_features = array['CRM e pipeline comercial', 'Propostas comerciais', 'Landing pages básicas'], limits = '{}', showcase = true, updated_at = now()
where slug = 'business-start';
update public.subscription_plans set
  features = array['Tudo do Business Start', 'Vídeo com fala e som (Veo 3.1)'],
  soon_features = array['Prospecção e automações', 'Gestão de equipe e relatórios', 'Landing pages avançadas'], limits = '{}', showcase = true, updated_at = now()
where slug = 'business-pro';
update public.subscription_plans set
  features = array['Tudo do Business Pro', 'Múltiplos projetos e clientes'],
  soon_features = array['Permissões avançadas', 'Relatórios gerenciais'], limits = '{}', showcase = true, updated_at = now()
where slug = 'business-scale';
update public.subscription_plans set
  features = array['Créditos e usuários sob medida', 'Condições comerciais próprias'], soon_features = '{}', limits = '{}', showcase = true, updated_at = now()
where slug = 'enterprise';

-- Orçamento interno = créditos × R$ 0,01: o teto de custo de IA se o assinante usar tudo.
update public.plan_cost_budgets set ai_budget_cents = 2500, updated_at = now() where plan_slug = 'creator-start';
update public.plan_cost_budgets set ai_budget_cents = 6000, updated_at = now() where plan_slug = 'creator-pro';
update public.plan_cost_budgets set ai_budget_cents = 13000, updated_at = now() where plan_slug = 'creator-max';

-- Vitrine: a mesma tabela do checkout e do painel. Rascunho de venda direta nunca aparece; só
-- plano à venda, plano por contato e o Free. Quem lê não vê orçamento nem custo.
create function public.storefront_plans() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'welcome_credits', (select welcome_credits from public.pricing_settings),
    'credit_scale', (select credit_scale from public.pricing_settings),
    'plans', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', p.slug, 'line', p.line, 'name', case when p.slug = 'gratis' then 'Free' else p.name end, 'tagline', p.description,
        'price_cents', case when p.slug = 'enterprise' then null else p.price_cents end,
        'monthly_credits', case when p.slug = 'enterprise' then null else p.monthly_credits end,
        'exports_month', p.max_exports_month, 'seats', case when p.slug = 'enterprise' then null else p.max_seats end,
        'highlight', p.highlight, 'features', coalesce(p.storefront_features, p.features), 'soon_features', p.soon_features, 'limits', p.limits,
        'cta', case when p.slug = 'gratis' then 'signup' when p.contact_only then 'contact' else 'subscribe' end
      ) order by p.position)
      from public.subscription_plans p
      where p.showcase and (p.slug = 'gratis' or p.contact_only or (p.status = 'live' and p.public))
        and (p.line = 'business' or p.slug = 'gratis' or (select credit_scale from public.pricing_settings) = 2)
    ), '[]'::jsonb)
  );
$$;
revoke execute on function public.storefront_plans() from public;
grant execute on function public.storefront_plans() to anon, authenticated;

-- ----------------------------------------------- permissão de exceção

-- Ligar preço abaixo da meta de margem é decisão do dono: só `super_admin` tem `finance.override`.
create or replace function public.admin_role_permissions(p_role public.admin_role) returns text[]
language sql immutable set search_path = public as $$
  select case p_role
    when 'super_admin' then array[
      'dashboard.view', 'finance.view', 'users.view', 'users.manage', 'credits.adjust',
      'plans.view', 'plans.manage', 'models.view', 'models.manage', 'pricing.manage',
      'audit.view', 'admins.manage', 'finance.override'
    ]
    when 'admin' then array[
      'dashboard.view', 'users.view', 'users.manage', 'credits.adjust',
      'plans.view', 'models.view', 'models.manage', 'audit.view'
    ]
    when 'support' then array['dashboard.view', 'users.view']
    when 'finance' then array['dashboard.view', 'finance.view', 'users.view', 'plans.view', 'models.view']
    when 'analyst' then array['dashboard.view', 'plans.view', 'models.view']
  end;
$$;

-- ------------------------------------------------ economia por plano

-- Margem de contribuição com o plano usado por inteiro: todo crédito vira custo no orçamento
-- (sem descontar a reserva de segurança) e toda exportação é usada. Crédito de rascunho já é v2
-- (R$ 0,01); crédito de plano no ar antes da virada vale o custo médio atual × segurança.
create function public.plan_full_use_margin(p_price_cents integer, p_credits integer, p_exports integer, p_status text) returns numeric
language sql stable security definer set search_path = public as $$
  select case when p_price_cents <= 0 then null else round((
    p_price_cents
    - p_price_cents * (s.payment_fee_rate + f.tax_rate) - f.payment_fee_fixed_cents
    - p_credits * 100 * case when p_status = 'draft' or s.credit_scale = 2 then s.credit_budget_brl
        else s.legacy_cost_per_credit_brl * s.safety_factor end
    - coalesce(p_exports, 0) * f.render_cost_cents_per_export
    - f.storage_cents_per_subscriber - f.transfer_cents_per_subscriber - f.other_variable_cents_per_subscriber
  ) / p_price_cents, 4) end
  from public.pricing_settings s cross join public.finance_settings f;
$$;
revoke execute on function public.plan_full_use_margin(integer, integer, integer, text) from public, anon, authenticated;

-- Tudo que a calculadora e o comparativo precisam numa chamada.
create function public.admin_plan_economics() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  settings public.pricing_settings;
begin
  perform public.assert_admin_permission('finance.view');
  select * into settings from public.pricing_settings;
  return jsonb_build_object(
    'settings', jsonb_build_object(
      'usd_brl', settings.usd_brl, 'payment_fee_rate', settings.payment_fee_rate, 'credit_budget_brl', settings.credit_budget_brl,
      'safety_factor', settings.safety_factor, 'legacy_cost_per_credit_brl', settings.legacy_cost_per_credit_brl,
      'credit_scale', settings.credit_scale, 'welcome_credits', settings.welcome_credits, 'next_welcome_credits', settings.next_welcome_credits
    ),
    'finance', (select to_jsonb(f) - 'id' - 'updated_at' from public.finance_settings f),
    'plans', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', p.slug, 'name', p.name, 'line', p.line, 'status', p.status, 'public', p.public, 'contact_only', p.contact_only,
        'price_cents', p.price_cents, 'monthly_credits', p.monthly_credits, 'max_exports_month', p.max_exports_month,
        'ai_budget_cents', (select b.ai_budget_cents from public.plan_cost_budgets b where b.plan_slug = p.slug),
        'full_use_margin', public.plan_full_use_margin(p.price_cents, p.monthly_credits, p.max_exports_month, p.status)
      ) order by p.position)
      from public.subscription_plans p
    ), '[]'::jsonb),
    'models', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', m.slug, 'name', m.name, 'kind', m.kind, 'active', m.active, 'credits', m.credits,
        'provider_cost_usd', m.provider_cost_usd, 'trusted', public.model_cost_trusted(m, settings),
        'quoted_credits', case when m.provider_cost_usd is null then null
          else public.quote_credits(m.provider_cost_usd, m.credits, settings) end
      ) order by m.position)
      from public.models m
    ), '[]'::jsonb)
  );
end;
$$;

-- Ajusta um plano em rascunho (preço, créditos, exportações, orçamento). Plano no ar não muda por aqui.
create function public.admin_update_draft_plan(
  p_slug text, p_price_cents integer, p_monthly_credits integer, p_max_exports_month integer, p_ai_budget_cents integer, p_reason text
) returns public.subscription_plans
language plpgsql security definer set search_path = public as $$
declare
  admin_id uuid := public.assert_admin_permission('plans.manage');
  before public.subscription_plans;
  after public.subscription_plans;
begin
  perform public.assert_admin_permission('pricing.manage');
  if p_reason is null or char_length(trim(p_reason)) < 5 then raise exception 'reason_required'; end if;
  select * into before from public.subscription_plans where slug = p_slug for update;
  if before.slug is null then raise exception 'plan_not_found'; end if;
  if before.status <> 'draft' then raise exception 'plan_not_draft'; end if;
  if p_price_cents is null or p_price_cents not between 0 and 10000000
     or p_monthly_credits is null or p_monthly_credits not between 0 and 1000000
     or (p_max_exports_month is not null and p_max_exports_month not between 0 and 100000)
     or p_ai_budget_cents is null or p_ai_budget_cents not between 0 and 10000000 then
    raise exception 'invalid_plan_values';
  end if;

  update public.subscription_plans
  set price_cents = p_price_cents, monthly_credits = p_monthly_credits, max_exports_month = p_max_exports_month,
      daily_credit_limit = case when p_monthly_credits > 0 then p_monthly_credits else daily_credit_limit end,
      monthly_credit_limit = case when p_monthly_credits > 0 then p_monthly_credits * 5 else monthly_credit_limit end,
      updated_at = now()
  where slug = p_slug
  returning * into after;
  insert into public.plan_cost_budgets (plan_slug, ai_budget_cents) values (p_slug, p_ai_budget_cents)
  on conflict (plan_slug) do update set ai_budget_cents = excluded.ai_budget_cents, updated_at = now();

  perform public.admin_log(admin_id, 'plan.draft_update', null, p_slug, jsonb_build_object(
    'before', jsonb_build_object('price_cents', before.price_cents, 'monthly_credits', before.monthly_credits, 'max_exports_month', before.max_exports_month),
    'after', jsonb_build_object('price_cents', after.price_cents, 'monthly_credits', after.monthly_credits, 'max_exports_month', after.max_exports_month,
      'ai_budget_cents', p_ai_budget_cents, 'full_use_margin', public.plan_full_use_margin(after.price_cents, after.monthly_credits, after.max_exports_month, after.status))
  ), trim(p_reason));
  return after;
end;
$$;

-- --------------------------------------------------- tarifa pelo painel

-- Cadastra (ou corrige) a tarifa do fornecedor e confirma a conferência de uma vez. O custo por operação
-- é recalculado; depois da virada, o preço em créditos também, para os pedidos novos. O que já foi
-- autorizado continua com o custo e os créditos gravados na geração.
create function public.admin_set_model_tariff(p_slug text, p_pricing jsonb, p_source text) returns public.models
language plpgsql security definer set search_path = public as $$
declare
  admin_id uuid := public.assert_admin_permission('models.manage');
  settings public.pricing_settings;
  before public.models;
  after public.models;
  cost numeric;
begin
  if not public.valid_pricing(p_pricing) then raise exception 'invalid_pricing'; end if;
  if p_source is null or char_length(trim(p_source)) < 5 then raise exception 'source_required'; end if;
  select * into settings from public.pricing_settings;
  select * into before from public.models where slug = p_slug for update;
  if before.slug is null then raise exception 'model_not_found'; end if;
  if (p_pricing ->> 'unit' = 'token') <> (before.kind = 'text') then raise exception 'invalid_pricing'; end if;

  cost := public.operation_cost_usd(p_pricing, before.defaults);
  update public.models
  set pricing = p_pricing,
      provider_cost_usd = round(cost, 4),
      cost_source = left(trim(p_source), 300),
      cost_checked_at = case when cost is null then null else now() end,
      cost_drift_at = null, cost_drift_note = null,
      credits = case when settings.credit_scale = 2 and cost is not null then public.quote_credits(cost, credits, settings) else credits end,
      updated_at = now()
  where slug = p_slug
  returning * into after;

  perform public.admin_log(admin_id, 'model.tariff', null, p_slug, jsonb_build_object(
    'before', jsonb_build_object('pricing', before.pricing, 'cost', before.provider_cost_usd, 'credits', before.credits),
    'after', jsonb_build_object('pricing', after.pricing, 'cost', after.provider_cost_usd, 'credits', after.credits),
    'source', after.cost_source), null);
  return after;
end;
$$;

-- Resultado da checagem no fornecedor (function `pricing-check`, API de preço do fal). Preço diferente
-- do guardado marca o modelo: ele deixa de ser confiável e, com a trava ligada, para de gerar.
create function public.admin_record_price_check(p_checks jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  admin_id uuid := public.assert_admin_permission('models.manage');
  settings public.pricing_settings;
  check_row jsonb;
  m public.models;
  observed numeric;
  known numeric[];
  matches boolean;
  results jsonb := '[]'::jsonb;
begin
  if p_checks is null or jsonb_typeof(p_checks) <> 'array' or jsonb_array_length(p_checks) > 50 then raise exception 'invalid_checks'; end if;
  select * into settings from public.pricing_settings;
  for check_row in select * from jsonb_array_elements(p_checks) loop
    observed := (check_row ->> 'unit_price')::numeric;
    for m in select * from public.models where provider = 'fal' and endpoint = check_row ->> 'endpoint_id' for update loop
      known := array_remove(array[(m.pricing ->> 'usd')::numeric, (m.pricing ->> 'usd_audio')::numeric], null);
      matches := coalesce(check_row ->> 'currency', 'USD') = 'USD' and observed is not null and exists (
        select 1 from unnest(known) k where abs(k - observed) <= k * settings.price_drift_tolerance
      );
      if not matches then
        update public.models
        set cost_drift_at = now(),
            cost_drift_note = left(format('Fornecedor: %s %s por %s; guardado: %s', observed, coalesce(check_row ->> 'currency', '?'),
              coalesce(check_row ->> 'unit', '?'), array_to_string(known, ' / ')), 300),
            updated_at = now()
        where slug = m.slug;
      end if;
      results := results || jsonb_build_object('slug', m.slug, 'observed', observed, 'stored', to_jsonb(known), 'matches', matches);
    end loop;
  end loop;
  perform public.admin_log(admin_id, 'model.price_check', null, null, jsonb_build_object('results', results), null);
  return results;
end;
$$;

-- Teto por operação, boas-vindas da virada e proteção de cadastro.
create function public.admin_update_cost_guard(
  p_max_operation_cost_usd numeric, p_next_welcome_credits integer, p_welcome_daily_cap integer, p_price_drift_tolerance numeric
) returns public.pricing_settings
language plpgsql security definer set search_path = public as $$
declare
  admin_id uuid := public.assert_admin_permission('pricing.manage');
  before public.pricing_settings;
  after public.pricing_settings;
begin
  select * into before from public.pricing_settings for update;
  update public.pricing_settings
  set max_operation_cost_usd = p_max_operation_cost_usd, next_welcome_credits = p_next_welcome_credits,
      welcome_daily_cap = p_welcome_daily_cap, price_drift_tolerance = p_price_drift_tolerance, updated_at = now()
  returning * into after;
  perform public.admin_log(admin_id, 'pricing.cost_guard', null, null, jsonb_build_object(
    'before', jsonb_build_object('max_operation_cost_usd', before.max_operation_cost_usd, 'next_welcome_credits', before.next_welcome_credits,
      'welcome_daily_cap', before.welcome_daily_cap, 'price_drift_tolerance', before.price_drift_tolerance),
    'after', jsonb_build_object('max_operation_cost_usd', after.max_operation_cost_usd, 'next_welcome_credits', after.next_welcome_credits,
      'welcome_daily_cap', after.welcome_daily_cap, 'price_drift_tolerance', after.price_drift_tolerance)), null);
  return after;
end;
$$;

-- As premissas ganham os custos variáveis por assinante e a taxa fixa por cobrança.
drop function public.admin_update_finance_settings(numeric, integer, integer, integer, integer, integer, numeric, numeric);
create function public.admin_update_finance_settings(
  p_tax_rate numeric, p_fixed_costs_cents integer, p_infra_costs_cents integer, p_storage_costs_cents integer,
  p_render_cost_cents_per_export integer, p_pro_labore_cents integer, p_reserve_rate numeric, p_min_margin_rate numeric,
  p_payment_fee_fixed_cents integer default 0, p_storage_cents_per_subscriber integer default 0,
  p_transfer_cents_per_subscriber integer default 0, p_other_variable_cents_per_subscriber integer default 0
) returns public.finance_settings
language plpgsql security definer set search_path = public as $$
declare
  admin_id uuid := public.assert_admin_permission('pricing.manage');
  before public.finance_settings;
  after public.finance_settings;
begin
  select * into before from public.finance_settings for update;
  update public.finance_settings
  set tax_rate = p_tax_rate, fixed_costs_cents = p_fixed_costs_cents, infra_costs_cents = p_infra_costs_cents,
      storage_costs_cents = p_storage_costs_cents, render_cost_cents_per_export = p_render_cost_cents_per_export,
      pro_labore_cents = p_pro_labore_cents, reserve_rate = p_reserve_rate, min_margin_rate = p_min_margin_rate,
      payment_fee_fixed_cents = p_payment_fee_fixed_cents, storage_cents_per_subscriber = p_storage_cents_per_subscriber,
      transfer_cents_per_subscriber = p_transfer_cents_per_subscriber, other_variable_cents_per_subscriber = p_other_variable_cents_per_subscriber,
      updated_at = now()
  returning * into after;
  perform public.admin_log(admin_id, 'finance.settings', null, null,
    jsonb_build_object('before', to_jsonb(before) - 'updated_at', 'after', to_jsonb(after) - 'updated_at'), null);
  return after;
end;
$$;

-- ------------------------------------------------- checagem da virada

create table public.pricing_v2_snapshots (
  id uuid primary key default gen_random_uuid(),
  factor numeric(10, 4) not null,
  settings jsonb not null,
  models jsonb not null,
  plans jsonb not null,
  packs jsonb not null,
  subscriptions jsonb not null,
  activated_by uuid,
  activated_at timestamptz not null default now(),
  rolled_back_at timestamptz,
  rolled_back_by uuid
);
alter table public.pricing_v2_snapshots enable row level security;
revoke all on public.pricing_v2_snapshots from anon, authenticated;

-- Tudo o que a virada vai mexer, antes de mexer: saldos por balde, boas-vindas já dadas, reservas
-- abertas, assinaturas por plano, pacotes, impacto por modelo e margem dos planos novos.
create function public.admin_pricing_v2_preflight() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  settings public.pricing_settings;
  factor numeric;
  target numeric := (select min_margin_rate from public.finance_settings);
  blockers text[] := '{}';
  warnings text[] := '{}';
  untrusted integer;
  below integer;
begin
  perform public.assert_admin_permission('pricing.manage');
  select * into settings from public.pricing_settings;
  factor := settings.legacy_cost_per_credit_brl * settings.safety_factor / settings.credit_budget_brl;

  if settings.credit_scale = 2 then blockers := array_append(blockers, 'already_activated'); end if;
  if not settings.generation_paused then blockers := array_append(blockers, 'pause_required'); end if;
  if exists (select 1 from public.generations where status in ('queued', 'running'))
     or exists (select 1 from public.credit_reservations where status = 'held') then
    blockers := array_append(blockers, 'open_generations');
  end if;
  select count(*) into untrusted from public.models m where m.active and not public.model_cost_trusted(m, settings);
  if untrusted > 0 then blockers := array_append(blockers, 'unverified_models'); end if;
  select count(*) into below from public.subscription_plans p
  where p.line = 'creator' and p.status = 'draft' and not p.contact_only
    and coalesce(public.plan_full_use_margin(p.price_cents, p.monthly_credits, p.max_exports_month, p.status), 0) < target;
  if below > 0 then warnings := array_append(warnings, 'margin_below_target'); end if;
  if exists (select 1 from public.models m where m.active and m.provider_cost_usd > settings.max_operation_cost_usd) then
    warnings := array_append(warnings, 'operation_above_cap');
  end if;

  return jsonb_build_object(
    'factor', round(factor, 4),
    'target_margin', target,
    'next_welcome_credits', settings.next_welcome_credits,
    'blockers', to_jsonb(blockers),
    'warnings', to_jsonb(warnings),
    'wallets', (select jsonb_build_object(
      'accounts', count(*) filter (where balance > 0),
      'subscription_credits', coalesce(sum(subscription_balance), 0),
      'purchased_credits', coalesce(sum(purchased_balance), 0),
      'subscription_after', coalesce(sum(floor(subscription_balance * factor)), 0),
      'purchased_after', coalesce(sum(floor(purchased_balance * factor)), 0)
    ) from public.credit_balances),
    'welcome_granted', (select jsonb_build_object('accounts', count(*), 'credits', coalesce(sum(delta), 0))
      from public.credit_ledger where reason = 'signup_bonus'),
    'held', (select jsonb_build_object('reservations', count(*), 'credits', coalesce(sum(amount), 0))
      from public.credit_reservations where status = 'held'),
    'open_generations', (select count(*) from public.generations where status in ('queued', 'running')),
    'subscriptions', coalesce((
      select jsonb_agg(jsonb_build_object('plan_slug', plan_slug, 'status', status, 'count', total, 'monthly_credits', credits,
        'monthly_credits_after', credits_after) order by plan_slug, status)
      from (
        select plan_slug, status::text as status, count(*) as total, sum(monthly_credits) as credits, sum(floor(monthly_credits * factor)) as credits_after
        from public.subscriptions where status in ('pending', 'active', 'past_due', 'canceled') group by plan_slug, status
      ) s
    ), '[]'::jsonb),
    'packs', coalesce((
      select jsonb_agg(jsonb_build_object('slug', slug, 'name', name, 'price_cents', price_cents, 'credits', credits,
        'credits_after', floor(credits * factor)) order by position)
      from public.credit_packs
    ), '[]'::jsonb),
    'models', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', m.slug, 'name', m.name, 'active', m.active, 'trusted', public.model_cost_trusted(m, settings),
        'drift', m.cost_drift_note, 'credits', m.credits, 'provider_cost_usd', m.provider_cost_usd,
        'credits_after', case when m.provider_cost_usd is null then null else public.quote_credits(m.provider_cost_usd, m.credits, settings) end,
        -- Quanto um crédito de hoje compra nesse modelo, contra a régua da conversão.
        'legacy_brl_per_credit', case when m.provider_cost_usd is null or m.credits = 0 then null
          else round(m.provider_cost_usd * settings.usd_brl / m.credits, 4) end
      ) order by m.position)
      from public.models m
    ), '[]'::jsonb),
    'plans', coalesce((
      select jsonb_agg(jsonb_build_object('slug', p.slug, 'name', p.name, 'price_cents', p.price_cents, 'monthly_credits', p.monthly_credits,
        'full_use_margin', public.plan_full_use_margin(p.price_cents, p.monthly_credits, p.max_exports_month, p.status)) order by p.position)
      from public.subscription_plans p where p.line = 'creator' and p.status = 'draft' and not p.contact_only
    ), '[]'::jsonb)
  );
end;
$$;

-- ------------------------------------------------------------ a virada

-- Mesma virada da 0018, com quatro travas novas: todo modelo ativo com custo confiável, boas-vindas
-- vindas da proposta (`next_welcome_credits`), margem abaixo da meta só com `finance.override` e
-- aceite explícito, e uma foto de tudo antes de mexer (para a volta). Liga a trava de custo.
drop function public.admin_activate_pricing_v2(integer, text);
create function public.admin_activate_pricing_v2(p_reason text, p_accept_below_target boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  admin_id uuid := public.assert_admin_permission('pricing.manage');
  settings public.pricing_settings;
  factor numeric;
  target numeric := (select min_margin_rate from public.finance_settings);
  wallet record;
  converted integer := 0;
  below text[];
  snapshot_id uuid;
begin
  perform public.assert_admin_permission('plans.manage');
  if p_reason is null or char_length(trim(p_reason)) < 10 then raise exception 'activation_reason_required'; end if;

  select * into settings from public.pricing_settings for update;
  if settings.credit_scale = 2 then raise exception 'already_activated'; end if;
  if not settings.generation_paused then raise exception 'pause_required'; end if;
  if exists (select 1 from public.generations where status in ('queued', 'running'))
     or exists (select 1 from public.credit_reservations where status = 'held') then
    raise exception 'open_generations';
  end if;
  if exists (select 1 from public.models m where m.active and not public.model_cost_trusted(m, settings)) then
    raise exception 'unverified_models';
  end if;
  select coalesce(array_agg(slug), '{}') into below from public.subscription_plans p
  where p.line = 'creator' and p.status = 'draft' and not p.contact_only
    and coalesce(public.plan_full_use_margin(p.price_cents, p.monthly_credits, p.max_exports_month, p.status), 0) < target;
  if cardinality(below) > 0 then
    if not coalesce(p_accept_below_target, false) then raise exception 'margin_below_target'; end if;
    perform public.assert_admin_permission('finance.override');
  end if;

  factor := settings.legacy_cost_per_credit_brl * settings.safety_factor / settings.credit_budget_brl;

  insert into public.pricing_v2_snapshots (factor, settings, models, plans, packs, subscriptions, activated_by)
  values (
    round(factor, 4),
    to_jsonb(settings),
    (select jsonb_agg(jsonb_build_object('slug', slug, 'credits', credits)) from public.models),
    (select jsonb_agg(jsonb_build_object('slug', slug, 'monthly_credits', monthly_credits, 'daily_credit_limit', daily_credit_limit,
      'monthly_credit_limit', monthly_credit_limit, 'status', status, 'public', public, 'highlight', highlight, 'active', active))
      from public.subscription_plans),
    coalesce((select jsonb_agg(jsonb_build_object('slug', slug, 'credits', credits)) from public.credit_packs), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('id', id, 'monthly_credits', monthly_credits)) from public.subscriptions
      where status in ('pending', 'active', 'past_due', 'canceled')), '[]'::jsonb),
    admin_id
  )
  returning id into snapshot_id;

  update public.models set credits = public.quote_credits(provider_cost_usd, credits, settings), updated_at = now();

  for wallet in select user_id, subscription_balance, purchased_balance from public.credit_balances where balance > 0 for update loop
    perform public.wallet_move(
      wallet.user_id,
      floor(wallet.subscription_balance * factor)::integer - wallet.subscription_balance,
      floor(wallet.purchased_balance * factor)::integer - wallet.purchased_balance,
      'adjustment', 'Conversão para a nova escala de créditos (mesmo poder de compra)',
      null, null, null, null, admin_id, 'pricing-v2-scale:' || snapshot_id::text || ':' || wallet.user_id::text
    );
    converted := converted + 1;
  end loop;

  update public.subscriptions set monthly_credits = floor(monthly_credits * factor)::integer, updated_at = now()
  where status in ('pending', 'active', 'past_due', 'canceled');
  update public.subscription_plans
  set monthly_credits = floor(monthly_credits * factor)::integer,
      daily_credit_limit = floor(daily_credit_limit * factor)::integer,
      monthly_credit_limit = floor(monthly_credit_limit * factor)::integer,
      status = case when slug = 'gratis' then 'live' else 'legacy' end,
      public = false, highlight = false, showcase = (slug = 'gratis'), updated_at = now()
  where status = 'live';
  update public.credit_packs set credits = floor(credits * factor)::integer;

  update public.subscription_plans set status = 'live', active = true, public = true, updated_at = now()
  where line = 'creator' and status = 'draft' and not contact_only;

  update public.pricing_settings
  set credit_scale = 2, scale_activated_at = now(), welcome_credits = settings.next_welcome_credits, require_trusted_cost = true,
      credit_value_brl = coalesce((select min(price_cents / 100.0 / monthly_credits) from public.subscription_plans
        where status = 'live' and public and monthly_credits > 0), credit_value_brl),
      updated_at = now();

  perform public.admin_log(admin_id, 'pricing.activate_v2', null, null, jsonb_build_object(
    'factor', round(factor, 4), 'wallets', converted, 'welcome_credits', settings.next_welcome_credits,
    'snapshot', snapshot_id, 'below_target_accepted', to_jsonb(below)), trim(p_reason));
  return jsonb_build_object('factor', round(factor, 4), 'wallets', converted, 'snapshot', snapshot_id);
end;
$$;

-- Volta da virada. Só enquanto ninguém assinou um plano novo: divide os saldos pelo mesmo fator
-- (arredondando a favor da pessoa) e devolve modelos, planos, pacotes, assinaturas e parâmetros à foto.
create function public.admin_rollback_pricing_v2(p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  admin_id uuid := public.assert_admin_permission('pricing.manage');
  settings public.pricing_settings;
  snap public.pricing_v2_snapshots;
  wallet record;
  item jsonb;
  converted integer := 0;
begin
  perform public.assert_admin_permission('plans.manage');
  if p_reason is null or char_length(trim(p_reason)) < 10 then raise exception 'rollback_reason_required'; end if;
  select * into settings from public.pricing_settings for update;
  if settings.credit_scale <> 2 then raise exception 'not_activated'; end if;
  if not settings.generation_paused then raise exception 'pause_required'; end if;
  if exists (select 1 from public.generations where status in ('queued', 'running'))
     or exists (select 1 from public.credit_reservations where status = 'held') then
    raise exception 'open_generations';
  end if;
  select * into snap from public.pricing_v2_snapshots where rolled_back_at is null order by activated_at desc limit 1 for update;
  if snap.id is null then raise exception 'snapshot_not_found'; end if;
  if exists (
    select 1 from public.subscriptions s join public.subscription_plans p on p.slug = s.plan_slug
    where p.line = 'creator' and p.slug in (select x ->> 'slug' from jsonb_array_elements(snap.plans) x where x ->> 'status' = 'draft')
      and s.status in ('pending', 'active', 'past_due')
  ) then
    raise exception 'v2_subscribers_exist';
  end if;

  for wallet in select user_id, subscription_balance, purchased_balance from public.credit_balances where balance > 0 for update loop
    perform public.wallet_move(
      wallet.user_id,
      ceil(wallet.subscription_balance / snap.factor)::integer - wallet.subscription_balance,
      ceil(wallet.purchased_balance / snap.factor)::integer - wallet.purchased_balance,
      'adjustment', 'Volta para a escala anterior de créditos (mesmo poder de compra)',
      null, null, null, null, admin_id, 'pricing-v2-rollback:' || snap.id::text || ':' || wallet.user_id::text
    );
    converted := converted + 1;
  end loop;

  for item in select * from jsonb_array_elements(snap.models) loop
    update public.models set credits = (item ->> 'credits')::integer, updated_at = now() where slug = item ->> 'slug';
  end loop;
  for item in select * from jsonb_array_elements(snap.plans) loop
    update public.subscription_plans
    set monthly_credits = (item ->> 'monthly_credits')::integer,
        daily_credit_limit = (item ->> 'daily_credit_limit')::integer,
        monthly_credit_limit = (item ->> 'monthly_credit_limit')::integer,
        public = false, status = item ->> 'status', highlight = (item ->> 'highlight')::boolean, active = (item ->> 'active')::boolean,
        updated_at = now()
    where slug = item ->> 'slug';
  end loop;
  -- `public` volta por último: a constraint só deixa público o que está `live`.
  for item in select * from jsonb_array_elements(snap.plans) where (value ->> 'public')::boolean loop
    update public.subscription_plans set public = true where slug = item ->> 'slug';
  end loop;
  update public.subscription_plans set showcase = true where line = 'creator' and status = 'draft' and slug like 'creator-%';
  for item in select * from jsonb_array_elements(snap.packs) loop
    update public.credit_packs set credits = (item ->> 'credits')::integer where slug = item ->> 'slug';
  end loop;
  for item in select * from jsonb_array_elements(snap.subscriptions) loop
    update public.subscriptions set monthly_credits = (item ->> 'monthly_credits')::integer, updated_at = now() where id = (item ->> 'id')::uuid;
  end loop;

  update public.pricing_settings
  set credit_scale = 1, scale_activated_at = null,
      welcome_credits = (snap.settings ->> 'welcome_credits')::integer,
      credit_value_brl = (snap.settings ->> 'credit_value_brl')::numeric,
      require_trusted_cost = (snap.settings ->> 'require_trusted_cost')::boolean,
      updated_at = now();
  update public.pricing_v2_snapshots set rolled_back_at = now(), rolled_back_by = admin_id where id = snap.id;

  perform public.admin_log(admin_id, 'pricing.rollback_v2', null, null,
    jsonb_build_object('snapshot', snap.id, 'factor', snap.factor, 'wallets', converted), trim(p_reason));
  return jsonb_build_object('snapshot', snap.id, 'wallets', converted);
end;
$$;

-- ------------------------------------------- cotação e financeiro, com v3

-- A cotação passa a dizer de onde vem cada custo (tarifa, confiável, mudança no fornecedor).
-- Sem tarifa, não há cotação: o modelo fica sem preço v2 até o admin cadastrar.
create or replace function public.admin_model_quotes() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  settings public.pricing_settings;
begin
  perform public.assert_admin_permission('models.view');
  select * into settings from public.pricing_settings;
  return jsonb_build_object(
    'settings', jsonb_build_object(
      'usd_brl', settings.usd_brl, 'safety_factor', settings.safety_factor, 'credit_budget_brl', settings.credit_budget_brl,
      'legacy_cost_per_credit_brl', settings.legacy_cost_per_credit_brl, 'cost_stale_days', settings.cost_stale_days,
      'credit_scale', settings.credit_scale, 'scale_activated_at', settings.scale_activated_at,
      'welcome_credits', settings.welcome_credits, 'next_welcome_credits', settings.next_welcome_credits,
      'require_trusted_cost', settings.require_trusted_cost, 'max_operation_cost_usd', settings.max_operation_cost_usd,
      'welcome_daily_cap', settings.welcome_daily_cap, 'price_drift_tolerance', settings.price_drift_tolerance
    ),
    'models', coalesce((
      select jsonb_agg(row_to_json(r) order by r.position)
      from (
        select m.slug, m.name, m.kind, m.provider, m.endpoint, m.defaults, m.active, m.position, m.credits,
          m.provider_cost_usd, m.cost_checked_at, m.cost_source, m.pricing, m.cost_drift_at, m.cost_drift_note,
          case when m.provider_cost_usd is null then 'legacy_estimate' else 'provider_cost' end as basis,
          round(public.model_estimated_brl(m.provider_cost_usd, m.credits, settings), 4) as estimated_brl,
          round(public.model_estimated_brl(m.provider_cost_usd, m.credits, settings) * settings.safety_factor, 4) as protected_brl,
          greatest(1, ceil(round(public.model_estimated_brl(m.provider_cost_usd, m.credits, settings) * settings.safety_factor
            / settings.credit_budget_brl, 6)))::integer as quoted_credits,
          (m.cost_checked_at is null or m.cost_checked_at < now() - make_interval(days => settings.cost_stale_days)) as stale,
          public.model_cost_trusted(m, settings) as trusted,
          (select round(avg(g.input_tokens)) from public.generations g where g.model_slug = m.slug and g.cost_reconciled_at is not null) as avg_input_tokens,
          (select round(avg(g.output_tokens)) from public.generations g where g.model_slug = m.slug and g.cost_reconciled_at is not null) as avg_output_tokens,
          (select max(g.output_tokens) from public.generations g where g.model_slug = m.slug and g.cost_reconciled_at is not null) as max_output_tokens,
          (select count(*) from public.generations g where g.model_slug = m.slug and g.cost_reconciled_at is not null) as reconciled
        from public.models m
      ) r
    ), '[]'::jsonb)
  );
end;
$$;

-- O financeiro ganha consumo de créditos, custo real × estimado, exportações por resultado e por
-- resolução, e o orçamento e a margem de cada plano.
create or replace function public.admin_finance(p_from timestamptz, p_to timestamptz) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  span interval;
  prev_from timestamptz;
  settings public.pricing_settings;
  result jsonb;
begin
  perform public.assert_admin_permission('finance.view');
  if p_from is null or p_to is null or p_from >= p_to or p_to - p_from > interval '400 days' then
    raise exception 'invalid_period';
  end if;
  span := p_to - p_from;
  prev_from := p_from - span;
  select * into settings from public.pricing_settings;

  with
  billed as (
    select g.* from public.generations g
    where g.created_at >= p_from and g.created_at < p_to and (g.status = 'succeeded' or g.billed_on_failure)
  ),
  live as (
    select s.* from public.subscriptions s
    where s.status in ('active', 'past_due') and s.current_period_end + interval '3 days' > now()
  ),
  received as (
    select p.user_id, s.plan_slug, p.amount_cents as cents, p.paid_at as at
    from public.subscription_payments p join public.subscriptions s on s.id = p.subscription_id
    where p.status = 'confirmed'
    union all
    select user_id, null, price_cents, paid_at from public.purchases where status = 'paid'
  ),
  user_costs as (
    select g.user_id, sum(g.spend_usd) as cost_usd, sum(g.credits) as credits, count(*) as generations
    from billed g group by g.user_id
  ),
  exports as (
    select * from public.multiplier_exports where created_at >= p_from and created_at < p_to
  )
  select jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to, 'days', round(extract(epoch from span) / 86400.0, 2)),
    'usd_brl', settings.usd_brl,
    'payment_fee_rate', settings.payment_fee_rate,
    'credit_scale', settings.credit_scale,
    'credit_budget_brl', settings.credit_budget_brl,
    'settings', (select to_jsonb(f) - 'id' - 'updated_at' from public.finance_settings f),
    'revenue_cents', (select coalesce(sum(cents), 0) from received where at >= p_from and at < p_to),
    'revenue_previous_cents', (select coalesce(sum(cents), 0) from received where at >= prev_from and at < p_from),
    'refunds_cents', (select coalesce(sum(amount_cents), 0) from public.subscription_payments
        where status = 'refunded' and paid_at >= p_from and paid_at < p_to)
      + (select coalesce(sum(price_cents), 0) from public.purchases where status = 'refunded' and created_at >= p_from and created_at < p_to),
    'mrr_cents', (select coalesce(sum(price_cents), 0) from live),
    'active_subscriptions', (select count(*) from live),
    'api_cost_usd', (select coalesce(sum(spend_usd), 0) from billed),
    'api_cost_previous_usd', (select coalesce(sum(spend_usd), 0) from public.generations
      where created_at >= prev_from and created_at < p_from and (status = 'succeeded' or billed_on_failure)),
    'api_cost_estimated_count', (select count(*) from billed where provider_cost_usd is null and cost_reconciled_at is null),
    'failed_billed_usd', (select coalesce(sum(spend_usd), 0) from billed where status = 'failed'),
    'credits_consumed', (select coalesce(sum(credits), 0) from billed where status = 'succeeded'),
    'exports_done', (select count(*) from exports where status = 'done'),
    'exports_failed', (select count(*) from exports where status = 'failed'),
    'export_render_ms', (select coalesce(sum(render_ms), 0) from exports where status = 'done'),
    'export_bytes', (select coalesce(sum(bytes), 0) from exports where status = 'done'),
    'export_seconds', (select coalesce(sum(duration_seconds), 0) from exports where status = 'done'),
    'export_resolutions', coalesce((
      select jsonb_object_agg(resolution, total) from (
        select width || 'x' || height as resolution, count(*) as total from exports
        where status = 'done' and width is not null and height is not null group by 1
      ) r
    ), '{}'::jsonb),
    'by_plan', coalesce((
      select jsonb_agg(row_to_json(r) order by r.position)
      from (
        select p.slug, p.name, p.line, p.status, p.position, p.price_cents, p.monthly_credits, p.max_exports_month,
          (select b.ai_budget_cents from public.plan_cost_budgets b where b.plan_slug = p.slug) as ai_budget_cents,
          public.plan_full_use_margin(p.price_cents, p.monthly_credits, p.max_exports_month, p.status) as full_use_margin,
          (select count(*) from live l where l.plan_slug = p.slug) as subscribers,
          (select coalesce(sum(l.price_cents), 0) from live l where l.plan_slug = p.slug) as mrr_cents,
          (select coalesce(sum(x.cents), 0) from received x where x.plan_slug = p.slug and x.at >= p_from and x.at < p_to) as revenue_cents
        from public.subscription_plans p
        where p.status <> 'draft' or p.line = 'creator' or exists (select 1 from live l where l.plan_slug = p.slug)
      ) r
    ), '[]'::jsonb),
    'by_user', coalesce((
      select jsonb_agg(row_to_json(r) order by r.cost_usd desc)
      from (
        select uc.user_id, u.email::text as email, plan.slug as plan_slug,
          (select b.ai_budget_cents from public.plan_cost_budgets b where b.plan_slug = plan.slug) as ai_budget_cents,
          uc.credits, uc.generations, round(uc.cost_usd, 4) as cost_usd,
          (select coalesce(sum(cents), 0) from received x where x.user_id = uc.user_id and x.at >= p_from and x.at < p_to) as revenue_cents,
          (select count(*) from exports e where e.user_id = uc.user_id and e.status = 'done') as exports
        from user_costs uc
        join auth.users u on u.id = uc.user_id
        cross join lateral public.effective_plan(uc.user_id) plan
        order by uc.cost_usd desc
        limit 50
      ) r
    ), '[]'::jsonb),
    'by_model', coalesce((
      select jsonb_agg(row_to_json(r) order by r.cost_usd desc)
      from (
        select m.slug, m.name, m.provider, m.kind, m.credits as current_credits, m.provider_cost_usd, m.cost_checked_at,
          (m.cost_checked_at is null or m.cost_checked_at < now() - make_interval(days => settings.cost_stale_days)) as stale,
          public.model_cost_trusted(m, settings) as trusted,
          (select count(*) from public.generations g where g.model_slug = m.slug and g.created_at >= p_from and g.created_at < p_to) as total,
          (select count(*) from public.generations g where g.model_slug = m.slug and g.status = 'failed'
             and g.created_at >= p_from and g.created_at < p_to) as failed,
          (select count(*) from billed b where b.model_slug = m.slug) as billed,
          (select coalesce(sum(b.credits), 0) from billed b where b.model_slug = m.slug and b.status = 'succeeded') as credits,
          (select coalesce(sum(b.spend_usd), 0) from billed b where b.model_slug = m.slug) as cost_usd,
          -- Custo previsto na hora de autorizar (tarifa × configuração) contra o gasto reconciliado.
          (select coalesce(sum(coalesce(b.provider_cost_usd, b.spend_usd)), 0) from billed b where b.model_slug = m.slug) as quoted_cost_usd,
          (select count(*) from billed b where b.model_slug = m.slug and b.cost_reconciled_at is not null) as reconciled,
          (select count(*) from billed b where b.model_slug = m.slug and b.provider_cost_usd is null and b.cost_reconciled_at is null) as estimated,
          (select count(*) from billed b where b.model_slug = m.slug
             and b.spend_usd * settings.usd_brl > b.credits * case when settings.credit_scale = 2 then settings.credit_budget_brl
               else settings.credit_value_brl end) as deficit
        from public.models m
      ) r
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke execute on function public.admin_plan_economics() from public, anon;
revoke execute on function public.admin_update_draft_plan(text, integer, integer, integer, integer, text) from public, anon;
revoke execute on function public.admin_set_model_tariff(text, jsonb, text) from public, anon;
revoke execute on function public.admin_record_price_check(jsonb) from public, anon;
revoke execute on function public.admin_update_cost_guard(numeric, integer, integer, numeric) from public, anon;
revoke execute on function public.admin_update_finance_settings(numeric, integer, integer, integer, integer, integer, numeric, numeric, integer, integer, integer, integer) from public, anon;
revoke execute on function public.admin_pricing_v2_preflight() from public, anon;
revoke execute on function public.admin_activate_pricing_v2(text, boolean) from public, anon;
revoke execute on function public.admin_rollback_pricing_v2(text) from public, anon;
grant execute on function public.admin_plan_economics() to authenticated;
grant execute on function public.admin_update_draft_plan(text, integer, integer, integer, integer, text) to authenticated;
grant execute on function public.admin_set_model_tariff(text, jsonb, text) to authenticated;
grant execute on function public.admin_record_price_check(jsonb) to authenticated;
grant execute on function public.admin_update_cost_guard(numeric, integer, integer, numeric) to authenticated;
grant execute on function public.admin_update_finance_settings(numeric, integer, integer, integer, integer, integer, numeric, numeric, integer, integer, integer, integer) to authenticated;
grant execute on function public.admin_pricing_v2_preflight() to authenticated;
grant execute on function public.admin_activate_pricing_v2(text, boolean) to authenticated;
grant execute on function public.admin_rollback_pricing_v2(text) to authenticated;
