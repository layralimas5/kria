-- Guarda de gasto: proteção financeira antes de abrir ao público.
--
-- 1. Limite de consumo por plano, por dia e por mês (em créditos, inclusive no Grátis).
-- 2. Teto de custo da plataforma por dia e por mês (US$) e pausa de emergência.
-- 3. Custo que o fornecedor cobra mesmo na falha (texto da Anthropic) entra na conta,
--    ainda que a pessoa receba o crédito de volta.
--
-- Só `add column` com default e funções novas; `create_generation` mantém a assinatura.
-- Dia e mês contam no horário de Brasília, como o dashboard (0014).

-- ----------------------------------------------------------- colunas

alter table public.subscription_plans
  add column daily_credit_limit integer check (daily_credit_limit > 0),
  add column monthly_credit_limit integer check (monthly_credit_limit > 0),
  add constraint subscription_plans_limits_order
    check (daily_credit_limit is null or monthly_credit_limit is null or daily_credit_limit <= monthly_credit_limit);

-- Hipóteses de partida (nulo = sem limite). Diário = créditos do mês do plano; mensal = 5x,
-- para caber pacote avulso. No Grátis, sobra para os 20 de boas-vindas e um pacote.
update public.subscription_plans set daily_credit_limit = 100, monthly_credit_limit = 500 where slug = 'gratis';
update public.subscription_plans set daily_credit_limit = 300, monthly_credit_limit = 1500 where slug = 'starter';
update public.subscription_plans set daily_credit_limit = 450, monthly_credit_limit = 2250 where slug = 'pro';
update public.subscription_plans set daily_credit_limit = 1000, monthly_credit_limit = 5000 where slug = 'studio';

alter table public.pricing_settings
  add column daily_cost_cap_usd numeric(10, 2) check (daily_cost_cap_usd > 0),
  add column monthly_cost_cap_usd numeric(10, 2) check (monthly_cost_cap_usd > 0),
  add column cost_alert_ratio numeric(4, 3) not null default 0.8 check (cost_alert_ratio between 0.1 and 1),
  add column generation_paused boolean not null default false,
  add column paused_reason text check (char_length(paused_reason) <= 300),
  add constraint pricing_settings_caps_order
    check (daily_cost_cap_usd is null or monthly_cost_cap_usd is null or daily_cost_cap_usd <= monthly_cost_cap_usd);

-- Tetos baixos de propósito enquanto nada rodou com dinheiro real. Sobe no painel.
update public.pricing_settings set daily_cost_cap_usd = 25, monthly_cost_cap_usd = 300, updated_at = now();

-- A Anthropic cobra os tokens mesmo quando a resposta não serve. O fal não cobra o que falha
-- (conferir na fatura da primeira semana e ajustar aqui se for diferente).
alter table public.models add column charges_on_failure boolean not null default false;
update public.models set charges_on_failure = true where provider = 'anthropic';

-- Custo usado pela guarda, gravado no nascimento da geração. Quando o custo real do
-- fornecedor ainda não foi cadastrado, assume o pior caso: todo o valor do crédito vira custo.
alter table public.generations
  add column spend_usd numeric(10, 4) not null default 0 check (spend_usd >= 0),
  add column billed_on_failure boolean not null default false;

create index credit_reservations_user_created on public.credit_reservations (user_id, created_at);

-- ----------------------------------------------------------- regras

create function public.spend_day_start() returns timestamptz
language sql stable set search_path = public as $$
  select date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
$$;

create function public.spend_month_start() returns timestamptz
language sql stable set search_path = public as $$
  select date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
$$;

-- Créditos que a pessoa comprometeu na janela: reservados ou capturados. Estorno não conta.
create function public.user_credits_used(p_user_id uuid, p_since timestamptz) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(sum(amount), 0)::integer from public.credit_reservations
  where user_id = p_user_id and created_at >= p_since and status <> 'released';
$$;

-- Custo da plataforma na janela: gerações abertas e concluídas, mais as falhas que o fornecedor cobra.
create function public.platform_spend_usd(p_since timestamptz) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(spend_usd), 0) from public.generations
  where created_at >= p_since and (status <> 'failed' or billed_on_failure);
$$;

create function public.generation_spend_usd(m public.models, settings public.pricing_settings) returns numeric
language sql stable set search_path = public as $$
  select round(coalesce(m.provider_cost_usd, m.credits * settings.credit_value_brl / settings.usd_brl), 4);
