-- Virada para os preços finais (0021: Starter R$ 79,90 / 2.300, Pro R$ 169,90 / 5.000, Max R$ 349,90 / 10.000),
-- pedida pela Lay em 09/11/2026 antes das tarifas estarem todas conferidas no fornecedor.
--
-- Mesmos passos de `admin_activate_pricing_v2` (0019), com duas diferenças, de propósito:
--   1. não exige custo conferido em todo modelo ativo (o texto ainda não tem volume de tokens medido;
--      sem custo, o modelo usa a conversão do preço antigo, `quote_credits`);
--   2. deixa a trava de custo (`require_trusted_cost`) como está, desligada: ligar agora tiraria do ar
--      todo modelo sem conferência. Ligar depois, pelo painel, quando as tarifas forem confirmadas.
-- O resto é igual: foto de tudo (a volta `admin_rollback_pricing_v2` continua valendo enquanto ninguém
-- assinar plano novo), saldos convertidos pelo fator (mesmo poder de compra), assinaturas antigas mantêm
-- o preço com os créditos na régua nova, planos antigos saem da venda e os novos entram.
--
-- Esta migration só cria a função. A virada roda em seguida, no SQL Editor:
--   select public.pricing_switch_from_console('Virada para os preços finais aprovados em 09/11');

create function public.pricing_switch_from_console(p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  settings public.pricing_settings;
  factor numeric;
  wallet record;
  converted integer := 0;
  snapshot_id uuid;
  owner_id uuid := (select user_id from public.admin_users where role = 'super_admin' order by created_at limit 1);
begin
  if p_reason is null or char_length(trim(p_reason)) < 10 then raise exception 'activation_reason_required'; end if;

  select * into settings from public.pricing_settings for update;
  if settings.credit_scale = 2 then raise exception 'already_activated'; end if;
  -- Reserva aberta seria estornada na régua antiga depois da conversão: espera terminar.
  if exists (select 1 from public.generations where status in ('queued', 'running'))
     or exists (select 1 from public.credit_reservations where status = 'held') then
    raise exception 'open_generations';
  end if;
  if not exists (select 1 from public.subscription_plans where line = 'creator' and status = 'draft' and not contact_only) then
    raise exception 'no_draft_plans';
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
    owner_id
  )
  returning id into snapshot_id;

  update public.models set credits = public.quote_credits(provider_cost_usd, credits, settings), updated_at = now();

  for wallet in select user_id, subscription_balance, purchased_balance from public.credit_balances where balance > 0 for update loop
    perform public.wallet_move(
      wallet.user_id,
      floor(wallet.subscription_balance * factor)::integer - wallet.subscription_balance,
      floor(wallet.purchased_balance * factor)::integer - wallet.purchased_balance,
      'adjustment', 'Conversão para a nova escala de créditos (mesmo poder de compra)',
      null, null, null, null, owner_id, 'pricing-v2-scale:' || snapshot_id::text || ':' || wallet.user_id::text
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
  set credit_scale = 2, scale_activated_at = now(), welcome_credits = settings.next_welcome_credits,
      credit_value_brl = coalesce((select min(price_cents / 100.0 / monthly_credits) from public.subscription_plans
        where status = 'live' and public and monthly_credits > 0), credit_value_brl),
      updated_at = now();

  perform public.admin_log(owner_id, 'pricing.activate_v2', null, null, jsonb_build_object(
    'factor', round(factor, 4), 'wallets', converted, 'welcome_credits', settings.next_welcome_credits,
    'snapshot', snapshot_id, 'source', 'sql_console', 'trusted_cost_required', settings.require_trusted_cost), trim(p_reason));
  return jsonb_build_object('factor', round(factor, 4), 'wallets', converted, 'snapshot', snapshot_id);
end;
$$;
-- Só pelo SQL Editor (dono do banco). Nenhum papel do app chama.
revoke execute on function public.pricing_switch_from_console(text) from public, anon, authenticated;
