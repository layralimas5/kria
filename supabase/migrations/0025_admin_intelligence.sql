-- Admin como central de inteligência (docs/admin-inteligencia.md):
--   1. Registro de consumo de IA: uma linha por geração cobrada pelo fornecedor, com unidades, créditos,
--      custo na moeda original, câmbio da hora e custo em reais. A base do custo fica explícita:
--      'metered' (unidades medidas na resposta × tarifa oficial), 'estimated' (tarifa × configuração do
--      modelo) ou 'unknown' (sem tarifa). Hoje nenhum fornecedor devolve o valor cobrado por pedido;
--      quando devolver, entra como base própria acima de 'metered'.
--   2. Histórico de preço dos modelos com vigência: mudar tarifa ou créditos não reescreve o passado.
--   3. Meta de margem por modelo e alertas.
--   4. Cortesia de plano: acesso a um plano sem cobrança, com prazo e motivo. Não é assinatura, não
--      entra em MRR nem churn e não dá créditos de plano (créditos só por ajuste, que fica no extrato).
--   5. Despesas registradas (para o lucro estimado) e contas criadas pelo admin.
--   6. Funções do painel: custos de IA, negócio, lista de usuários com filtros e perfil completo.
-- Só acrescenta. Nada aqui muda saldo, cobrança ou geração de quem já existe.

-- ------------------------------------------------------- consumo de IA