$$;

-- Regras internas: só as funções do banco chamam. O cliente lê o próprio consumo por `my_usage`.
revoke execute on function public.user_credits_used(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.platform_spend_usd(timestamptz) from public, anon, authenticated;
revoke execute on function public.generation_spend_usd(public.models, public.pricing_settings) from public, anon, authenticated;

-- ------------------------------------------------- motor com a guarda

create or replace function public.create_generation(
  p_user_id uuid,
  p_model_slug text,
  p_prompt text,
  p_persona_id uuid default null,
  p_source_generation_id uuid default null,
  p_idempotency_key text default null,
  p_upload_id uuid default null,
  p_end_generation_id uuid default null,
  p_format_slug text default null
) returns public.generations
language plpgsql security definer set search_path = public as $$
declare
  m public.models;
  g public.generations;
  f public.formats;
  plan public.subscription_plans;
  wallet public.credit_balances;
  settings public.pricing_settings;
  running integer;
  from_subscription integer;
  spend numeric;
  sources integer := (p_persona_id is not null)::integer + (p_source_generation_id is not null)::integer + (p_upload_id is not null)::integer;
begin
  perform public.expire_lapsed_subscriptions(p_user_id);

  -- A trava da carteira serializa as gerações da mesma pessoa.
  select * into wallet from public.credit_balances where user_id = p_user_id for update;
  if not found then raise exception 'account_not_found'; end if;

  if p_idempotency_key is not null and exists (
    select 1 from public.generations where user_id = p_user_id and idempotency_key = p_idempotency_key
  ) then
    raise exception 'duplicate_request';
  end if;

  if exists (select 1 from public.profiles where id = p_user_id and suspended_at is not null) then
    raise exception 'account_suspended';
  end if;

  select * into settings from public.pricing_settings;
  if settings.generation_paused then raise exception 'generation_paused'; end if;

  select * into m from public.models where slug = p_model_slug and active;
  if not found then raise exception 'model_unavailable'; end if;

  if char_length(coalesce(trim(p_prompt), '')) not between 3 and 2000 then
    raise exception 'invalid_prompt';
  end if;

  if sources > 1 then raise exception 'one_image_only'; end if;
  if m.requires_image and sources = 0 then raise exception 'image_required'; end if;
  if not m.requires_image and sources > 0 then raise exception 'model_takes_no_image'; end if;

  if p_persona_id is not null and not exists (
    select 1 from public.personas where id = p_persona_id and user_id = p_user_id
  ) then
    raise exception 'persona_not_found';
  end if;

  if p_source_generation_id is not null and not exists (
    select 1 from public.generations
    where id = p_source_generation_id and user_id = p_user_id
      and status = 'succeeded' and kind = 'image' and output_path is not null
  ) then
    raise exception 'source_not_found';
  end if;

  if p_upload_id is not null and not exists (
    select 1 from public.uploads where id = p_upload_id and user_id = p_user_id
  ) then
    raise exception 'upload_not_found';
  end if;

  if p_end_generation_id is not null then
    if m.end_image_input is null then raise exception 'model_takes_no_end_image'; end if;
    if sources = 0 then raise exception 'image_required'; end if;
    if not exists (
      select 1 from public.generations
      where id = p_end_generation_id and user_id = p_user_id
        and status = 'succeeded' and kind = 'image' and output_path is not null
    ) then
      raise exception 'source_not_found';
    end if;
  end if;

  if p_format_slug is not null then
    select * into f from public.formats where slug = p_format_slug and active;
    if not found then raise exception 'format_unavailable'; end if;
    if m.slug not in (f.model_slug, coalesce(f.edit_model_slug, f.model_slug)) then raise exception 'format_mismatch'; end if;
  end if;

  plan := public.effective_plan(p_user_id);
  if m.allowed_plans is not null and not (plan.slug = any (m.allowed_plans)) then
    raise exception 'plan_required';
  end if;

  select count(*) into running from public.generations
  where user_id = p_user_id and status in ('queued', 'running');
  if running >= plan.max_concurrent then raise exception 'too_many_running'; end if;

  if wallet.balance < m.credits then raise exception 'insufficient_credits'; end if;

  if plan.daily_credit_limit is not null
     and public.user_credits_used(p_user_id, public.spend_day_start()) + m.credits > plan.daily_credit_limit then
    raise exception 'daily_limit_reached';
  end if;
  if plan.monthly_credit_limit is not null
     and public.user_credits_used(p_user_id, public.spend_month_start()) + m.credits > plan.monthly_credit_limit then
    raise exception 'monthly_limit_reached';
  end if;

  -- Teto da plataforma. Não serializa entre contas: pode passar do teto no máximo pelas
  -- gerações que nascem no mesmo instante, o que é aceitável para um disjuntor.
  spend := public.generation_spend_usd(m, settings);
  if settings.daily_cost_cap_usd is not null
     and public.platform_spend_usd(public.spend_day_start()) + spend > settings.daily_cost_cap_usd then
    raise exception 'platform_spend_cap';
  end if;
  if settings.monthly_cost_cap_usd is not null
     and public.platform_spend_usd(public.spend_month_start()) + spend > settings.monthly_cost_cap_usd then
    raise exception 'platform_spend_cap';
  end if;

  insert into public.generations (
    user_id, model_slug, kind, prompt, persona_id, source_generation_id, upload_id, end_generation_id, format_slug,
    from_upload, credits, idempotency_key, provider_cost_usd, spend_usd, billed_on_failure
  ) values (
    p_user_id, m.slug, m.kind, trim(p_prompt), p_persona_id, p_source_generation_id, p_upload_id, p_end_generation_id, p_format_slug,
    p_upload_id is not null or exists (
      select 1 from public.generations where id in (p_source_generation_id, p_end_generation_id) and from_upload
    ),
    m.credits, p_idempotency_key, m.provider_cost_usd, spend, m.charges_on_failure
  ) returning * into g;

  from_subscription := least(wallet.subscription_balance, m.credits);
  insert into public.credit_reservations (user_id, generation_id, amount, subscription_amount, purchased_amount)
  values (p_user_id, g.id, m.credits, from_subscription, m.credits - from_subscription);

  perform public.wallet_move(p_user_id, -from_subscription, -(m.credits - from_subscription), 'generation', m.name,
    p_generation_id => g.id);
  return g;
end;
$$;
revoke execute on function public.create_generation(uuid, text, text, uuid, uuid, text, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.create_generation(uuid, text, text, uuid, uuid, text, uuid, uuid, text) to service_role;

-- ------------------------------------------------- consumo da pessoa

-- O que a pessoa vê: só créditos e limites do próprio plano. Nada de custo do fornecedor.
create function public.my_usage() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  plan public.subscription_plans;
  day_start timestamptz := public.spend_day_start();
  month_start timestamptz := public.spend_month_start();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  plan := public.effective_plan(uid);
  return jsonb_build_object(
    'plan_slug', plan.slug,
    'daily_limit', plan.daily_credit_limit,
    'monthly_limit', plan.monthly_credit_limit,
    'used_today', public.user_credits_used(uid, day_start),
    'used_month', public.user_credits_used(uid, month_start),
    'day_resets_at', day_start + interval '1 day',
    'month_resets_at', (date_trunc('month', now() at time zone 'America/Sao_Paulo') + interval '1 month') at time zone 'America/Sao_Paulo',
    'paused', (select generation_paused from public.pricing_settings)
  );
end;
$$;
revoke execute on function public.my_usage() from public, anon;
grant execute on function public.my_usage() to authenticated;

-- ------------------------------------------------------------- admin

create function public.admin_spend_guard() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  settings public.pricing_settings;
  day_start timestamptz := public.spend_day_start();
  month_start timestamptz := public.spend_month_start();
  sees_users boolean;
begin
  perform public.assert_admin_permission('finance.view');
  sees_users := public.has_admin_permission('users.view');
  select * into settings from public.pricing_settings;
  return jsonb_build_object(
    'daily_cost_cap_usd', settings.daily_cost_cap_usd,
    'monthly_cost_cap_usd', settings.monthly_cost_cap_usd,
    'cost_alert_ratio', settings.cost_alert_ratio,
    'generation_paused', settings.generation_paused,
    'paused_reason', settings.paused_reason,
    'spent_today_usd', public.platform_spend_usd(day_start),
    'spent_month_usd', public.platform_spend_usd(month_start),
    'failed_billed_month_usd', (select coalesce(sum(spend_usd), 0) from public.generations
      where created_at >= month_start and status = 'failed' and billed_on_failure),
    'estimated_month_count', (select count(*) from public.generations
      where created_at >= month_start and provider_cost_usd is null and (status <> 'failed' or billed_on_failure)),
    'top_today', case when sees_users then coalesce((
      select jsonb_agg(row_to_json(r) order by r.spend_usd desc)
      from (
        select g.user_id, u.email::text as email, sum(g.credits)::integer as credits, sum(g.spend_usd) as spend_usd
        from public.generations g join auth.users u on u.id = g.user_id
        where g.created_at >= day_start and (g.status <> 'failed' or g.billed_on_failure)
        group by g.user_id, u.email
        order by sum(g.spend_usd) desc
        limit 5
      ) r
    ), '[]'::jsonb) end
  );
end;
$$;
grant execute on function public.admin_spend_guard() to authenticated;

create function public.admin_update_spend_guard(
  p_daily_cap_usd numeric, p_monthly_cap_usd numeric, p_alert_ratio numeric, p_paused boolean, p_reason text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  admin_id uuid := public.assert_admin_permission('pricing.manage');
  before public.pricing_settings;
  after public.pricing_settings;
  reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if p_paused and char_length(coalesce(reason, '')) < 5 then raise exception 'reason_required'; end if;
  if (p_daily_cap_usd is not null and p_daily_cap_usd <= 0) or (p_monthly_cap_usd is not null and p_monthly_cap_usd <= 0)
     or p_alert_ratio is null or p_alert_ratio not between 0.1 and 1 then
    raise exception 'invalid_amount';
  end if;
  if p_daily_cap_usd is not null and p_monthly_cap_usd is not null and p_daily_cap_usd > p_monthly_cap_usd then
    raise exception 'invalid_cap_order';
  end if;

  select * into before from public.pricing_settings for update;
  update public.pricing_settings
  set daily_cost_cap_usd = p_daily_cap_usd,
      monthly_cost_cap_usd = p_monthly_cap_usd,
      cost_alert_ratio = p_alert_ratio,
      generation_paused = p_paused,
      paused_reason = case when p_paused then left(reason, 300) end,
      updated_at = now()
  returning * into after;

  perform public.admin_log(admin_id, 'spend_guard.update', null, null,
    jsonb_build_object(
      'before', jsonb_build_object('daily', before.daily_cost_cap_usd, 'monthly', before.monthly_cost_cap_usd,
        'alert', before.cost_alert_ratio, 'paused', before.generation_paused),
      'after', jsonb_build_object('daily', after.daily_cost_cap_usd, 'monthly', after.monthly_cost_cap_usd,
        'alert', after.cost_alert_ratio, 'paused', after.generation_paused)),
    reason);
  return public.admin_spend_guard();
end;
$$;
grant execute on function public.admin_update_spend_guard(numeric, numeric, numeric, boolean, text) to authenticated;

-- Limite de consumo não é preço nem crédito contratado: muda sem versão nova e vale na hora.
create function public.admin_update_plan_limits(p_slug text, p_daily integer, p_monthly integer)
returns public.subscription_plans
language plpgsql security definer set search_path = public as $$
declare
  admin_id uuid := public.assert_admin_permission('plans.manage');
  before public.subscription_plans;
  after public.subscription_plans;
begin
  if (p_daily is not null and p_daily <= 0) or (p_monthly is not null and p_monthly <= 0) then raise exception 'invalid_amount'; end if;
  if p_daily is not null and p_monthly is not null and p_daily > p_monthly then raise exception 'invalid_cap_order'; end if;

  select * into before from public.subscription_plans where slug = p_slug for update;
  if not found then raise exception 'plan_not_found'; end if;

  update public.subscription_plans
  set daily_credit_limit = p_daily, monthly_credit_limit = p_monthly, updated_at = now()
  where slug = p_slug
  returning * into after;

  perform public.admin_log(admin_id, 'plan.limits', null, p_slug,
    jsonb_build_object(
      'before', jsonb_build_object('daily', before.daily_credit_limit, 'monthly', before.monthly_credit_limit),
      'after', jsonb_build_object('daily', after.daily_credit_limit, 'monthly', after.monthly_credit_limit)),
    null);
  return after;
end;
$$;
grant execute on function public.admin_update_plan_limits(text, integer, integer) to authenticated;
