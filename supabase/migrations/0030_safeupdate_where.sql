-- O Supabase barra UPDATE e DELETE sem WHERE nas chamadas que vêm do app (extensão safeupdate do papel
-- authenticator). As funções do admin que atualizam a linha única de configuração (preços, guarda de
-- gasto, financeiro, suporte) e a virada de preços faziam isso e falhavam no painel, mesmo passando no
-- teste local. Aqui elas são recriadas iguais à versão em vigor, só com o WHERE explícito. Permissões
-- (grant e revoke) continuam: create or replace mantém as que já existem.

-- admin_update_pricing (versão em vigor: 0014_admin_foundation.sql)
create or replace function public.admin_update_pricing(p_usd_brl numeric, p_fx_buffer numeric, p_markup numeric, p_credit_value_brl numeric)
returns public.pricing_settings
language plpgsql security definer set search_path = public as $$
declare
  admin_id uuid := public.assert_admin_permission('pricing.manage');
  before public.pricing_settings;
  after public.pricing_settings;
begin
  select * into before from public.pricing_settings;
  update public.pricing_settings
  set usd_brl = p_usd_brl, fx_buffer = p_fx_buffer, markup = p_markup, credit_value_brl = p_credit_value_brl, updated_at = now()
  where true
  returning * into after;
  perform public.admin_log(admin_id, 'pricing.update', null, null,
    jsonb_build_object('before', to_jsonb(before) - 'id' - 'updated_at', 'after', to_jsonb(after) - 'id' - 'updated_at'), null);
  return after;
end;
$$;

-- admin_update_spend_guard (versão em vigor: 0016_spend_guard.sql)
create or replace function public.admin_update_spend_guard(
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
  where true
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

-- admin_update_credit_policy (versão em vigor: 0018_pricing_v2.sql)
create or replace function public.admin_update_credit_policy(
  p_safety_factor numeric, p_credit_budget_brl numeric, p_legacy_cost_per_credit_brl numeric, p_cost_stale_days integer
) returns public.pricing_settings
language plpgsql security definer set search_path = public as $$
declare
  admin_id uuid := public.assert_admin_permission('pricing.manage');
  before public.pricing_settings;
  after public.pricing_settings;
begin
  select * into before from public.pricing_settings for update;
  -- Depois da virada, o orçamento por crédito é a régua dos saldos: não muda pelo painel.
  if before.credit_scale = 2 and p_credit_budget_brl <> before.credit_budget_brl then raise exception 'budget_locked_after_activation'; end if;
  update public.pricing_settings
  set safety_factor = p_safety_factor, credit_budget_brl = p_credit_budget_brl,
      legacy_cost_per_credit_brl = p_legacy_cost_per_credit_brl, cost_stale_days = p_cost_stale_days, updated_at = now()
  where true
  returning * into after;
  perform public.admin_log(admin_id, 'pricing.credit_policy', null, null, jsonb_build_object(
    'before', jsonb_build_object('safety_factor', before.safety_factor, 'credit_budget_brl', before.credit_budget_brl,
      'legacy_cost_per_credit_brl', before.legacy_cost_per_credit_brl, 'cost_stale_days', before.cost_stale_days),
    'after', jsonb_build_object('safety_factor', after.safety_factor, 'credit_budget_brl', after.credit_budget_brl,
      'legacy_cost_per_credit_brl', after.legacy_cost_per_credit_brl, 'cost_stale_days', after.cost_stale_days)), null);
  return after;
end;
$$;

-- admin_update_finance_settings (versão em vigor: 0019_pricing_v3.sql)
create or replace function public.admin_update_finance_settings(
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
  where true
  returning * into after;
  perform public.admin_log(admin_id, 'finance.settings', null, null,
    jsonb_build_object('before', to_jsonb(before) - 'updated_at', 'after', to_jsonb(after) - 'updated_at'), null);
  return after;
end;
$$;

-- admin_update_cost_guard (versão em vigor: 0019_pricing_v3.sql)
create or replace function public.admin_update_cost_guard(
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
  where true
  returning * into after;
  perform public.admin_log(admin_id, 'pricing.cost_guard', null, null, jsonb_build_object(
    'before', jsonb_build_object('max_operation_cost_usd', before.max_operation_cost_usd, 'next_welcome_credits', before.next_welcome_credits,
      'welcome_daily_cap', before.welcome_daily_cap, 'price_drift_tolerance', before.price_drift_tolerance),
    'after', jsonb_build_object('max_operation_cost_usd', after.max_operation_cost_usd, 'next_welcome_credits', after.next_welcome_credits,
      'welcome_daily_cap', after.welcome_daily_cap, 'price_drift_tolerance', after.price_drift_tolerance)), null);
  return after;
end;
$$;

-- admin_activate_pricing_v2 (versão em vigor: 0019_pricing_v3.sql)
create or replace function public.admin_activate_pricing_v2(p_reason text, p_accept_below_target boolean default false) returns jsonb
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

  update public.models set credits = public.quote_credits(provider_cost_usd, credits, settings), updated_at = now() where true;

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
  update public.credit_packs set credits = floor(credits * factor)::integer where true;

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

-- admin_rollback_pricing_v2 (versão em vigor: 0019_pricing_v3.sql)
create or replace function public.admin_rollback_pricing_v2(p_reason text) returns jsonb
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
      updated_at = now() where true;
  update public.pricing_v2_snapshots set rolled_back_at = now(), rolled_back_by = admin_id where id = snap.id;

  perform public.admin_log(admin_id, 'pricing.rollback_v2', null, null,
    jsonb_build_object('snapshot', snap.id, 'factor', snap.factor, 'wallets', converted), trim(p_reason));
  return jsonb_build_object('snapshot', snap.id, 'wallets', converted);
end;
$$;

-- admin_set_support_settings (versão em vigor: 0028_plan_benefits_support.sql)
create or replace function public.admin_set_support_settings(p_email text, p_whatsapp text, p_community_url text, p_reason text)
returns public.support_settings
language plpgsql security definer set search_path = public as $$
declare
  admin_id uuid := public.assert_admin_permission('plans.manage');
  before public.support_settings;
  after public.support_settings;
begin
  if char_length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'reason_required'; end if;
  select * into before from public.support_settings for update;
  update public.support_settings
  set email = nullif(trim(lower(p_email)), ''),
      whatsapp = nullif(regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g'), ''),
      community_url = nullif(trim(p_community_url), ''),
      updated_at = now()
  where id
  returning * into after;
  perform public.admin_log(admin_id, 'support.settings', null, null,
    jsonb_build_object('before', to_jsonb(before) - 'updated_at', 'after', to_jsonb(after) - 'updated_at'), trim(p_reason));
  return after;
end;
$$;
