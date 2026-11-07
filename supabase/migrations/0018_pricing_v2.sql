-- Preços v2 (Creator e Business), cotação de crédito pelo custo, cota de exportação do
-- Multiplicador e base do financeiro. Só acrescenta: nenhum plano, saldo ou assinatura muda aqui.
--
-- Os planos novos nascem como rascunho (`status = 'draft'`, sem checkout). A troca para a escala
-- nova de créditos (R$ 0,01 de orçamento por crédito) só acontece por `admin_activate_pricing_v2`,
-- que converte saldos, pacotes, modelos e assinaturas de uma vez. Ver docs/precos-v2.md.

-- ------------------------------------------------- parâmetros de preço

alter table public.pricing_settings
  -- Orçamento interno de custo por crédito. Nunca aparece para a pessoa como valor em reais.
  add column credit_budget_brl numeric(8, 4) not null default 0.01 check (credit_budget_brl > 0),
  -- Reserva sobre o custo estimado (câmbio, variação do fornecedor). Não é margem de lucro.
  add column safety_factor numeric(5, 3) not null default 1.15 check (safety_factor between 1 and 3),
  -- Custo médio de um crédito da escala atual (0006: o fal custa ~R$ 0,09 por crédito).
  -- Serve de base para cotar modelo sem custo cadastrado e para converter saldos na virada.
  add column legacy_cost_per_credit_brl numeric(8, 4) not null default 0.09 check (legacy_cost_per_credit_brl > 0),
  -- Custo conferido há mais tempo que isso vira alerta de preço desatualizado.
  add column cost_stale_days integer not null default 30 check (cost_stale_days between 1 and 365),
  add column welcome_credits integer not null default 20 check (welcome_credits between 0 and 1000),
  -- 1 = escala atual; 2 = escala v2, depois de `admin_activate_pricing_v2`.
  add column credit_scale smallint not null default 1 check (credit_scale in (1, 2)),
  add column scale_activated_at timestamptz;

-- Custos que não são de API, para o resultado do mês. Tudo estimativa até haver fatura real.
create table public.finance_settings (
  id boolean primary key default true check (id),
  tax_rate numeric(5, 4) not null default 0.06 check (tax_rate between 0 and 0.5),
  fixed_costs_cents integer not null default 0 check (fixed_costs_cents >= 0),
  infra_costs_cents integer not null default 0 check (infra_costs_cents >= 0),
  storage_costs_cents integer not null default 0 check (storage_costs_cents >= 0),
  -- A montagem do Multiplicador roda no navegador: custo zero por exportação até existir render próprio.
  render_cost_cents_per_export integer not null default 0 check (render_cost_cents_per_export >= 0),
  pro_labore_cents integer not null default 0 check (pro_labore_cents >= 0),
  reserve_rate numeric(5, 4) not null default 0.10 check (reserve_rate between 0 and 0.9),
  min_margin_rate numeric(5, 4) not null default 0.40 check (min_margin_rate between 0 and 0.95),
  updated_at timestamptz not null default now()
);
insert into public.finance_settings default values;

alter table public.finance_settings enable row level security;
revoke all on public.finance_settings from anon, authenticated;

-- ------------------------------------------------------------- modelos

alter table public.models
  add column cost_checked_at timestamptz,
  add column cost_source text check (char_length(cost_source) <= 300);

-- Créditos de uma operação na escala v2:
-- custo (US$ × câmbio) × fator de segurança ÷ orçamento por crédito, arredondado para cima.
-- Sem custo cadastrado, a base é o preço atual × custo médio do crédito atual.
create function public.quote_credits(p_provider_cost_usd numeric, p_legacy_credits integer, settings public.pricing_settings)
returns integer
language sql immutable set search_path = public as $$
  select greatest(1, ceil(round(
    coalesce(p_provider_cost_usd * settings.usd_brl, p_legacy_credits * settings.legacy_cost_per_credit_brl)
    * settings.safety_factor / settings.credit_budget_brl, 6)))::integer;