create table public.ai_usage_events (
  id bigint generated always as identity primary key,
  -- Sem chave estrangeira de propósito: o custo continua no financeiro mesmo se a conta for excluída.
  generation_id uuid not null unique,
  user_id uuid not null,
  model_slug text not null,
  provider text not null,
  model_endpoint text not null,
  kind text not null check (kind in ('image', 'video', 'text')),
  -- 'failed_billed' = falhou, o crédito voltou para a pessoa, mas o fornecedor cobrou.
  status text not null check (status in ('succeeded', 'failed_billed')),
  provider_request_id text,
  unit text check (unit in ('image', 'second', 'token')),
  units numeric(14, 4),
  input_tokens integer check (input_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  resolution text,
  duration_seconds numeric(8, 2),
  with_audio boolean,
  credits integer not null check (credits >= 0),
  cost_original numeric(12, 6) check (cost_original >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  fx_rate numeric(10, 4) not null check (fx_rate > 0),
  cost_brl numeric(12, 4) check (cost_brl >= 0),
  cost_basis text not null check (cost_basis in ('metered', 'estimated', 'unknown')),
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ai_usage_events_occurred on public.ai_usage_events (occurred_at);
create index ai_usage_events_model on public.ai_usage_events (model_slug, occurred_at);
create index ai_usage_events_user on public.ai_usage_events (user_id, occurred_at);

alter table public.ai_usage_events enable row level security;
revoke all on public.ai_usage_events from anon, authenticated;

-- Monta ou atualiza o registro da geração. Idempotente pela geração: webhook repetido, polling e
-- reconciliação do texto caem na mesma linha. O câmbio é o da primeira gravação e não muda depois.
create function public.record_ai_usage(p_generation_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  g public.generations;
  m public.models;
  params jsonb;
  usage_unit text;
  usage_units numeric;
  cost numeric;
  basis text;
  fx numeric;
begin
  select * into g from public.generations where id = p_generation_id;
  if g.id is null then return; end if;
  if not (g.status = 'succeeded' or (g.status = 'failed' and g.billed_on_failure)) then return; end if;
  select * into m from public.models where slug = g.model_slug;

  params := coalesce(m.defaults, '{}'::jsonb) || coalesce(g.options, '{}'::jsonb);
  usage_unit := coalesce(m.pricing ->> 'unit', case g.kind when 'image' then 'image' when 'video' then 'second' else 'token' end);
  usage_units := case usage_unit
    when 'image' then coalesce((params ->> 'num_images')::numeric, 1)
    when 'second' then public.duration_seconds(params -> 'duration')
    when 'token' then case when g.input_tokens is not null then g.input_tokens + coalesce(g.output_tokens, 0) end
  end;

  if g.actual_cost_usd is not null then
    cost := g.actual_cost_usd;
    basis := 'metered';
  elsif g.provider_cost_usd is not null then
    cost := g.provider_cost_usd;
    basis := 'estimated';
  else
    basis := 'unknown';
  end if;

  select coalesce((select e.fx_rate from public.ai_usage_events e where e.generation_id = g.id), usd_brl)
  into fx from public.pricing_settings;

  insert into public.ai_usage_events (
    generation_id, user_id, model_slug, provider, model_endpoint, kind, status, provider_request_id,
    unit, units, input_tokens, output_tokens, resolution, duration_seconds, with_audio,
    credits, cost_original, currency, fx_rate, cost_brl, cost_basis, occurred_at
  ) values (
    g.id, g.user_id, g.model_slug, coalesce(m.provider, 'desconhecido'), coalesce(m.endpoint, ''), g.kind,
    case when g.status = 'succeeded' then 'succeeded' else 'failed_billed' end, g.provider_request_id,
    usage_unit, usage_units, g.input_tokens, g.output_tokens,
    case when g.kind = 'image' then coalesce(params ->> 'resolution', '1K') end,
    case when g.kind = 'video' then public.duration_seconds(params -> 'duration') end,
    case when g.kind = 'video' then coalesce((params ->> 'generate_audio')::boolean, false) end,
    case when g.status = 'succeeded' then g.credits else 0 end,
    cost, 'USD', fx, round(cost * fx, 4), basis, coalesce(g.completed_at, g.updated_at, g.created_at)
  )
  on conflict (generation_id) do update set
    status = excluded.status, provider_request_id = excluded.provider_request_id,
    units = excluded.units, input_tokens = excluded.input_tokens, output_tokens = excluded.output_tokens,
    credits = excluded.credits, cost_original = excluded.cost_original,
    cost_brl = round(excluded.cost_original * public.ai_usage_events.fx_rate, 4),
    cost_basis = excluded.cost_basis, occurred_at = excluded.occurred_at, updated_at = now();
end;
$$;
revoke execute on function public.record_ai_usage(uuid) from public, anon, authenticated;

create function public.generations_record_ai_usage() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.record_ai_usage(new.id);
  return null;
end;
$$;
revoke execute on function public.generations_record_ai_usage() from public, anon, authenticated;

create trigger generations_ai_usage after update of status, actual_cost_usd on public.generations
  for each row when (new.status in ('succeeded', 'failed'))
  execute function public.generations_record_ai_usage();

-- Gerações que já terminaram entram no registro com o câmbio de hoje (o histórico de câmbio não existia).
select public.record_ai_usage(id) from public.generations
where status = 'succeeded' or (status = 'failed' and billed_on_failure);

-- ------------------------------------------ preço dos modelos com vigência

alter table public.models
  add column target_margin_rate numeric(5, 4) check (target_margin_rate between 0 and 0.95);

create table public.model_price_history (
  id bigint generated always as identity primary key,
  model_slug text not null references public.models (slug) on delete cascade,
  credits integer not null,
  pricing jsonb,
  provider_cost_usd numeric(10, 4),
  target_margin_rate numeric(5, 4),
  active boolean not null,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  changed_by uuid references auth.users (id) on delete set null,
  check (effective_to is null or effective_to >= effective_from)
);

create unique index model_price_history_current on public.model_price_history (model_slug) where effective_to is null;
create index model_price_history_recent on public.model_price_history (model_slug, effective_from desc);

alter table public.model_price_history enable row level security;
revoke all on public.model_price_history from anon, authenticated;

create function public.models_price_history() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.credits is not distinct from old.credits
     and new.pricing is not distinct from old.pricing
     and new.provider_cost_usd is not distinct from old.provider_cost_usd
     and new.target_margin_rate is not distinct from old.target_margin_rate
     and new.active is not distinct from old.active then
    return null;
  end if;
  update public.model_price_history set effective_to = now() where model_slug = new.slug and effective_to is null;
  insert into public.model_price_history (model_slug, credits, pricing, provider_cost_usd, target_margin_rate, active, changed_by)
  values (new.slug, new.credits, new.pricing, new.provider_cost_usd, new.target_margin_rate, new.active, auth.uid());
  return null;
end;
$$;
revoke execute on function public.models_price_history() from public, anon, authenticated;

create trigger models_price_history after insert or update on public.models
  for each row execute function public.models_price_history();

-- Retrato de hoje como primeira vigência conhecida.
insert into public.model_price_history (model_slug, credits, pricing, provider_cost_usd, target_margin_rate, active, effective_from)
select slug, credits, pricing, provider_cost_usd, target_margin_rate, active, least(updated_at, now()) from public.models;

-- ------------------------------------------------------ cortesia de plano

create table public.plan_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_slug text not null references public.subscription_plans (slug),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  reason text not null check (char_length(reason) between 5 and 300),
  granted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index plan_grants_user on public.plan_grants (user_id, ends_at desc);
create unique index plan_grants_one_open on public.plan_grants (user_id) where revoked_at is null;

alter table public.plan_grants enable row level security;
revoke all on public.plan_grants from anon, authenticated;

-- Assinatura paga vem primeiro; sem ela, vale a cortesia em vigor; sem as duas, o Grátis.
create or replace function public.effective_plan(p_user_id uuid) returns public.subscription_plans
language sql stable security definer set search_path = public as $$
  select coalesce(
    (
      select p from public.subscriptions s
      join public.subscription_plans p on p.slug = s.plan_slug
      where s.user_id = p_user_id
        and (
          (s.status in ('active', 'past_due') and s.current_period_end + interval '3 days' > now())
          or (s.status = 'canceled' and s.current_period_end > now())
        )
      order by s.current_period_end desc
      limit 1
    ),
    (
      select p from public.plan_grants g
      join public.subscription_plans p on p.slug = g.plan_slug
      where g.user_id = p_user_id and g.revoked_at is null and g.starts_at <= now() and g.ends_at > now()
      limit 1
    ),
    (select p from public.subscription_plans p where slug = 'gratis')
  );
$$;

-- ------------------------------------------------- contas criadas no admin

alter table public.profiles
  add column created_by_admin uuid references auth.users (id) on delete set null;

-- ------------------------------------------------------- despesas reais

create table public.operating_expenses (
  id uuid primary key default gen_random_uuid(),
  incurred_on date not null,
  category text not null check (category in ('infra', 'tools', 'marketing', 'taxes', 'payroll', 'services', 'other')),
  description text not null check (char_length(description) between 3 and 200),
  amount_cents integer not null check (amount_cents > 0 and amount_cents <= 100000000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Despesa não se apaga: anula com motivo, e o registro fica.
  voided_at timestamptz,
  voided_by uuid references auth.users (id) on delete set null,
  void_reason text check (char_length(void_reason) <= 300)
);

create index operating_expenses_date on public.operating_expenses (incurred_on) where voided_at is null;

alter table public.operating_expenses enable row level security;
revoke all on public.operating_expenses from anon, authenticated;

-- ------------------------------------------------------------ permissões

-- `expenses.manage` (lançar e anular despesa) fica com a dona e com o financeiro.
create or replace function public.admin_role_permissions(p_role public.admin_role) returns text[]
language sql immutable set search_path = public as $$
  select case p_role
    when 'super_admin' then array[
      'dashboard.view', 'finance.view', 'users.view', 'users.manage', 'credits.adjust',
      'plans.view', 'plans.manage', 'models.view', 'models.manage', 'pricing.manage',
      'audit.view', 'admins.manage', 'finance.override', 'expenses.manage'
    ]
    when 'admin' then array[
      'dashboard.view', 'users.view', 'users.manage', 'credits.adjust',
      'plans.view', 'models.view', 'models.manage', 'audit.view'
    ]
    when 'support' then array['dashboard.view', 'users.view']
    when 'finance' then array['dashboard.view', 'finance.view', 'users.view', 'plans.view', 'models.view', 'expenses.manage']
    when 'analyst' then array['dashboard.view', 'plans.view', 'models.view']
  end;
$$;

-- O menu do perfil mostra nome, e-mail e foto de quem está logado.
create or replace function public.admin_me() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  a public.admin_users;
begin
  select * into a from public.admin_users where user_id = auth.uid();
  if not found then return null; end if;
  return jsonb_build_object(
    'role', a.role,
    'permissions', to_jsonb(public.admin_role_permissions(a.role)),
    'aal', coalesce(auth.jwt() ->> 'aal', 'aal1'),
    'email', (select email::text from auth.users where id = a.user_id),
    'display_name', (select display_name from public.profiles where id = a.user_id),
    'avatar_path', (select avatar_path from public.profiles where id = a.user_id)
  );
end;
$$;

-- ------------------------------------------------------------- helpers

-- Período válido do painel: até 400 dias, início antes do fim.
create function public.assert_admin_period(p_from timestamptz, p_to timestamptz) returns void
language plpgsql immutable set search_path = public as $$
begin
  if p_from is null or p_to is null or p_from >= p_to or p_to - p_from > interval '400 days' then
    raise exception 'invalid_period';
  end if;
end;
$$;

-- MRR num instante: assinaturas que já pagaram e não tinham sido canceladas nem encerradas.
create function public.mrr_cents_at(p_at timestamptz, p_plan text default null) returns bigint
language sql stable security definer set search_path = public as $$
  select coalesce(sum(s.price_cents), 0) from public.subscriptions s
  where (p_plan is null or s.plan_slug = p_plan)
    and coalesce(s.canceled_at, 'infinity') > p_at
    and coalesce(s.ended_at, 'infinity') > p_at
    and exists (select 1 from public.subscription_payments p where p.subscription_id = s.id and p.paid_at <= p_at);
$$;
revoke execute on function public.mrr_cents_at(timestamptz, text) from public, anon, authenticated;

-- Margem de um modelo por operação: crédito cobrado × valor de referência do crédito contra o custo.
create function public.model_unit_margin(p_credits integer, p_cost_usd numeric, settings public.pricing_settings) returns numeric
language sql immutable set search_path = public as $$
  select case when p_cost_usd is null or p_credits <= 0 then null
    else round(1 - (p_cost_usd * settings.usd_brl) / (p_credits * settings.credit_value_brl), 4) end;
$$;

-- ------------------------------------------------------- custos de IA

-- Tudo da aba Modelos e custos numa chamada. Filtros: provedor, categoria, modelo e situação do modelo
-- (ativo/inativo). Valores em reais pelo câmbio gravado em cada registro. Receita e margem só para
-- quem tem `finance.view`.
create function public.admin_ai_costs(
  p_from timestamptz, p_to timestamptz,
  p_provider text default null, p_kind text default null, p_model text default null, p_active boolean default null
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  tz constant text := 'America/Sao_Paulo';
  settings public.pricing_settings;
  min_margin numeric;
  span interval;
  sees_money boolean;
  today_start timestamptz := date_trunc('day', now() at time zone tz) at time zone tz;
  month_start timestamptz := date_trunc('month', now() at time zone tz) at time zone tz;
  result jsonb;
begin
  perform public.assert_admin_permission('models.view');
  perform public.assert_admin_period(p_from, p_to);
  sees_money := public.has_admin_permission('finance.view');
  select * into settings from public.pricing_settings;
  select min_margin_rate into min_margin from public.finance_settings;
  span := p_to - p_from;

  with
  scoped_models as (
    select m.* from public.models m
    where (p_provider is null or m.provider = p_provider)
      and (p_kind is null or m.kind = p_kind)
      and (p_model is null or m.slug = p_model)
      and (p_active is null or m.active = p_active)
  ),
  ev as (
    select e.* from public.ai_usage_events e where e.model_slug in (select slug from scoped_models)
  ),
  cur as (select * from ev where occurred_at >= p_from and occurred_at < p_to),
  prev as (select * from ev where occurred_at >= p_from - span and occurred_at < p_from),
  days as (
    select d::date as day
    from generate_series((p_from at time zone tz)::date, ((p_to - interval '1 microsecond') at time zone tz)::date, interval '1 day') d
  ),
  last30 as (
    select d::date as day
    from generate_series(((now() - interval '29 days') at time zone tz)::date, (now() at time zone tz)::date, interval '1 day') d
  )
  select jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'usd_brl', settings.usd_brl,
    'credit_value_brl', settings.credit_value_brl,
    'min_margin_rate', min_margin,
    'max_operation_cost_usd', settings.max_operation_cost_usd,
    'kpis', jsonb_build_object(
      'cost_today_brl', (select coalesce(sum(cost_brl), 0) from ev where occurred_at >= today_start),
      'cost_7d_brl', (select coalesce(sum(cost_brl), 0) from ev where occurred_at >= now() - interval '7 days'),
      'cost_month_brl', (select coalesce(sum(cost_brl), 0) from ev where occurred_at >= month_start),
      'cost_total_brl', (select coalesce(sum(cost_brl), 0) from ev),
      'cost_period_brl', (select coalesce(sum(cost_brl), 0) from cur),
      'cost_previous_brl', (select coalesce(sum(cost_brl), 0) from prev),
      'generations', (select count(*) from cur),
      'generations_previous', (select count(*) from prev),
      'failed_billed', (select count(*) from cur where status = 'failed_billed'),
      'credits', (select coalesce(sum(credits), 0) from cur),
      'credits_previous', (select coalesce(sum(credits), 0) from prev),
      'active_users', (select count(distinct user_id) from cur),
      'metered', (select count(*) from cur where cost_basis = 'metered'),
      'estimated', (select count(*) from cur where cost_basis = 'estimated'),
      'unknown', (select count(*) from cur where cost_basis = 'unknown'),
      'revenue_estimated_brl', case when sees_money then (select coalesce(sum(credits), 0) from cur) * settings.credit_value_brl end
    ),
    'models', coalesce((
      select jsonb_agg(row_to_json(r) order by r.cost_period_brl desc nulls last, r.position)
      from (
        select m.slug, m.name, m.provider, m.endpoint, m.kind, m.active, m.position, m.credits, m.pricing,
          m.provider_cost_usd, m.target_margin_rate, m.cost_checked_at, m.cost_source,
          coalesce(m.pricing ->> 'unit', case m.kind when 'text' then 'token' when 'video' then 'second' else 'image' end) as unit,
          public.model_unit_margin(m.credits, m.provider_cost_usd, settings) as unit_margin,
          (select count(*) from cur where cur.model_slug = m.slug) as uses_period,
          (select count(*) from prev where prev.model_slug = m.slug) as uses_previous,
          (select count(*) from ev where ev.model_slug = m.slug) as uses_total,
          (select count(*) from ev where ev.model_slug = m.slug and ev.occurred_at >= now() - interval '7 days') as uses_7d,
          (select count(*) from ev where ev.model_slug = m.slug
             and ev.occurred_at >= now() - interval '14 days' and ev.occurred_at < now() - interval '7 days') as uses_prev_7d,
          (select coalesce(sum(credits), 0) from cur where cur.model_slug = m.slug) as credits_period,
          (select coalesce(sum(cost_brl), 0) from cur where cur.model_slug = m.slug) as cost_period_brl,
          (select coalesce(sum(cost_brl), 0) from ev where ev.model_slug = m.slug) as cost_total_brl,
          (select count(*) from cur where cur.model_slug = m.slug and cost_basis = 'metered') as metered,
          (select count(*) from cur where cur.model_slug = m.slug and cost_basis = 'unknown') as unknown
        from scoped_models m
      ) r
    ), '[]'::jsonb),
    'series', (
      select jsonb_agg(row_to_json(r) order by r.day)
      from (
        select d.day,
          (select coalesce(sum(cost_brl), 0) from cur where (occurred_at at time zone tz)::date = d.day) as cost_brl,
          (select coalesce(sum(credits), 0) from cur where (occurred_at at time zone tz)::date = d.day) as credits,
          (select count(*) from cur where (occurred_at at time zone tz)::date = d.day) as generations
        from days d
      ) r
    ),
    'trend_30d', (
      select jsonb_agg(row_to_json(r) order by r.day)
      from (
        select d.day, (select coalesce(sum(cost_brl), 0) from ev where (occurred_at at time zone tz)::date = d.day) as cost_brl
        from last30 d
      ) r
    ),
    'by_provider', coalesce((
      select jsonb_agg(row_to_json(r) order by r.cost_brl desc)
      from (select provider, count(*) as generations, coalesce(sum(cost_brl), 0) as cost_brl, coalesce(sum(credits), 0) as credits
            from cur group by provider) r
    ), '[]'::jsonb),
    'by_kind', coalesce((
      select jsonb_agg(row_to_json(r) order by r.cost_brl desc)
      from (select kind, count(*) as generations, coalesce(sum(cost_brl), 0) as cost_brl, coalesce(sum(credits), 0) as credits
            from cur group by kind) r
    ), '[]'::jsonb),
    'providers', coalesce((select jsonb_agg(distinct provider) from public.models), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;
revoke execute on function public.admin_ai_costs(timestamptz, timestamptz, text, text, text, boolean) from public, anon;
grant execute on function public.admin_ai_costs(timestamptz, timestamptz, text, text, text, boolean) to authenticated;

-- Vigências de preço de um modelo, mais recentes primeiro.
create function public.admin_model_price_history(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_admin_permission('models.view');
  return coalesce((
    select jsonb_agg(row_to_json(r) order by r.effective_from desc)
    from (
      select h.id, h.credits, h.pricing, h.provider_cost_usd, h.target_margin_rate, h.active, h.effective_from, h.effective_to,
        (select email::text from auth.users where id = h.changed_by) as changed_by_email
      from public.model_price_history h where h.model_slug = p_slug
      order by h.effective_from desc limit 50
    ) r
  ), '[]'::jsonb);
end;
$$;
revoke execute on function public.admin_model_price_history(text) from public, anon;
grant execute on function public.admin_model_price_history(text) to authenticated;

-- Meta de margem do modelo (nulo = usa a margem mínima do financeiro).
create function public.admin_set_model_target_margin(p_slug text, p_rate numeric, p_reason text) returns public.models
language plpgsql security definer set search_path = public as $$
declare
  admin_id uuid := public.assert_admin_permission('models.manage');
  m public.models;
begin
  if char_length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'reason_required'; end if;
  if p_rate is not null and (p_rate < 0 or p_rate > 0.95) then raise exception 'invalid_amount'; end if;
  update public.models set target_margin_rate = p_rate, updated_at = now() where slug = p_slug returning * into m;
  if m.slug is null then raise exception 'model_not_found'; end if;
  perform public.admin_log(admin_id, 'model.target_margin', null, p_slug, jsonb_build_object('rate', p_rate), trim(p_reason));
  return m;
end;
$$;
revoke execute on function public.admin_set_model_target_margin(text, numeric, text) from public, anon;
grant execute on function public.admin_set_model_target_margin(text, numeric, text) to authenticated;

-- ------------------------------------------------------------- negócio

-- O que o Analytics executivo precisa além do `admin_dashboard`: MRR mês a mês, receita contra custo
-- por dia, créditos distribuídos e consumidos, rentabilidade por plano, despesas registradas, conversão
-- do período anterior e consumo fora da curva. Plano = plano em vigor da conta agora.
create function public.admin_business(
  p_from timestamptz, p_to timestamptz, p_plan text default null, p_model text default null, p_provider text default null
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  tz constant text := 'America/Sao_Paulo';
  span interval;
  sees_money boolean;
  fee_rate numeric;
  result jsonb;
begin
  perform public.assert_admin_permission('dashboard.view');
  perform public.assert_admin_period(p_from, p_to);
  sees_money := public.has_admin_permission('finance.view');
  span := p_to - p_from;
  select payment_fee_rate into fee_rate from public.pricing_settings;

  with
  members as (
    select u.id as user_id, (public.effective_plan(u.id)).slug as plan_slug from auth.users u
  ),
  scoped_members as (select * from members where p_plan is null or plan_slug = p_plan),
  ev as (
    select e.* from public.ai_usage_events e
    where (p_model is null or e.model_slug = p_model)
      and (p_provider is null or e.provider = p_provider)
      and (p_plan is null or e.user_id in (select user_id from scoped_members))
  ),
  cur as (select * from ev where occurred_at >= p_from and occurred_at < p_to),
  received as (
    select s.plan_slug, p.amount_cents as cents, p.paid_at as at
    from public.subscription_payments p join public.subscriptions s on s.id = p.subscription_id
    where p.status = 'confirmed' and (p_plan is null or s.plan_slug = p_plan)
    union all
    select null, price_cents, paid_at from public.purchases
    where status = 'paid' and (p_plan is null or user_id in (select user_id from scoped_members))
  ),
  granted as (
    select l.* from public.credit_ledger l
    where l.delta > 0 and l.reason <> 'generation_refund'
      and (p_plan is null or l.user_id in (select user_id from scoped_members))
  ),
  people as (
    select p.id, p.created_at from public.profiles p where p_plan is null or p.id in (select user_id from scoped_members)
  ),
  days as (
    select d::date as day
    from generate_series((p_from at time zone tz)::date, ((p_to - interval '1 microsecond') at time zone tz)::date, interval '1 day') d
  ),
  months as (
    select (date_trunc('month', now() at time zone tz) - (n || ' months')::interval) as month_start
    from generate_series(0, 11) n
  ),
  usage_by_user as (
    select user_id, sum(credits) as credits, count(*) as generations, coalesce(sum(cost_brl), 0) as cost_brl
    from cur group by user_id
  ),
  usage_stats as (
    select percentile_cont(0.5) within group (order by credits) as median_credits from usage_by_user
  )
  select jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'filters', jsonb_build_object('plan', p_plan, 'model', p_model, 'provider', p_provider),
    'ai', jsonb_build_object(
      'cost_brl', (select coalesce(sum(cost_brl), 0) from cur),
      'cost_previous_brl', (select coalesce(sum(cost_brl), 0) from ev where occurred_at >= p_from - span and occurred_at < p_from),
      'generations', (select count(*) from cur),
      'generations_previous', (select count(*) from ev where occurred_at >= p_from - span and occurred_at < p_from),
      'unknown_cost', (select count(*) from cur where cost_basis = 'unknown'),
      'estimated_cost', (select count(*) from cur where cost_basis = 'estimated')
    ),
    'credits', jsonb_build_object(
      'distributed', (select coalesce(sum(delta), 0) from granted where created_at >= p_from and created_at < p_to),
      'consumed', (select coalesce(sum(credits), 0) from cur),
      'available', (select coalesce(sum(b.balance), 0) from public.credit_balances b
        where p_plan is null or b.user_id in (select user_id from scoped_members))
    ),
    'credit_series', (
      select jsonb_agg(row_to_json(r) order by r.day)
      from (
        select d.day,
          (select coalesce(sum(delta), 0) from granted g where (g.created_at at time zone tz)::date = d.day
             and g.created_at >= p_from and g.created_at < p_to) as distributed,
          (select coalesce(sum(credits), 0) from cur where (occurred_at at time zone tz)::date = d.day) as consumed
        from days d
      ) r
    ),
    'conversion', jsonb_build_object(
      'signups', (select count(*) from people where created_at >= p_from and created_at < p_to),
      'converted', (select count(*) from people p where p.created_at >= p_from and p.created_at < p_to
        and exists (select 1 from public.subscription_payments sp where sp.user_id = p.id and sp.status = 'confirmed' and sp.paid_at < p_to)),
      'signups_previous', (select count(*) from people where created_at >= p_from - span and created_at < p_from),
      'converted_previous', (select count(*) from people p where p.created_at >= p_from - span and p.created_at < p_from
        and exists (select 1 from public.subscription_payments sp where sp.user_id = p.id and sp.status = 'confirmed'
          and sp.paid_at < p_from))
    ),
    'unusual_users', case when public.has_admin_permission('users.view') then coalesce((
      select jsonb_agg(row_to_json(r) order by r.credits desc)
      from (
        select u.user_id, (select email::text from auth.users where id = u.user_id) as email, u.credits, u.generations,
          case when sees_money then u.cost_brl end as cost_brl
        from usage_by_user u, usage_stats s
        where u.credits >= 3 * greatest(s.median_credits, 1) and u.credits >= 50
        order by u.credits desc limit 5
      ) r
    ), '[]'::jsonb) end,
    'money', case when sees_money then jsonb_build_object(
      'payment_fee_rate', fee_rate,
      'min_margin_rate', (select min_margin_rate from public.finance_settings),
      'received_cents', (select coalesce(sum(cents), 0) from received where at >= p_from and at < p_to),
      'expenses_cents', (select coalesce(sum(amount_cents), 0) from public.operating_expenses
        where voided_at is null and incurred_on >= (p_from at time zone tz)::date and incurred_on <= ((p_to - interval '1 microsecond') at time zone tz)::date),
      'expenses', coalesce((
        select jsonb_agg(row_to_json(x) order by x.incurred_on desc, x.created_at desc)
        from (
          select e.id, e.incurred_on, e.category, e.description, e.amount_cents, e.created_at, e.voided_at, e.void_reason
          from public.operating_expenses e
          where e.incurred_on >= (p_from at time zone tz)::date and e.incurred_on <= ((p_to - interval '1 microsecond') at time zone tz)::date
          order by e.incurred_on desc limit 100
        ) x
      ), '[]'::jsonb),
      'mrr_series', (
        select jsonb_agg(row_to_json(r) order by r.month)
        from (
          select to_char(mo.month_start, 'YYYY-MM') as month,
            public.mrr_cents_at(least((mo.month_start + interval '1 month') at time zone tz, now()), p_plan) as mrr_cents
          from months mo
        ) r
      ),
      'revenue_series', (
        select jsonb_agg(row_to_json(r) order by r.day)
        from (
          select d.day,
            (select coalesce(sum(cents), 0) from received x where x.at >= p_from and x.at < p_to and (x.at at time zone tz)::date = d.day) as revenue_cents,
            (select coalesce(sum(cost_brl), 0) from cur where (occurred_at at time zone tz)::date = d.day) as ai_cost_brl
          from days d
        ) r
      ),
      'plans', coalesce((
        select jsonb_agg(row_to_json(r) order by r.position)
        from (
          select p.slug, p.name, p.position, p.price_cents,
            (select count(*) from scoped_members sm where sm.plan_slug = p.slug) as users,
            (select coalesce(sum(cents), 0) from received x where x.plan_slug = p.slug and x.at >= p_from and x.at < p_to) as received_cents,
            (select coalesce(sum(c.cost_brl), 0) from cur c join scoped_members sm on sm.user_id = c.user_id where sm.plan_slug = p.slug) as ai_cost_brl,
            (select coalesce(sum(c.credits), 0) from cur c join scoped_members sm on sm.user_id = c.user_id where sm.plan_slug = p.slug) as credits
          from public.subscription_plans p
          where p.status <> 'draft' and (p_plan is null or p.slug = p_plan)
        ) r
      ), '[]'::jsonb)
    ) end
  ) into result;
  return result;
end;
$$;
revoke execute on function public.admin_business(timestamptz, timestamptz, text, text, text) from public, anon;
grant execute on function public.admin_business(timestamptz, timestamptz, text, text, text) to authenticated;

-- Despesa real lançada pela operação. Entra no lucro estimado do período da data dela.
create function public.admin_add_expense(p_incurred_on date, p_category text, p_description text, p_amount_cents integer)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  admin_id uuid := public.assert_admin_permission('expenses.manage');
  new_id uuid;
begin
  if p_incurred_on is null or p_incurred_on > (now() at time zone 'America/Sao_Paulo')::date + 31 then raise exception 'invalid_date'; end if;
  if p_amount_cents is null or p_amount_cents <= 0 or p_amount_cents > 100000000 then raise exception 'invalid_amount'; end if;
  insert into public.operating_expenses (incurred_on, category, description, amount_cents, created_by)
  values (p_incurred_on, p_category, trim(p_description), p_amount_cents, admin_id)
  returning id into new_id;
  perform public.admin_log(admin_id, 'expense.add', null, new_id::text,
    jsonb_build_object('amount_cents', p_amount_cents, 'category', p_category, 'incurred_on', p_incurred_on), trim(p_description));
  return new_id;
end;
$$;
revoke execute on function public.admin_add_expense(date, text, text, integer) from public, anon;
grant execute on function public.admin_add_expense(date, text, text, integer) to authenticated;

create function public.admin_void_expense(p_id uuid, p_reason text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  admin_id uuid := public.assert_admin_permission('expenses.manage');
begin
  if char_length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'reason_required'; end if;
  update public.operating_expenses set voided_at = now(), voided_by = admin_id, void_reason = trim(p_reason)
  where id = p_id and voided_at is null;
  if not found then raise exception 'expense_not_found'; end if;
  perform public.admin_log(admin_id, 'expense.void', null, p_id::text, '{}'::jsonb, trim(p_reason));
  return true;
end;
$$;
revoke execute on function public.admin_void_expense(uuid, text) from public, anon;
grant execute on function public.admin_void_expense(uuid, text) to authenticated;

-- --------------------------------------------------------------- usuários

-- Lista com filtros combináveis, ordenação e paginação. Custo de IA só para `finance.view`.
--   p_seen: '7d' | '30d' (acessou no período) | 'idle30' (sem acesso há 30 dias ou nunca)
--   p_credits: 'with' | 'without'; p_account: 'active' | 'suspended'
--   p_sort: 'recent' | 'active' (mais gerações) | 'cost' (maior custo de IA) | 'credits' (mais créditos consumidos) | 'seen'
create function public.admin_users_list(
  p_query text default null,
  p_plan text default null,
  p_subscription_status text default null,
  p_account text default null,
  p_created_from timestamptz default null,
  p_created_to timestamptz default null,
  p_seen text default null,
  p_credits text default null,
  p_manual boolean default null,
  p_sort text default 'recent',
  p_limit integer default 25,
  p_offset integer default 0
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  term text := '%' || lower(trim(coalesce(p_query, ''))) || '%';
  sees_money boolean := public.has_admin_permission('finance.view');
  result jsonb;
begin
  perform public.assert_admin_permission('users.view');
  if p_sort not in ('recent', 'active', 'cost', 'credits', 'seen') then raise exception 'invalid_sort'; end if;

  with base as (
    select u.id, u.email::text as email, p.display_name, p.username, p.avatar_path, p.created_at, u.last_sign_in_at,
      p.suspended_at, p.created_by_admin is not null as manual,
      (public.effective_plan(u.id)).slug as plan_slug,
      (select x.status::text from public.subscriptions x where x.user_id = u.id and x.status <> 'pending'
        order by x.created_at desc limit 1) as subscription_status,
      exists (select 1 from public.plan_grants g where g.user_id = u.id and g.revoked_at is null and g.ends_at > now()) as courtesy,
      coalesce(b.balance, 0) as balance,
      (select coalesce(sum(r.amount), 0) from public.credit_reservations r where r.user_id = u.id and r.status = 'captured') as consumed,
      (select count(*) from public.generations g where g.user_id = u.id) as generations,
      (select coalesce(sum(e.cost_brl), 0) from public.ai_usage_events e where e.user_id = u.id) as ai_cost_brl
    from auth.users u
    join public.profiles p on p.id = u.id
    left join public.credit_balances b on b.user_id = u.id
  ),
  filtered as (
    select * from base
    where (p_query is null or trim(p_query) = '' or lower(coalesce(email, '')) like term or lower(username) like term
           or lower(coalesce(display_name, '')) like term)
      and (p_plan is null or plan_slug = p_plan)
      and (p_subscription_status is null
           or (p_subscription_status = 'none' and subscription_status is null)
           or subscription_status = p_subscription_status)
      and (p_account is null or (p_account = 'suspended') = (suspended_at is not null))
      and (p_created_from is null or created_at >= p_created_from)
      and (p_created_to is null or created_at < p_created_to)
      and (p_seen is null
           or (p_seen = '7d' and last_sign_in_at >= now() - interval '7 days')
           or (p_seen = '30d' and last_sign_in_at >= now() - interval '30 days')
           or (p_seen = 'idle30' and (last_sign_in_at is null or last_sign_in_at < now() - interval '30 days')))
      and (p_credits is null or (p_credits = 'with') = (balance > 0))
      and (p_manual is null or manual = p_manual)
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'rows', coalesce((
      select jsonb_agg(row_to_json(r))
      from (
        select id, email, display_name, username, avatar_path, created_at, last_sign_in_at, suspended_at, manual,
          plan_slug, subscription_status, courtesy, balance, consumed, generations,
          case when sees_money then ai_cost_brl end as ai_cost_brl
        from filtered
        order by
          case when p_sort = 'active' then generations end desc nulls last,
          case when p_sort = 'cost' then ai_cost_brl end desc nulls last,
          case when p_sort = 'credits' then consumed end desc nulls last,
          case when p_sort = 'seen' then last_sign_in_at end desc nulls last,
          created_at desc
        limit least(greatest(coalesce(p_limit, 25), 1), 100) offset greatest(coalesce(p_offset, 0), 0)
      ) r
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;
revoke execute on function public.admin_users_list(text, text, text, text, timestamptz, timestamptz, text, text, boolean, text, integer, integer) from public, anon;
grant execute on function public.admin_users_list(text, text, text, text, timestamptz, timestamptz, text, text, boolean, text, integer, integer) to authenticated;

-- Perfil completo para o painel do usuário. Pagamentos e custo para `finance.view`; ações
-- administrativas para `audit.view`.
create function public.admin_user_profile(p_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  tz constant text := 'America/Sao_Paulo';
  sees_money boolean := public.has_admin_permission('finance.view');
  plan public.subscription_plans;
  result jsonb;
begin
  perform public.assert_admin_permission('users.view');
  if not exists (select 1 from public.profiles where id = p_user_id) then raise exception 'account_not_found'; end if;
  plan := public.effective_plan(p_user_id);

  select jsonb_build_object(
    'account', (
      select jsonb_build_object(
        'id', u.id, 'email', u.email, 'display_name', p.display_name, 'username', p.username, 'avatar_path', p.avatar_path,
        'created_at', p.created_at, 'last_sign_in_at', u.last_sign_in_at, 'email_confirmed', u.email_confirmed_at is not null,
        'suspended_at', p.suspended_at, 'suspended_reason', p.suspended_reason,
        'created_by_admin_email', (select email::text from auth.users where id = p.created_by_admin),
        'balance', coalesce(b.balance, 0), 'subscription_balance', coalesce(b.subscription_balance, 0),
        'purchased_balance', coalesce(b.purchased_balance, 0)
      )
      from auth.users u join public.profiles p on p.id = u.id left join public.credit_balances b on b.user_id = u.id
      where u.id = p_user_id
    ),
    'plan', jsonb_build_object('slug', plan.slug, 'name', plan.name),
    'grant', (
      select row_to_json(g) from (
        select id, plan_slug, starts_at, ends_at, reason, (select email::text from auth.users where id = granted_by) as granted_by_email
        from public.plan_grants where user_id = p_user_id and revoked_at is null and ends_at > now() limit 1
      ) g
    ),
    'subscriptions', coalesce((select jsonb_agg(row_to_json(s)) from (
      select id, plan_slug, status, price_cents, current_period_start, current_period_end, canceled_at, ended_at, created_at
      from public.subscriptions where user_id = p_user_id order by created_at desc limit 20) s), '[]'::jsonb),
    'credits', jsonb_build_object(
      'received', coalesce((select jsonb_object_agg(reason, total) from (
        select reason::text, sum(delta) as total from public.credit_ledger
        where user_id = p_user_id and delta > 0 and reason <> 'generation_refund' group by reason) x), '{}'::jsonb),
      'consumed', (select coalesce(sum(amount), 0) from public.credit_reservations where user_id = p_user_id and status = 'captured'),
      'refunded', (select coalesce(sum(amount), 0) from public.credit_reservations where user_id = p_user_id and status = 'released')
    ),
    'ledger', coalesce((select jsonb_agg(row_to_json(l)) from (
      select id, delta, reason, note, balance_after, created_at
      from public.credit_ledger where user_id = p_user_id order by created_at desc, id desc limit 50) l), '[]'::jsonb),
    'generations', coalesce((select jsonb_agg(row_to_json(g)) from (
      select g.id, g.model_slug, m.name as model_name, g.kind, g.status, g.credits, g.error, g.created_at,
        case when sees_money then e.cost_brl end as cost_brl, e.cost_basis
      from public.generations g
      left join public.models m on m.slug = g.model_slug
      left join public.ai_usage_events e on e.generation_id = g.id
      where g.user_id = p_user_id order by g.created_at desc limit 50) g), '[]'::jsonb),
    'top_models', coalesce((select jsonb_agg(row_to_json(t) order by t.total desc) from (
      select g.model_slug, m.name, count(*) as total, coalesce(sum(g.credits) filter (where g.status = 'succeeded'), 0) as credits
      from public.generations g left join public.models m on m.slug = g.model_slug
      where g.user_id = p_user_id group by g.model_slug, m.name order by count(*) desc limit 5) t), '[]'::jsonb),
    'ai_cost', case when sees_money then jsonb_build_object(
      'total_brl', (select coalesce(sum(cost_brl), 0) from public.ai_usage_events where user_id = p_user_id),
      'last_30d_brl', (select coalesce(sum(cost_brl), 0) from public.ai_usage_events where user_id = p_user_id and occurred_at >= now() - interval '30 days'),
      'metered', (select count(*) from public.ai_usage_events where user_id = p_user_id and cost_basis = 'metered'),
      'estimated', (select count(*) from public.ai_usage_events where user_id = p_user_id and cost_basis = 'estimated'),
      'unknown', (select count(*) from public.ai_usage_events where user_id = p_user_id and cost_basis = 'unknown')
    ) end,
    'activity', jsonb_build_object(
      'active_days_30d', (select count(distinct (created_at at time zone tz)::date) from public.generations
        where user_id = p_user_id and created_at >= now() - interval '30 days'),
      'generations_30d', (select count(*) from public.generations where user_id = p_user_id and created_at >= now() - interval '30 days'),
      'last_generation_at', (select max(created_at) from public.generations where user_id = p_user_id)
    ),
    'payments', case when sees_money then coalesce((select jsonb_agg(row_to_json(x)) from (
      select 'subscription' as type, amount_cents, status, paid_at as at from public.subscription_payments where user_id = p_user_id
      union all
      select 'pack', price_cents, status::text, coalesce(paid_at, created_at) from public.purchases where user_id = p_user_id
      order by at desc limit 30) x), '[]'::jsonb) end,
    'admin_actions', case when public.has_admin_permission('audit.view') then coalesce((select jsonb_agg(row_to_json(a)) from (
      select l.id, l.action, l.reason, l.details, l.result, l.created_at, (select email::text from auth.users where id = l.admin_id) as admin_email
      from public.admin_audit_logs l where l.target_user_id = p_user_id order by l.created_at desc limit 50) a), '[]'::jsonb) end
  ) into result;
  return result;
end;
$$;
revoke execute on function public.admin_user_profile(uuid) from public, anon;
grant execute on function public.admin_user_profile(uuid) to authenticated;

-- Cortesia: acesso ao plano por N dias, sem cobrança e sem créditos de plano.
create function public.admin_grant_plan(p_user_id uuid, p_plan_slug text, p_days integer, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  admin_id uuid := public.assert_admin_permission('users.manage');
  g public.plan_grants;
begin
  if char_length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'reason_required'; end if;
  if p_days is null or p_days < 1 or p_days > 365 then raise exception 'invalid_days'; end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then raise exception 'account_not_found'; end if;
  if p_plan_slug = 'gratis' or not exists (
    select 1 from public.subscription_plans where slug = p_plan_slug and active and status = 'live'
  ) then
    raise exception 'plan_not_found';
  end if;

  update public.plan_grants set revoked_at = now(), revoked_by = admin_id where user_id = p_user_id and revoked_at is null;
  insert into public.plan_grants (user_id, plan_slug, ends_at, reason, granted_by)
  values (p_user_id, p_plan_slug, now() + make_interval(days => p_days), trim(p_reason), admin_id)
  returning * into g;
  perform public.admin_log(admin_id, 'user.plan_grant', p_user_id, p_plan_slug,
    jsonb_build_object('days', p_days, 'ends_at', g.ends_at), trim(p_reason));
  return jsonb_build_object('plan_slug', g.plan_slug, 'ends_at', g.ends_at);
end;
$$;
revoke execute on function public.admin_grant_plan(uuid, text, integer, text) from public, anon;
grant execute on function public.admin_grant_plan(uuid, text, integer, text) to authenticated;

create function public.admin_revoke_plan_grant(p_user_id uuid, p_reason text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  admin_id uuid := public.assert_admin_permission('users.manage');
begin
  if char_length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'reason_required'; end if;
  update public.plan_grants set revoked_at = now(), revoked_by = admin_id where user_id = p_user_id and revoked_at is null;
  if not found then raise exception 'grant_not_found'; end if;
  perform public.admin_log(admin_id, 'user.plan_revoke', p_user_id, null, '{}'::jsonb, trim(p_reason));
  return true;
end;
$$;
revoke execute on function public.admin_revoke_plan_grant(uuid, text) from public, anon;
grant execute on function public.admin_revoke_plan_grant(uuid, text) to authenticated;

-- Conferência antes do convite (function `admin-users`): permissão, e-mail livre e valores válidos.
-- Roda com o JWT de quem pediu, então a permissão e o segundo fator são os do banco.
create function public.admin_check_new_user(p_email text, p_plan_slug text, p_grant_days integer, p_credits integer, p_reason text)
returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_admin_permission('users.manage');
  if coalesce(p_credits, 0) > 0 then perform public.assert_admin_permission('credits.adjust'); end if;
  if char_length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'reason_required'; end if;
  if trim(coalesce(p_email, '')) !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;
  if exists (select 1 from auth.users where lower(email) = lower(trim(p_email))) then raise exception 'email_taken'; end if;
  if coalesce(p_credits, 0) < 0 or coalesce(p_credits, 0) > 100000 then raise exception 'invalid_amount'; end if;
  if p_plan_slug is not null and p_plan_slug <> 'gratis' then
    if p_grant_days is null or p_grant_days < 1 or p_grant_days > 365 then raise exception 'invalid_days'; end if;
    if not exists (select 1 from public.subscription_plans where slug = p_plan_slug and active and status = 'live') then
      raise exception 'plan_not_found';
    end if;
  end if;
  return true;
end;
$$;
revoke execute on function public.admin_check_new_user(text, text, integer, integer, text) from public, anon;
grant execute on function public.admin_check_new_user(text, text, integer, integer, text) to authenticated;

-- Depois do convite: marca a conta como criada no admin e aplica plano de cortesia, créditos e status.
-- Só vale para conta criada há menos de 15 minutos e ainda sem dono no admin (não serve para mexer
-- em conta antiga por esse caminho). Tudo vai para a auditoria como `user.create`.
create function public.admin_setup_new_user(
  p_user_id uuid, p_plan_slug text, p_grant_days integer, p_credits integer, p_suspended boolean, p_reason text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  admin_id uuid := public.assert_admin_permission('users.manage');
  created timestamptz;
begin
  if coalesce(p_credits, 0) > 0 then perform public.assert_admin_permission('credits.adjust'); end if;
  if char_length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'reason_required'; end if;
  select created_at into created from public.profiles where id = p_user_id and created_by_admin is null for update;
  if created is null or created < now() - interval '15 minutes' then raise exception 'account_not_found'; end if;

  update public.profiles set created_by_admin = admin_id where id = p_user_id;

  if p_plan_slug is not null and p_plan_slug <> 'gratis' then
    if not exists (select 1 from public.subscription_plans where slug = p_plan_slug and active and status = 'live') then
      raise exception 'plan_not_found';
    end if;
    insert into public.plan_grants (user_id, plan_slug, ends_at, reason, granted_by)
    values (p_user_id, p_plan_slug, now() + make_interval(days => p_grant_days), trim(p_reason), admin_id);
  end if;

  if coalesce(p_credits, 0) > 0 then
    perform public.wallet_move(p_user_id, 0, p_credits, 'adjustment', left('Créditos iniciais: ' || trim(p_reason), 300),
      p_actor_id => admin_id);
  end if;

  if p_suspended then
    update public.profiles set suspended_at = now(), suspended_reason = trim(p_reason) where id = p_user_id;
  end if;

  perform public.admin_log(admin_id, 'user.create', p_user_id, p_plan_slug,
    jsonb_build_object('credits', coalesce(p_credits, 0), 'grant_days', p_grant_days, 'suspended', coalesce(p_suspended, false)),
    trim(p_reason));
  return jsonb_build_object('user_id', p_user_id);
end;
$$;
revoke execute on function public.admin_setup_new_user(uuid, text, integer, integer, boolean, text) from public, anon;
grant execute on function public.admin_setup_new_user(uuid, text, integer, integer, boolean, text) to authenticated;