$$;
revoke execute on function public.quote_credits(numeric, integer, public.pricing_settings) from public, anon, authenticated;

-- Custo estimado em reais de uma operação. Sem custo cadastrado: na escala atual, o preço × custo
-- médio do crédito; depois da virada, o orçamento que os créditos cobrados cobrem.
create function public.model_estimated_brl(p_provider_cost_usd numeric, p_credits integer, settings public.pricing_settings)
returns numeric
language sql immutable set search_path = public as $$
  select coalesce(
    p_provider_cost_usd * settings.usd_brl,
    case when settings.credit_scale = 1 then p_credits * settings.legacy_cost_per_credit_brl
         else p_credits * settings.credit_budget_brl / settings.safety_factor end
  );
$$;
revoke execute on function public.model_estimated_brl(numeric, integer, public.pricing_settings) from public, anon, authenticated;

-- ---------------------------------------------------------------- planos

alter table public.subscription_plans
  add column line text not null default 'creator' check (line in ('creator', 'business')),
  add column status text not null default 'live' check (status in ('draft', 'live', 'legacy')),
  -- Exportações editadas do Multiplicador por mês (nulo = sem limite).
  add column max_exports_month integer check (max_exports_month >= 0),
  add column max_seats integer not null default 1 check (max_seats between 1 and 500),
  -- Sem checkout: a vitrine leva para conversa.
  add column contact_only boolean not null default false,
  -- Rascunho e plano antigo nunca vão para o checkout (o `subscribe` só vende `public`).
  add constraint subscription_plans_sold_live check (status = 'live' or not public),
  add constraint subscription_plans_contact_not_sold check (not (contact_only and public));

-- Exportações nos planos atuais, na mesma régua dos novos.
update public.subscription_plans set max_exports_month = 3 where slug = 'gratis';
update public.subscription_plans set max_exports_month = 40 where slug = 'starter';
update public.subscription_plans set max_exports_month = 150 where slug = 'pro';
update public.subscription_plans set max_exports_month = 400 where slug = 'studio';

-- Catálogo novo, em rascunho e já na escala v2 de créditos. Valores são hipóteses comerciais.
-- Limite de consumo: dia = créditos do mês; mês = 5x (mesma régua da 0016).
-- Business fica em rascunho e só por contato até existir organização com membros.
insert into public.subscription_plans (
  slug, name, description, price_cents, monthly_credits, max_concurrent, features, public, highlight, active, position,
  max_personas, tools, max_brands, daily_credit_limit, monthly_credit_limit, max_variations,
  line, status, max_exports_month, max_seats, contact_only
) values
  ('creator-start', 'Creator Start', 'Para começar a criar com IA toda semana.', 6990, 1000, 3,
   array['1.000 créditos IA por mês', '40 exportações editadas por mês', 'Multiplicador criativo', 'Gerador de imagens', 'Roteiros e copys'],
   false, false, false, 110, 2, array['copy', 'prompt_library', 'projects'], 1, 1000, 5000, 5,
   'creator', 'draft', 40, 1, false),
  ('creator-pro', 'Creator Pro', 'Para quem publica todo dia e precisa de volume.', 14990, 2500, 4,
   array['2.500 créditos IA por mês', '150 exportações editadas por mês', 'Multiplicador em lote', 'Imagens e vídeos com IA', 'UGC e personagens'],
   false, true, false, 120, 5, array['copy', 'prompt_library', 'ugc_studio', 'projects'], 3, 2500, 12500, 10,
   'creator', 'draft', 150, 1, false),
  ('creator-max', 'Creator Max', 'Para produção em escala com modelos premium.', 29990, 6000, 6,
   array['6.000 créditos IA por mês', '400 exportações editadas por mês', 'Tudo do Creator Pro', 'Modelos premium de vídeo', 'Lotes maiores'],
   false, false, false, 130, 15, array['copy', 'prompt_library', 'ugc_studio', 'projects', 'motion_control'], 10, 6000, 30000, 15,
   'creator', 'draft', 400, 1, false),
  ('business-start', 'Business Start', 'Marketing e vendas com IA para pequenas equipes.', 39900, 4000, 4,
   array['4.000 créditos IA por mês', '2 usuários', 'Conteúdo com IA'],
   false, false, false, 210, 5, array['copy', 'prompt_library', 'ugc_studio', 'projects'], 5, 4000, 20000, 10,
   'business', 'draft', 400, 2, true),
  ('business-pro', 'Business Pro', 'Operação comercial e de marketing com equipe.', 89900, 10000, 6,
   array['10.000 créditos IA por mês', '5 usuários', 'Tudo do Business Start'],
   false, true, false, 220, 15, array['copy', 'prompt_library', 'ugc_studio', 'projects', 'motion_control'], 15, 10000, 50000, 15,
   'business', 'draft', 1000, 5, true),
  ('business-scale', 'Business Scale', 'Para agências e operações com muitos clientes.', 199900, 25000, 8,
   array['25.000 créditos IA por mês', '15 usuários', 'Tudo do Business Pro'],
   false, false, false, 230, 30, array['copy', 'prompt_library', 'ugc_studio', 'projects', 'motion_control'], 40, 25000, 125000, 15,
   'business', 'draft', 2500, 15, true),
  ('enterprise', 'Enterprise', 'Volume, usuários e limites sob medida.', 0, 0, 8,
   array['Créditos sob medida', 'Usuários sob medida'],
   false, false, false, 240, 30, array['copy', 'prompt_library', 'ugc_studio', 'projects', 'motion_control'], 40, null, null, 15,
   'business', 'draft', null, 50, true)
on conflict (slug) do nothing;

-- Orçamento interno de custo de IA por assinante no mês: parâmetro de controle, não benefício.
-- Fica fora de `subscription_plans` porque a tabela de planos é pública (vitrine e app leem).
create table public.plan_cost_budgets (
  plan_slug text primary key references public.subscription_plans (slug) on delete cascade,
  ai_budget_cents integer not null check (ai_budget_cents >= 0),
  updated_at timestamptz not null default now()
);
insert into public.plan_cost_budgets (plan_slug, ai_budget_cents) values
  ('creator-start', 1000), ('creator-pro', 2500), ('creator-max', 6000),
  ('business-start', 4000), ('business-pro', 10000), ('business-scale', 25000)
on conflict (plan_slug) do nothing;
alter table public.plan_cost_budgets enable row level security;
revoke all on public.plan_cost_budgets from anon, authenticated;

-- Acesso a modelo nos planos novos: Veo (premium) a partir do Creator Max; Kling a partir do Creator Pro;
-- Roteiro UGC onde há UGC. Planos atuais continuam como estão.
update public.models set allowed_plans = allowed_plans || array['creator-max', 'business-pro', 'business-scale', 'enterprise'], updated_at = now()
where slug = 'video-veo' and allowed_plans is not null;
update public.models set allowed_plans = array['gratis', 'starter', 'pro', 'studio', 'creator-pro', 'creator-max',
  'business-start', 'business-pro', 'business-scale', 'enterprise'], updated_at = now()
where slug in ('video-kling') and allowed_plans is null;
update public.models set allowed_plans = allowed_plans || array['creator-pro', 'creator-max', 'business-start', 'business-pro', 'business-scale', 'enterprise'],
  updated_at = now()
where slug = 'ugc-roteiro' and allowed_plans is not null;

-- --------------------------------------------------- conta nova

-- Boas-vindas vêm de `pricing_settings.welcome_credits` (20 hoje; a virada define o novo valor).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  signup_bonus integer := (select welcome_credits from public.pricing_settings);
begin
  insert into public.profiles (id, display_name, username)
  values (new.id, left(nullif(new.raw_user_meta_data ->> 'display_name', ''), 80), public.unique_username(new.email));

  insert into public.credit_balances (user_id, balance, purchased_balance) values (new.id, 0, 0);
  if signup_bonus > 0 then
    perform public.wallet_move(new.id, 0, signup_bonus, 'signup_bonus', 'Créditos de boas-vindas');
  end if;
  insert into public.user_preferences (user_id) values (new.id);
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ------------------------------------------ exportações do Multiplicador

-- Cada vídeo montado conta uma exportação. A montagem roda no navegador da pessoa: o banco
-- controla a cota (começo, fim, falha) e guarda as medidas para o custo de infraestrutura.
create table public.multiplier_exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  variation_id uuid references public.multiplier_variations (id) on delete set null,
  status text not null default 'started' check (status in ('started', 'done', 'failed')),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 80),
  duration_seconds numeric(6, 2) check (duration_seconds between 0 and 600),
  width integer check (width between 1 and 4096),
  height integer check (height between 1 and 4096),
  render_ms integer check (render_ms between 0 and 3600000),
  bytes bigint check (bytes between 0 and 2000000000),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (user_id, idempotency_key)
);

create index multiplier_exports_user_recent on public.multiplier_exports (user_id, created_at desc);
create index multiplier_exports_created on public.multiplier_exports (created_at) where status = 'done';

alter table public.multiplier_exports enable row level security;
revoke all on public.multiplier_exports from anon, authenticated;
grant select on public.multiplier_exports to authenticated;
create policy "own exports" on public.multiplier_exports for select to authenticated using (user_id = auth.uid());

-- Exportação começada há mais de 30 min sem fim não segura mais a cota (aba fechada no meio).
create function public.user_exports_used(p_user_id uuid, p_since timestamptz) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::integer from public.multiplier_exports
  where user_id = p_user_id and created_at >= p_since
    and (status = 'done' or (status = 'started' and created_at > now() - interval '30 minutes'));
$$;
revoke execute on function public.user_exports_used(uuid, timestamptz) from public, anon, authenticated;

create function public.start_multiplier_export(p_variation_id uuid, p_idempotency_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  plan public.subscription_plans;
  existing public.multiplier_exports;
  used integer;
  open_now integer;
  new_id uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 8 and 80 then raise exception 'invalid_idempotency_key'; end if;
  if not exists (select 1 from public.multiplier_variations where id = p_variation_id and user_id = uid) then
    raise exception 'variation_not_found';
  end if;

  -- A mesma conta exportando em duas abas ao mesmo tempo não fura a cota.
  perform pg_advisory_xact_lock(hashtextextended('export:' || uid::text, 0));

  select * into existing from public.multiplier_exports where user_id = uid and idempotency_key = p_idempotency_key;
  plan := public.effective_plan(uid);
  used := public.user_exports_used(uid, public.spend_month_start());
  if existing.id is not null then
    return jsonb_build_object('id', existing.id, 'used', used, 'limit', plan.max_exports_month);
  end if;

  if plan.max_exports_month is not null and used >= plan.max_exports_month then raise exception 'export_limit_reached'; end if;
  select count(*) into open_now from public.multiplier_exports
  where user_id = uid and status = 'started' and created_at > now() - interval '30 minutes';
  if open_now >= plan.max_concurrent then raise exception 'too_many_exports'; end if;

  insert into public.multiplier_exports (user_id, variation_id, idempotency_key)
  values (uid, p_variation_id, p_idempotency_key)
  returning id into new_id;
  return jsonb_build_object('id', new_id, 'used', used + 1, 'limit', plan.max_exports_month);
end;
$$;

create function public.finish_multiplier_export(
  p_export_id uuid, p_duration_seconds numeric, p_width integer, p_height integer, p_render_ms integer, p_bytes bigint
) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  update public.multiplier_exports
  set status = 'done', finished_at = now(), duration_seconds = p_duration_seconds, width = p_width, height = p_height,
      render_ms = p_render_ms, bytes = p_bytes
  where id = p_export_id and user_id = auth.uid() and status = 'started';
  return found;
end;
$$;

-- Falhou ou cancelou: devolve a exportação para a cota.
create function public.fail_multiplier_export(p_export_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  update public.multiplier_exports set status = 'failed', finished_at = now()
  where id = p_export_id and user_id = auth.uid() and status = 'started';
  return found;
end;
$$;

revoke execute on function public.start_multiplier_export(uuid, text) from public, anon;
revoke execute on function public.finish_multiplier_export(uuid, numeric, integer, integer, integer, bigint) from public, anon;
revoke execute on function public.fail_multiplier_export(uuid) from public, anon;
grant execute on function public.start_multiplier_export(uuid, text) to authenticated;
grant execute on function public.finish_multiplier_export(uuid, numeric, integer, integer, integer, bigint) to authenticated;
grant execute on function public.fail_multiplier_export(uuid) to authenticated;

-- O consumo da pessoa ganha as exportações do mês.
create or replace function public.my_usage() returns jsonb
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
    'exports_limit', plan.max_exports_month,
    'exports_used', public.user_exports_used(uid, month_start),
    'day_resets_at', day_start + interval '1 day',
    'month_resets_at', (date_trunc('month', now() at time zone 'America/Sao_Paulo') + interval '1 month') at time zone 'America/Sao_Paulo',
    'paused', (select generation_paused from public.pricing_settings)
  );
end;
$$;
revoke execute on function public.my_usage() from public, anon;
grant execute on function public.my_usage() to authenticated;

-- ------------------------------------------------------------- admin

-- Mudar o custo do fornecedor carimba a data da conferência (base do alerta de preço velho).
create or replace function public.admin_update_model(
  p_slug text, p_active boolean, p_credits integer, p_provider_cost_usd numeric, p_allowed_plans text[]
) returns public.models
language plpgsql security definer set search_path = public as $$
declare
  admin_id uuid := public.assert_admin_permission('models.manage');
  before public.models;
  after public.models;
begin
  select * into before from public.models where slug = p_slug for update;
  if not found then raise exception 'model_not_found'; end if;
  if p_allowed_plans is not null and exists (
    select 1 from unnest(p_allowed_plans) as plan where plan not in (select slug from public.subscription_plans)
  ) then
    raise exception 'plan_not_found';
  end if;

  update public.models
  set active = p_active, credits = p_credits, provider_cost_usd = p_provider_cost_usd,
      allowed_plans = case when cardinality(p_allowed_plans) = 0 then null else p_allowed_plans end,
      cost_checked_at = case when p_provider_cost_usd is distinct from before.provider_cost_usd and p_provider_cost_usd is not null
        then now() else cost_checked_at end,
      updated_at = now()
  where slug = p_slug
  returning * into after;

  perform public.admin_log(admin_id, 'model.update', null, p_slug,
    jsonb_build_object(
      'before', jsonb_build_object('active', before.active, 'credits', before.credits, 'cost', before.provider_cost_usd, 'plans', before.allowed_plans),
      'after', jsonb_build_object('active', after.active, 'credits', after.credits, 'cost', after.provider_cost_usd, 'plans', after.allowed_plans)
    ), null);
  return after;
end;
$$;

-- Confirma que o preço do fornecedor foi conferido hoje, com a fonte (link da página de preço).
create function public.admin_confirm_model_cost(p_slug text, p_source text) returns public.models
language plpgsql security definer set search_path = public as $$
declare
  admin_id uuid := public.assert_admin_permission('models.manage');
  after public.models;
begin
  if p_source is null or char_length(trim(p_source)) < 5 then raise exception 'source_required'; end if;
  update public.models set cost_checked_at = now(), cost_source = left(trim(p_source), 300), updated_at = now()
  where slug = p_slug and provider_cost_usd is not null
  returning * into after;
  if not found then raise exception 'cost_required'; end if;
  perform public.admin_log(admin_id, 'model.cost_confirm', null, p_slug, jsonb_build_object('source', after.cost_source), null);
  return after;
end;
$$;

-- Cotação de cada modelo na escala v2, lado a lado com o preço atual.
create function public.admin_model_quotes() returns jsonb
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
      'welcome_credits', settings.welcome_credits
    ),
    'models', coalesce((
      select jsonb_agg(row_to_json(r) order by r.position)
      from (
        select m.slug, m.name, m.kind, m.provider, m.endpoint, m.defaults, m.active, m.position, m.credits,
          m.provider_cost_usd, m.cost_checked_at, m.cost_source,
          case when m.provider_cost_usd is null then 'legacy_estimate' else 'provider_cost' end as basis,
          round(public.model_estimated_brl(m.provider_cost_usd, m.credits, settings), 4) as estimated_brl,
          round(public.model_estimated_brl(m.provider_cost_usd, m.credits, settings) * settings.safety_factor, 4) as protected_brl,
          greatest(1, ceil(round(public.model_estimated_brl(m.provider_cost_usd, m.credits, settings) * settings.safety_factor
            / settings.credit_budget_brl, 6)))::integer as quoted_credits,
          (m.cost_checked_at is null or m.cost_checked_at < now() - make_interval(days => settings.cost_stale_days)) as stale
        from public.models m
      ) r
    ), '[]'::jsonb)
  );
end;
$$;

-- Parâmetros da escala v2 (fator de segurança, orçamento por crédito, base do custo atual, prazo do alerta).
create function public.admin_update_credit_policy(
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
  returning * into after;
  perform public.admin_log(admin_id, 'pricing.credit_policy', null, null, jsonb_build_object(
    'before', jsonb_build_object('safety_factor', before.safety_factor, 'credit_budget_brl', before.credit_budget_brl,
      'legacy_cost_per_credit_brl', before.legacy_cost_per_credit_brl, 'cost_stale_days', before.cost_stale_days),
    'after', jsonb_build_object('safety_factor', after.safety_factor, 'credit_budget_brl', after.credit_budget_brl,
      'legacy_cost_per_credit_brl', after.legacy_cost_per_credit_brl, 'cost_stale_days', after.cost_stale_days)), null);
  return after;
end;
$$;

create function public.admin_finance_settings() returns public.finance_settings
language plpgsql stable security definer set search_path = public as $$
declare
  settings public.finance_settings;
begin
  perform public.assert_admin_permission('finance.view');
  select * into settings from public.finance_settings;
  return settings;
end;
$$;

create function public.admin_update_finance_settings(
  p_tax_rate numeric, p_fixed_costs_cents integer, p_infra_costs_cents integer, p_storage_costs_cents integer,
  p_render_cost_cents_per_export integer, p_pro_labore_cents integer, p_reserve_rate numeric, p_min_margin_rate numeric
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
      pro_labore_cents = p_pro_labore_cents, reserve_rate = p_reserve_rate, min_margin_rate = p_min_margin_rate, updated_at = now()
  returning * into after;
  perform public.admin_log(admin_id, 'finance.settings', null, null,
    jsonb_build_object('before', to_jsonb(before) - 'updated_at', 'after', to_jsonb(after) - 'updated_at'), null);
  return after;
end;
$$;

-- Financeiro do período [p_from, p_to): números crus. O demonstrativo (margem, resultado, reserva,
-- distribuível) é calculado no front por `financeStatement`, a mesma conta do simulador.
-- Custo de API = `spend_usd` (custo cadastrado ou pior caso) de quem deu certo ou foi cobrado na falha.
create function public.admin_finance(p_from timestamptz, p_to timestamptz) returns jsonb
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
  )
  select jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to, 'days', round(extract(epoch from span) / 86400.0, 2)),
    'usd_brl', settings.usd_brl,
    'payment_fee_rate', settings.payment_fee_rate,
    'credit_scale', settings.credit_scale,
    'settings', (select to_jsonb(f) - 'id' from public.finance_settings f),
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
    'api_cost_estimated_count', (select count(*) from billed where provider_cost_usd is null),
    'failed_billed_usd', (select coalesce(sum(spend_usd), 0) from billed where status = 'failed'),
    'exports_done', (select count(*) from public.multiplier_exports where status = 'done' and created_at >= p_from and created_at < p_to),
    'export_render_ms', (select coalesce(sum(render_ms), 0) from public.multiplier_exports where status = 'done' and created_at >= p_from and created_at < p_to),
    'export_bytes', (select coalesce(sum(bytes), 0) from public.multiplier_exports where status = 'done' and created_at >= p_from and created_at < p_to),
    'by_plan', coalesce((
      select jsonb_agg(row_to_json(r) order by r.position)
      from (
        select p.slug, p.name, p.line, p.status, p.position, p.price_cents,
          (select b.ai_budget_cents from public.plan_cost_budgets b where b.plan_slug = p.slug) as ai_budget_cents,
          (select count(*) from live l where l.plan_slug = p.slug) as subscribers,
          (select coalesce(sum(l.price_cents), 0) from live l where l.plan_slug = p.slug) as mrr_cents,
          (select coalesce(sum(x.cents), 0) from received x where x.plan_slug = p.slug and x.at >= p_from and x.at < p_to) as revenue_cents
        from public.subscription_plans p
        where p.status <> 'draft' or exists (select 1 from live l where l.plan_slug = p.slug)
      ) r
    ), '[]'::jsonb),
    'by_user', coalesce((
      select jsonb_agg(row_to_json(r) order by r.cost_usd desc)
      from (
        select uc.user_id, u.email::text as email, plan.slug as plan_slug,
          (select b.ai_budget_cents from public.plan_cost_budgets b where b.plan_slug = plan.slug) as ai_budget_cents,
          uc.credits, uc.generations, round(uc.cost_usd, 4) as cost_usd,
          (select coalesce(sum(cents), 0) from received x where x.user_id = uc.user_id and x.at >= p_from and x.at < p_to) as revenue_cents,
          (select count(*) from public.multiplier_exports e where e.user_id = uc.user_id and e.status = 'done'
             and e.created_at >= p_from and e.created_at < p_to) as exports
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
          (select count(*) from public.generations g where g.model_slug = m.slug and g.created_at >= p_from and g.created_at < p_to) as total,
          (select count(*) from public.generations g where g.model_slug = m.slug and g.status = 'failed'
             and g.created_at >= p_from and g.created_at < p_to) as failed,
          (select count(*) from billed b where b.model_slug = m.slug) as billed,
          (select coalesce(sum(b.credits), 0) from billed b where b.model_slug = m.slug and b.status = 'succeeded') as credits,
          (select coalesce(sum(b.spend_usd), 0) from billed b where b.model_slug = m.slug) as cost_usd,
          (select count(*) from billed b where b.model_slug = m.slug and b.provider_cost_usd is null) as estimated,
          -- Operação deficitária: o custo passou do orçamento que os créditos cobrados cobrem.
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

-- ------------------------------------------------------ virada da escala

-- Liga os preços v2 de uma vez. Não roda sozinha: o admin chama depois de aprovar.
-- Antes: pausar a geração (painel Guarda de gasto) para não haver reserva aberta na escala antiga.
-- Converte pelo fator = custo médio do crédito atual × segurança ÷ orçamento por crédito, para que
-- cada saldo, pacote e assinatura antiga compre a mesma coisa que comprava. Nada é apagado.
create function public.admin_activate_pricing_v2(p_welcome_credits integer, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  admin_id uuid := public.assert_admin_permission('pricing.manage');
  settings public.pricing_settings;
  factor numeric;
  wallet record;
  converted integer := 0;
begin
  perform public.assert_admin_permission('plans.manage');
  if p_reason is null or char_length(trim(p_reason)) < 10 then raise exception 'activation_reason_required'; end if;
  if p_welcome_credits is null or p_welcome_credits not between 0 and 1000 then raise exception 'invalid_welcome_credits'; end if;

  select * into settings from public.pricing_settings for update;
  if settings.credit_scale = 2 then raise exception 'already_activated'; end if;
  if not settings.generation_paused then raise exception 'pause_required'; end if;
  if exists (select 1 from public.generations where status in ('queued', 'running'))
     or exists (select 1 from public.credit_reservations where status = 'held') then
    raise exception 'open_generations';
  end if;

  factor := settings.legacy_cost_per_credit_brl * settings.safety_factor / settings.credit_budget_brl;

  -- Preço de cada modelo pela cotação (custo cadastrado ou base do crédito atual).
  update public.models set credits = public.quote_credits(provider_cost_usd, credits, settings), updated_at = now();

  -- Saldos: cada balde vezes o fator, com linha no extrato.
  for wallet in select user_id, subscription_balance, purchased_balance from public.credit_balances where balance > 0 for update loop
    perform public.wallet_move(
      wallet.user_id,
      floor(wallet.subscription_balance * factor)::integer - wallet.subscription_balance,
      floor(wallet.purchased_balance * factor)::integer - wallet.purchased_balance,
      'adjustment', 'Conversão para a nova escala de créditos (mesmo poder de compra)',
      null, null, null, null, admin_id, 'pricing-v2-scale:' || wallet.user_id::text
    );
    converted := converted + 1;
  end loop;

  -- Assinaturas e planos atuais continuam valendo, com os créditos na escala nova.
  update public.subscriptions set monthly_credits = floor(monthly_credits * factor)::integer, updated_at = now()
  where status in ('pending', 'active', 'past_due', 'canceled');
  update public.subscription_plans
  set monthly_credits = floor(monthly_credits * factor)::integer,
      daily_credit_limit = floor(daily_credit_limit * factor)::integer,
      monthly_credit_limit = floor(monthly_credit_limit * factor)::integer,
      status = case when slug = 'gratis' then 'live' else 'legacy' end,
      public = false,
      highlight = false,
      updated_at = now()
  where status = 'live';
  update public.credit_packs set credits = floor(credits * factor)::integer;

  -- Creator entra no ar; Business segue em rascunho até existir organização com membros.
  update public.subscription_plans set status = 'live', active = true, public = true, updated_at = now()
  where line = 'creator' and status = 'draft' and not contact_only;

  update public.pricing_settings
  set credit_scale = 2, scale_activated_at = now(), welcome_credits = p_welcome_credits,
      -- Pior caso da guarda de gasto: o crédito mais barato vendido agora.
      credit_value_brl = coalesce((select min(price_cents / 100.0 / monthly_credits) from public.subscription_plans
        where status = 'live' and public and monthly_credits > 0), credit_value_brl),
      updated_at = now();

  perform public.admin_log(admin_id, 'pricing.activate_v2', null, null,
    jsonb_build_object('factor', round(factor, 4), 'wallets', converted, 'welcome_credits', p_welcome_credits), trim(p_reason));
  return jsonb_build_object('factor', round(factor, 4), 'wallets', converted);
end;
$$;

revoke execute on function public.admin_confirm_model_cost(text, text) from public, anon;
revoke execute on function public.admin_model_quotes() from public, anon;
revoke execute on function public.admin_update_credit_policy(numeric, numeric, numeric, integer) from public, anon;
revoke execute on function public.admin_finance_settings() from public, anon;
revoke execute on function public.admin_update_finance_settings(numeric, integer, integer, integer, integer, integer, numeric, numeric) from public, anon;
revoke execute on function public.admin_finance(timestamptz, timestamptz) from public, anon;
revoke execute on function public.admin_activate_pricing_v2(integer, text) from public, anon;
grant execute on function public.admin_update_model(text, boolean, integer, numeric, text[]) to authenticated;
grant execute on function public.admin_confirm_model_cost(text, text) to authenticated;
grant execute on function public.admin_model_quotes() to authenticated;
grant execute on function public.admin_update_credit_policy(numeric, numeric, numeric, integer) to authenticated;
grant execute on function public.admin_finance_settings() to authenticated;
grant execute on function public.admin_update_finance_settings(numeric, integer, integer, integer, integer, integer, numeric, numeric) to authenticated;
grant execute on function public.admin_finance(timestamptz, timestamptz) to authenticated;
grant execute on function public.admin_activate_pricing_v2(integer, text) to authenticated;
