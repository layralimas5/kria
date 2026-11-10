-- Central financeira do admin (Financeiro > Central financeira). Só leitura, mais filtros salvos.
--
-- `finance_movements(de, até)` junta numa lista só tudo o que mexe no caixa:
--   receitas: mensalidades (nova, renovação, upgrade, troca de plano) e pacotes de crédito, com o
--     status real do pagamento (pago, pendente, vencido, cancelado, reembolsado). Pedido criado e não
--     pago aparece como pendente ou cancelado e nunca entra na receita;
--   reembolsos: linha própria, na data do estorno quando o Asaas avisou;
--   despesas: custo de IA (por dia, pessoa e modelo, marcado como medido, estimado ou desconhecido),
--     taxa do gateway (conciliada pelo valor líquido do Asaas ou estimada pela taxa cadastrada) e as
--     despesas lançadas no painel;
--   ajustes: créditos dados ou tirados pelo admin (não mexem no caixa, valor zero).
-- `admin_finance_explorer(filtros)` aplica os mesmos filtros a indicadores, gráficos e tabela.
-- Permissões: `finance.view`; e-mail de cliente e busca por pessoa só com `users.view`.

create index if not exists subscription_payments_paid on public.subscription_payments (paid_at);
create index if not exists purchases_created on public.purchases (created_at);
create index if not exists billing_events_payment on public.billing_events ((payload -> 'payment' ->> 'id'));
create index if not exists credit_ledger_adjustments on public.credit_ledger (created_at) where reason = 'adjustment';

-- Plano da pessoa num instante: a assinatura mais recente já paga e ainda não encerrada; senão, grátis.
create function public.plan_slug_at(p_user uuid, p_at timestamptz) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((
    select s.plan_slug from public.subscriptions s
    where s.user_id = p_user
      and coalesce(s.ended_at, 'infinity') > p_at
      and exists (select 1 from public.subscription_payments p where p.subscription_id = s.id and p.paid_at <= p_at)
    order by s.created_at desc limit 1
  ), 'gratis')
$$;

-- Origem de uma mensalidade: renovação se a assinatura já tinha pago antes; senão, assinatura nova,
-- upgrade (plano anterior mais barato) ou troca de plano.
create function public.subscription_origin(p_subscription uuid, p_user uuid, p_price integer, p_at timestamptz, p_payment uuid default null)
returns text
language sql stable security definer set search_path = public as $$
  select case
    when exists (
      select 1 from public.subscription_payments e
      where e.subscription_id = p_subscription and e.paid_at <= p_at and e.id is distinct from p_payment
        and (e.paid_at < p_at or e.id < p_payment)
    ) then 'renewal'
    else coalesce((
      select case when p_price > s.price_cents then 'upgrade' else 'plan_change' end
      from public.subscriptions s join public.subscription_payments e on e.subscription_id = s.id
      where s.user_id = p_user and s.id <> p_subscription and e.paid_at < p_at
      order by e.paid_at desc limit 1
    ), 'subscription_new')
  end
$$;

-- Forma de pagamento, valor líquido e data do estorno, lidos dos eventos do Asaas guardados no webhook.
create function public.asaas_payment_facts(p_payment_id text)
returns table (method text, net_cents bigint, refunded_at timestamptz)
language sql stable security definer set search_path = public as $$
  select
    (select case upper(b.payload -> 'payment' ->> 'billingType')
        when 'PIX' then 'pix' when 'CREDIT_CARD' then 'card' when 'BOLETO' then 'boleto'
        when 'UNDEFINED' then null else lower(b.payload -> 'payment' ->> 'billingType') end
      from public.billing_events b
      where p_payment_id is not null and b.payload -> 'payment' ->> 'id' = p_payment_id
        and b.payload -> 'payment' ->> 'billingType' is not null
      order by b.received_at desc limit 1),
    (select round((b.payload -> 'payment' ->> 'netValue')::numeric * 100)::bigint
      from public.billing_events b
      where p_payment_id is not null and b.payload -> 'payment' ->> 'id' = p_payment_id
        and (b.payload -> 'payment' ->> 'netValue') ~ '^[0-9]+(\.[0-9]+)?$'
      order by b.received_at desc limit 1),
    (select min(b.received_at) from public.billing_events b
      where p_payment_id is not null and b.event = 'PAYMENT_REFUNDED' and b.payload -> 'payment' ->> 'id' = p_payment_id)
$$;

create type public.finance_movement as (
  id text,
  occurred_at timestamptz,
  type text,          -- revenue | expense | refund | adjustment
  status text,        -- paid | pending | overdue | canceled | refunded
  source text,        -- subscription_new | renewal | upgrade | plan_change | credit_pack (só receita)
  category text,      -- ai | payment_fees | infra | tools | services | marketing | taxes | payroll | other (só despesa)
  plan_slug text,
  user_id uuid,
  description text,
  amount_cents bigint,
  net_cents bigint,   -- valor líquido conciliado no Asaas, quando houver
  credits integer,
  method text,        -- pix | card | boleto | other | unknown (receita, reembolso e taxa)
  reference text,     -- id do pagamento no Asaas ou id interno
  ai_provider text,
  ai_model text,
  ai_feature text,
  cost_basis text,    -- metered | estimated | unknown | registered (só despesa)
  events integer,     -- gerações somadas na linha de custo de IA
  details jsonb
);

create function public.finance_movements(p_from timestamptz, p_to timestamptz) returns setof public.finance_movement
language sql stable security definer set search_path = public as $$
  with
  settings as (select payment_fee_rate from public.pricing_settings limit 1),
  -- Mensalidades: a janela olha 120 dias para trás para achar estornos de cobranças antigas.
  sub_pay as (
    select p.id, p.subscription_id, p.user_id, p.provider_payment_id, p.amount_cents, p.status, p.paid_at, p.due_date,
      p.invoice_url, s.plan_slug, f.method, f.net_cents, f.refunded_at,
      public.subscription_origin(p.subscription_id, p.user_id, s.price_cents, p.paid_at, p.id) as source
    from public.subscription_payments p
    join public.subscriptions s on s.id = p.subscription_id
    cross join lateral public.asaas_payment_facts(p.provider_payment_id) f
    where p.paid_at >= p_from - interval '120 days' and p.paid_at < p_to
  ),
  packs as (
    select x.*, k.name as pack_name, f.method, f.net_cents, f.refunded_at,
      coalesce(x.paid_at, x.created_at) as at
    from public.purchases x
    join public.credit_packs k on k.slug = x.pack_slug
    cross join lateral public.asaas_payment_facts(x.provider_payment_id) f
    where coalesce(x.paid_at, x.created_at) >= p_from - interval '120 days' and coalesce(x.paid_at, x.created_at) < p_to
  ),
  paid_revenue as (
    select 'sp:' || id as id, paid_at as at, user_id, plan_slug, amount_cents as gross, net_cents, coalesce(method, 'card') as method,
      provider_payment_id as reference
    from sub_pay
    union all
    select 'pk:' || id, at, user_id, public.plan_slug_at(user_id, at), price_cents, net_cents, coalesce(method, 'unknown'), provider_payment_id
    from packs where status in ('paid', 'refunded')
  ),
  rows as (
    -- Mensalidade paga (ou paga e depois estornada: continua no faturamento bruto).
    select ('sp:' || p.id, p.paid_at, 'revenue',
        case when p.status = 'refunded' then 'refunded' else 'paid' end,
        p.source, null, p.plan_slug, p.user_id,
        'Mensalidade ' || coalesce(pl.name, p.plan_slug),
        p.amount_cents::bigint, p.net_cents, null, coalesce(p.method, 'card'), p.provider_payment_id,
        null, null, null, null, null,
        jsonb_build_object('invoice_url', p.invoice_url, 'due_date', p.due_date, 'subscription_id', p.subscription_id))::public.finance_movement as m
    from sub_pay p left join public.subscription_plans pl on pl.slug = p.plan_slug
    union all
    select ('sr:' || p.id, coalesce(p.refunded_at, p.paid_at), 'refund', 'refunded', p.source, null, p.plan_slug, p.user_id,
        'Estorno da mensalidade ' || coalesce(pl.name, p.plan_slug),
        p.amount_cents::bigint, null, null, coalesce(p.method, 'card'), p.provider_payment_id,
        null, null, null, null, null,
        jsonb_build_object('paid_at', p.paid_at, 'refund_date_known', p.refunded_at is not null))::public.finance_movement
    from sub_pay p left join public.subscription_plans pl on pl.slug = p.plan_slug
    where p.status = 'refunded'
    union all
    -- Pacotes de crédito em qualquer status: pendente e expirado aparecem, mas não somam receita.
    select ('pk:' || x.id, x.at, 'revenue',
        case x.status when 'paid' then 'paid' when 'pending' then 'pending' when 'expired' then 'canceled' else 'refunded' end,
        'credit_pack', null, public.plan_slug_at(x.user_id, x.at), x.user_id,
        'Pacote ' || x.pack_name || ' (' || x.credits || ' créditos)',
        x.price_cents::bigint, x.net_cents, x.credits, coalesce(x.method, 'unknown'), coalesce(x.provider_payment_id, x.provider_checkout_id),
        null, null, null, null, null,
        jsonb_build_object('created_at', x.created_at, 'paid_at', x.paid_at))::public.finance_movement
    from packs x
    union all
    select ('pr:' || x.id, coalesce(x.refunded_at, x.at), 'refund', 'refunded', 'credit_pack', null, public.plan_slug_at(x.user_id, x.at), x.user_id,
        'Estorno do pacote ' || x.pack_name,
        x.price_cents::bigint, null, x.credits, coalesce(x.method, 'unknown'), x.provider_payment_id,
        null, null, null, null, null,
        jsonb_build_object('paid_at', x.paid_at, 'refund_date_known', x.refunded_at is not null))::public.finance_movement
    from packs x where x.status = 'refunded'
    union all
    -- Assinatura que nunca pagou: checkout aberto (pendente) ou abandonado (cancelado).
    select ('sb:' || s.id, case when s.status = 'pending' then s.created_at else coalesce(s.ended_at, s.updated_at) end, 'revenue',
        case when s.status = 'pending' then 'pending' else 'canceled' end,
        public.subscription_origin(s.id, s.user_id, s.price_cents, s.created_at), null, s.plan_slug, s.user_id,
        'Assinatura ' || coalesce(pl.name, s.plan_slug) || case when s.status = 'pending' then ' aguardando pagamento' else ' não paga' end,
        s.price_cents::bigint, null, null, 'card', s.provider_checkout_id,
        null, null, null, null, null,
        jsonb_build_object('subscription_id', s.id, 'created_at', s.created_at))::public.finance_movement
    from public.subscriptions s left join public.subscription_plans pl on pl.slug = s.plan_slug
    where not exists (select 1 from public.subscription_payments p where p.subscription_id = s.id)
      and s.status in ('pending', 'expired', 'canceled')
      and s.created_at < p_to
      and (case when s.status = 'pending' then s.created_at else coalesce(s.ended_at, s.updated_at) end) >= p_from
    union all
    -- Renovação em atraso: o valor do plano fica vencido desde o fim do período pago.
    select ('od:' || s.id, coalesce(s.current_period_end, s.updated_at), 'revenue', 'overdue', 'renewal', null, s.plan_slug, s.user_id,
        'Renovação ' || coalesce(pl.name, s.plan_slug) || ' em atraso',
        s.price_cents::bigint, null, null, 'card', s.provider_subscription_id,
        null, null, null, null, null,
        jsonb_build_object('subscription_id', s.id, 'period_end', s.current_period_end))::public.finance_movement
    from public.subscriptions s left join public.subscription_plans pl on pl.slug = s.plan_slug
    where s.status = 'past_due'
      and coalesce(s.current_period_end, s.updated_at) >= p_from and coalesce(s.current_period_end, s.updated_at) < p_to
    union all
    -- Taxa do gateway: conciliada (bruto menos líquido do Asaas) ou estimada pela taxa cadastrada.
    select ('fee:' || r.id, r.at, 'expense', 'paid', null, 'payment_fees', r.plan_slug, r.user_id,
        'Taxa do gateway', fee.cents, null, null, r.method, r.reference,
        null, null, null, case when r.net_cents is not null then 'metered' else 'estimated' end, null,
        jsonb_build_object('gross_cents', r.gross, 'net_cents', r.net_cents))::public.finance_movement
    from paid_revenue r
    cross join lateral (select case when r.net_cents is not null then greatest(r.gross - r.net_cents, 0)
        else round(r.gross * (select payment_fee_rate from settings))::bigint end as cents) fee
    where fee.cents > 0
    union all
    -- Custo de IA por dia, pessoa, modelo e base do custo.
    select ('ai:' || md5(a.day::text || a.user_id::text || a.model_slug || a.feature || a.cost_basis), a.first_at, 'expense', 'paid', null, 'ai',
        public.plan_slug_at(a.user_id, a.first_at), a.user_id,
        coalesce(md.name, a.model_slug) || ' · ' || a.events || case when a.events = 1 then ' geração' else ' gerações' end,
        a.cents, null, a.credits, null, null,
        a.provider, a.model_slug, a.feature, a.cost_basis, a.events,
        jsonb_build_object('day', a.day, 'failed_billed', a.failed_billed, 'model_name', md.name))::public.finance_movement
    from (
      select (e.occurred_at at time zone 'America/Sao_Paulo')::date as day, e.user_id, e.model_slug, e.provider, e.cost_basis,
        case when g.kind = 'text' or e.kind = 'text' then 'text' when g.format_slug is not null then 'format'
          when g.persona_id is not null then 'character' else coalesce(g.kind, e.kind) end as feature,
        min(e.occurred_at) as first_at, count(*)::int as events, sum(e.credits)::int as credits,
        round(sum(coalesce(e.cost_brl, 0)) * 100)::bigint as cents,
        count(*) filter (where e.status = 'failed_billed')::int as failed_billed
      from public.ai_usage_events e left join public.generations g on g.id = e.generation_id
      where e.occurred_at >= p_from and e.occurred_at < p_to
      group by 1, 2, 3, 4, 5, 6
    ) a left join public.models md on md.slug = a.model_slug
    union all
    -- Despesas lançadas no painel (anuladas ficam de fora).
    select ('ex:' || o.id, (o.incurred_on::timestamp at time zone 'America/Sao_Paulo'), 'expense', 'paid', null,
        case o.category when 'infra' then 'infra' when 'tools' then 'tools' when 'services' then 'services'
          when 'marketing' then 'marketing' when 'taxes' then 'taxes' when 'payroll' then 'payroll' else 'other' end,
        null, null, o.description, o.amount_cents::bigint, null, null, null, o.id::text,
        null, null, null, 'registered', null,
        jsonb_build_object('incurred_on', o.incurred_on, 'created_at', o.created_at))::public.finance_movement
    from public.operating_expenses o
    where o.voided_at is null
      and o.incurred_on >= (p_from at time zone 'America/Sao_Paulo')::date
      and o.incurred_on <= ((p_to - interval '1 microsecond') at time zone 'America/Sao_Paulo')::date
    union all
    -- Ajuste manual de créditos: registro de auditoria, não mexe no caixa.
    select ('aj:' || l.id, l.created_at, 'adjustment', 'paid', null, null, public.plan_slug_at(l.user_id, l.created_at), l.user_id,
        coalesce(nullif(l.note, ''), 'Ajuste de créditos'), 0::bigint, null, l.delta, null, l.id::text,
        null, null, null, null, null,
        jsonb_build_object('credits', l.delta))::public.finance_movement
    from public.credit_ledger l
    where l.reason = 'adjustment' and l.created_at >= p_from and l.created_at < p_to
  )
  select (m).* from rows where (m).occurred_at >= p_from and (m).occurred_at < p_to
$$;

-- --------------------------------------------------------------------------------- filtros

create function public.finance_text_array(p_filters jsonb, p_key text, p_allowed text[]) returns text[]
language plpgsql immutable set search_path = public as $$
declare
  value jsonb := p_filters -> p_key;
  items text[];
begin
  if value is null or value = 'null'::jsonb then return null; end if;
  if jsonb_typeof(value) <> 'array' or jsonb_array_length(value) > 50 then raise exception 'invalid_filter'; end if;
  select array_agg(x) into items from jsonb_array_elements_text(value) x;
  if items is null then return null; end if;
  if p_allowed is not null and not items <@ p_allowed then raise exception 'invalid_filter'; end if;
  if exists (select 1 from unnest(items) x where char_length(x) > 80) then raise exception 'invalid_filter'; end if;
  return items;
end;
$$;

create function public.finance_cents(p_filters jsonb, p_key text) returns bigint
language plpgsql immutable set search_path = public as $$
declare
  value jsonb := p_filters -> p_key;
begin
  if value is null or value = 'null'::jsonb then return null; end if;
  if jsonb_typeof(value) <> 'number' or (value #>> '{}')::numeric < 0 or (value #>> '{}')::numeric > 10000000000 then
    raise exception 'invalid_filter';
  end if;
  return round((value #>> '{}')::numeric)::bigint;
end;
$$;

-- Uma linha passa quando bate com todos os filtros preenchidos. Filtro de uma dimensão que a linha
-- não tem (plano numa despesa fixa, categoria numa receita) tira a linha: o que aparece é só o que
-- casa com o recorte inteiro.
create function public.finance_row_passes(
  m public.finance_movement, p_email text,
  p_types text[], p_statuses text[], p_plans text[], p_sources text[], p_categories text[],
  p_providers text[], p_models text[], p_features text[], p_methods text[],
  p_user text, p_min bigint, p_max bigint
) returns boolean
language sql immutable set search_path = public as $$
  select (p_types is null or m.type = any (p_types))
    and (p_statuses is null or m.status = any (p_statuses))
    and (p_plans is null or m.plan_slug = any (p_plans))
    and (p_sources is null or m.source = any (p_sources))
    and (p_categories is null or m.category = any (p_categories))
    and (p_providers is null or m.ai_provider = any (p_providers))
    and (p_models is null or m.ai_model = any (p_models))
    and (p_features is null or m.ai_feature = any (p_features))
    and (p_methods is null or m.method = any (p_methods))
    and (p_user is null or p_email ilike '%' || p_user || '%')
    and (p_min is null or m.amount_cents >= p_min)
    and (p_max is null or m.amount_cents <= p_max)
$$;

create function public.finance_totals(p_rows public.finance_movement[]) returns jsonb
language sql immutable set search_path = public as $$
  select jsonb_build_object(
    'gross_cents', coalesce(sum(amount_cents) filter (where type = 'revenue' and status in ('paid', 'refunded')), 0),
    'reconciled_gross_cents', coalesce(sum(amount_cents) filter (where type = 'revenue' and status in ('paid', 'refunded') and net_cents is not null), 0),
    'reconciled_net_cents', coalesce(sum(net_cents) filter (where type = 'revenue' and status in ('paid', 'refunded')), 0),
    'refunds_cents', coalesce(sum(amount_cents) filter (where type = 'refund'), 0),
    'fees_cents', coalesce(sum(amount_cents) filter (where category = 'payment_fees'), 0),
    'fees_estimated_cents', coalesce(sum(amount_cents) filter (where category = 'payment_fees' and cost_basis = 'estimated'), 0),
    'ai_cents', coalesce(sum(amount_cents) filter (where category = 'ai'), 0),
    'ai_estimated_cents', coalesce(sum(amount_cents) filter (where category = 'ai' and cost_basis = 'estimated'), 0),
    'ai_unknown_events', coalesce(sum(events) filter (where category = 'ai' and cost_basis = 'unknown'), 0),
    'other_expenses_cents', coalesce(sum(amount_cents) filter (where type = 'expense' and category not in ('ai', 'payment_fees')), 0),
    'expenses_cents', coalesce(sum(amount_cents) filter (where type = 'expense'), 0),
    'pending_cents', coalesce(sum(amount_cents) filter (where type = 'revenue' and status = 'pending'), 0),
    'overdue_cents', coalesce(sum(amount_cents) filter (where type = 'revenue' and status = 'overdue'), 0),
    'paid_count', count(*) filter (where type = 'revenue' and status in ('paid', 'refunded')),
    'paying_users', count(distinct user_id) filter (where type = 'revenue' and status in ('paid', 'refunded')),
    'rows', count(*)
  )
  from unnest(p_rows)
$$;

create function public.admin_finance_explorer(
  p_filters jsonb,
  p_page integer default 1,
  p_page_size integer default 25,
  p_sort text default 'occurred_at',
  p_dir text default 'desc',
  p_search text default null
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  tz constant text := 'America/Sao_Paulo';
  sees_people boolean;
  v_from timestamptz;
  v_to timestamptz;
  c_from timestamptz;
  c_to timestamptz;
  m_from timestamptz;
  compare text := coalesce(p_filters ->> 'compare', 'previous');
  gran text := coalesce(p_filters ->> 'granularity', 'day');
  f_types text[]; f_statuses text[]; f_plans text[]; f_sources text[]; f_categories text[];
  f_providers text[]; f_models text[]; f_features text[]; f_methods text[];
  f_user text := nullif(btrim(p_filters ->> 'user'), '');
  f_min bigint; f_max bigint;
  search text := nullif(btrim(p_search), '');
  cur public.finance_movement[];
  prev public.finance_movement[];
  months public.finance_movement[];
  mrr_now bigint;
  mrr_start bigint;
  months_without_expenses integer;
  result jsonb;
begin
  perform public.assert_admin_permission('finance.view');
  sees_people := public.has_admin_permission('users.view');

  if p_filters is null or jsonb_typeof(p_filters) <> 'object' then raise exception 'invalid_filter'; end if;
  begin
    v_from := (p_filters ->> 'from')::timestamptz;
    v_to := (p_filters ->> 'to')::timestamptz;
  exception when others then
    raise exception 'invalid_period';
  end;
  perform public.assert_admin_period(v_from, v_to);
  if compare not in ('previous', 'year') or gran not in ('day', 'week', 'month') then raise exception 'invalid_filter'; end if;
  if p_page < 1 or p_page_size not between 1 and 5000 then raise exception 'invalid_filter'; end if;
  if p_sort not in ('occurred_at', 'amount_cents', 'type', 'status', 'email', 'plan_slug') or p_dir not in ('asc', 'desc') then
    raise exception 'invalid_filter';
  end if;
  if f_user is not null and (not sees_people or char_length(f_user) > 120) then raise exception 'invalid_filter'; end if;
  if search is not null and char_length(search) > 120 then raise exception 'invalid_filter'; end if;

  f_types := public.finance_text_array(p_filters, 'types', array['revenue', 'expense', 'refund', 'adjustment']);
  f_statuses := public.finance_text_array(p_filters, 'statuses', array['paid', 'pending', 'overdue', 'canceled', 'refunded']);
  f_plans := public.finance_text_array(p_filters, 'plans', (select array_agg(slug) from public.subscription_plans));
  f_sources := public.finance_text_array(p_filters, 'sources', array['subscription_new', 'renewal', 'upgrade', 'plan_change', 'credit_pack']);
  f_categories := public.finance_text_array(p_filters, 'categories',
    array['ai', 'payment_fees', 'infra', 'tools', 'services', 'marketing', 'taxes', 'payroll', 'other']);
  f_providers := public.finance_text_array(p_filters, 'ai_providers', null);
  f_models := public.finance_text_array(p_filters, 'ai_models', null);
  f_features := public.finance_text_array(p_filters, 'ai_features', array['image', 'video', 'text', 'character', 'format']);
  f_methods := public.finance_text_array(p_filters, 'methods', array['pix', 'card', 'boleto', 'other', 'unknown']);
  f_min := public.finance_cents(p_filters, 'min_cents');
  f_max := public.finance_cents(p_filters, 'max_cents');

  if compare = 'year' then
    c_from := v_from - interval '1 year';
    c_to := v_to - interval '1 year';
  else
    c_from := v_from - (v_to - v_from);
    c_to := v_from;
  end if;
  -- Comparativo mensal: pelo menos os seis meses que terminam no fim do período.
  m_from := least(
    date_trunc('month', v_from at time zone tz) at time zone tz,
    (date_trunc('month', (v_to - interval '1 microsecond') at time zone tz) - interval '5 months') at time zone tz
  );

  select array_agg(m) into cur from public.finance_movements(v_from, v_to) m
    left join auth.users u on u.id = m.user_id
    where public.finance_row_passes(m, u.email::text, f_types, f_statuses, f_plans, f_sources, f_categories,
      f_providers, f_models, f_features, f_methods, f_user, f_min, f_max);
  select array_agg(m) into prev from public.finance_movements(c_from, c_to) m
    left join auth.users u on u.id = m.user_id
    where public.finance_row_passes(m, u.email::text, f_types, f_statuses, f_plans, f_sources, f_categories,
      f_providers, f_models, f_features, f_methods, f_user, f_min, f_max);
  select array_agg(m) into months from public.finance_movements(m_from, v_to) m
    left join auth.users u on u.id = m.user_id
    where public.finance_row_passes(m, u.email::text, f_types, f_statuses, f_plans, f_sources, f_categories,
      f_providers, f_models, f_features, f_methods, f_user, f_min, f_max);
  cur := coalesce(cur, '{}');
  prev := coalesce(prev, '{}');
  months := coalesce(months, '{}');

  -- MRR é estado, não período: assinaturas pagas, vivas e não canceladas, no recorte de plano e pessoa.
  -- Início do período: o que já tinha pago e ainda não tinha sido cancelado nem encerrado.
  select coalesce(sum(s.price_cents), 0) into mrr_start
  from public.subscriptions s left join auth.users u on u.id = s.user_id
  where (f_plans is null or s.plan_slug = any (f_plans))
    and (f_user is null or u.email ilike '%' || f_user || '%')
    and coalesce(s.canceled_at, 'infinity') > v_from and coalesce(s.ended_at, 'infinity') > v_from
    and exists (select 1 from public.subscription_payments p where p.subscription_id = s.id and p.paid_at <= v_from);
  select coalesce(sum(s.price_cents), 0) into mrr_now
  from public.subscriptions s left join auth.users u on u.id = s.user_id
  where (f_plans is null or s.plan_slug = any (f_plans))
    and (f_user is null or u.email ilike '%' || f_user || '%')
    and s.status in ('active', 'past_due') and s.canceled_at is null
    and exists (select 1 from public.subscription_payments p where p.subscription_id = s.id);

  -- Mês do período sem nenhuma despesa lançada: o lucro daquele mês está incompleto.
  select count(*) into months_without_expenses
  from generate_series(date_trunc('month', v_from at time zone tz), date_trunc('month', (v_to - interval '1 microsecond') at time zone tz), interval '1 month') mo
  where not exists (
    select 1 from public.operating_expenses o
    where o.voided_at is null and date_trunc('month', o.incurred_on::timestamp) = mo
  );

  with
  c as (select * from unnest(cur)),
  people as (select id, email::text as email from auth.users where id in (select user_id from c where user_id is not null)),
  buckets as (
    select b as bucket_start from generate_series(
      date_trunc(gran, v_from at time zone tz),
      date_trunc(gran, (v_to - interval '1 microsecond') at time zone tz),
      ('1 ' || gran)::interval
    ) b
  ),
  by_bucket as (
    select date_trunc(gran, occurred_at at time zone tz) as bucket_start,
      sum(amount_cents) filter (where type = 'revenue' and status in ('paid', 'refunded')) as gross,
      sum(amount_cents) filter (where type = 'refund') as refunds,
      sum(amount_cents) filter (where type = 'expense') as expenses,
      sum(amount_cents) filter (where category = 'ai') as ai,
      sum(amount_cents) filter (where category = 'payment_fees') as fees
    from c group by 1
  ),
  month_rows as (
    select date_trunc('month', occurred_at at time zone tz) as month_start,
      sum(amount_cents) filter (where type = 'revenue' and status in ('paid', 'refunded')) as gross,
      sum(amount_cents) filter (where type = 'refund') as refunds,
      sum(amount_cents) filter (where type = 'expense') as expenses,
      sum(amount_cents) filter (where category = 'ai') as ai
    from unnest(months) group by 1
  ),
  month_list as (
    select mo as month_start from generate_series(
      date_trunc('month', m_from at time zone tz), date_trunc('month', (v_to - interval '1 microsecond') at time zone tz), interval '1 month') mo
  ),
  plan_rows as (
    select c.plan_slug,
      coalesce(sum(amount_cents) filter (where type = 'revenue' and status in ('paid', 'refunded')), 0) as gross,
      coalesce(sum(amount_cents) filter (where type = 'refund'), 0) as refunds,
      coalesce(sum(amount_cents) filter (where category = 'ai'), 0) as ai,
      coalesce(sum(amount_cents) filter (where category = 'payment_fees'), 0) as fees,
      coalesce(sum(amount_cents) filter (where type = 'expense' and category not in ('ai', 'payment_fees')), 0) as other,
      count(distinct user_id) filter (where type = 'revenue' and status in ('paid', 'refunded')) as paying,
      count(distinct user_id) as users
    from c where c.plan_slug is not null group by 1
  ),
  user_rows as (
    select c.user_id,
      coalesce(sum(amount_cents) filter (where type = 'revenue' and status in ('paid', 'refunded')), 0)
        - coalesce(sum(amount_cents) filter (where type = 'refund'), 0) as revenue,
      coalesce(sum(amount_cents) filter (where type = 'expense'), 0) as costs,
      coalesce(sum(amount_cents) filter (where category = 'ai'), 0) as ai,
      (array_agg(plan_slug order by occurred_at desc))[1] as plan_slug
    from c where c.user_id is not null group by 1
  ),
  table_rows as (
    select c.*, p.email from c left join people p on p.id = c.user_id
    where search is null
      or c.description ilike '%' || search || '%'
      or coalesce(c.reference, '') ilike '%' || search || '%'
      or (sees_people and coalesce(p.email, '') ilike '%' || search || '%')
  )
  select jsonb_build_object(
    'period', jsonb_build_object('from', v_from, 'to', v_to, 'compare_from', c_from, 'compare_to', c_to, 'compare', compare, 'granularity', gran),
    'totals', public.finance_totals(cur),
    'previous', public.finance_totals(prev),
    'mrr', jsonb_build_object('now_cents', mrr_now, 'start_cents', mrr_start),
    'coverage', jsonb_build_object(
      'months_without_expenses', months_without_expenses,
      'months', (select count(*) from generate_series(date_trunc('month', v_from at time zone tz),
        date_trunc('month', (v_to - interval '1 microsecond') at time zone tz), interval '1 month')),
      'payment_fee_rate', (select payment_fee_rate from public.pricing_settings limit 1)
    ),
    'series', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', case when gran = 'month' then to_char(b.bucket_start, 'YYYY-MM') else to_char(b.bucket_start, 'YYYY-MM-DD') end,
        'gross_cents', coalesce(x.gross, 0), 'refunds_cents', coalesce(x.refunds, 0), 'expenses_cents', coalesce(x.expenses, 0),
        'ai_cents', coalesce(x.ai, 0), 'fees_cents', coalesce(x.fees, 0)) order by b.bucket_start)
      from buckets b left join by_bucket x on x.bucket_start = b.bucket_start
    ), '[]'::jsonb),
    'monthly', coalesce((
      select jsonb_agg(jsonb_build_object('key', to_char(l.month_start, 'YYYY-MM'),
        'gross_cents', coalesce(x.gross, 0), 'refunds_cents', coalesce(x.refunds, 0), 'expenses_cents', coalesce(x.expenses, 0),
        'ai_cents', coalesce(x.ai, 0)) order by l.month_start)
      from month_list l left join month_rows x on x.month_start = l.month_start
    ), '[]'::jsonb),
    'by_plan', coalesce((
      select jsonb_agg(jsonb_build_object('slug', r.plan_slug, 'name', coalesce(pl.name, r.plan_slug), 'gross_cents', r.gross,
        'refunds_cents', r.refunds, 'ai_cents', r.ai, 'fees_cents', r.fees, 'other_cents', r.other, 'paying_users', r.paying, 'users', r.users)
        order by r.gross - r.refunds desc, r.ai desc)
      from plan_rows r left join public.subscription_plans pl on pl.slug = r.plan_slug
    ), '[]'::jsonb),
    'by_category', coalesce((
      select jsonb_agg(jsonb_build_object('category', category, 'cents', cents, 'estimated_cents', estimated) order by cents desc)
      from (select category, sum(amount_cents) as cents, sum(amount_cents) filter (where cost_basis = 'estimated') as estimated
        from c where type = 'expense' group by 1) x
    ), '[]'::jsonb),
    'by_source', coalesce((
      select jsonb_agg(jsonb_build_object('source', source, 'cents', cents, 'count', n) order by cents desc)
      from (select source, sum(amount_cents) as cents, count(*) as n from c
        where type = 'revenue' and status in ('paid', 'refunded') group by 1) x
    ), '[]'::jsonb),
    'by_method', coalesce((
      select jsonb_agg(jsonb_build_object('method', method, 'cents', cents, 'count', n) order by cents desc)
      from (select method, sum(amount_cents) as cents, count(*) as n from c
        where type = 'revenue' and status in ('paid', 'refunded') group by 1) x
    ), '[]'::jsonb),
    'ai_by_model', coalesce((
      select jsonb_agg(jsonb_build_object('model', x.ai_model, 'name', coalesce(md.name, x.ai_model), 'provider', x.ai_provider,
        'cents', x.cents, 'events', x.events, 'unknown_events', x.unknown, 'estimated_cents', x.estimated) order by x.cents desc, x.events desc)
      from (select ai_model, ai_provider, sum(amount_cents) as cents, sum(events) as events,
          coalesce(sum(events) filter (where cost_basis = 'unknown'), 0) as unknown,
          coalesce(sum(amount_cents) filter (where cost_basis = 'estimated'), 0) as estimated
        from c where category = 'ai' group by 1, 2) x
      left join public.models md on md.slug = x.ai_model
    ), '[]'::jsonb),
    'ai_by_provider', coalesce((
      select jsonb_agg(jsonb_build_object('provider', ai_provider, 'cents', cents, 'events', events) order by cents desc)
      from (select ai_provider, sum(amount_cents) as cents, sum(events) as events from c where category = 'ai' group by 1) x
    ), '[]'::jsonb),
    'by_user', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', r.user_id, 'email', case when sees_people then p.email end, 'plan_slug', r.plan_slug,
        'revenue_cents', r.revenue, 'costs_cents', r.costs, 'ai_cents', r.ai) order by r.revenue desc, r.costs desc)
      from (select * from user_rows order by revenue desc, costs desc limit 20) r left join people p on p.id = r.user_id
    ), '[]'::jsonb),
    'options', jsonb_build_object(
      'plans', coalesce((select jsonb_agg(jsonb_build_object('slug', slug, 'name', name, 'status', status) order by position)
        from public.subscription_plans), '[]'::jsonb),
      'ai_providers', coalesce((select jsonb_agg(distinct provider order by provider) from public.models), '[]'::jsonb),
      'ai_models', coalesce((select jsonb_agg(jsonb_build_object('slug', slug, 'name', name, 'provider', provider) order by name)
        from public.models), '[]'::jsonb),
      'can_filter_user', sees_people
    ),
    'table', jsonb_build_object(
      'total', (select count(*) from table_rows),
      'page', p_page,
      'page_size', p_page_size,
      'rows', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', t.id, 'occurred_at', t.occurred_at, 'type', t.type, 'status', t.status, 'source', t.source, 'category', t.category,
          'plan_slug', t.plan_slug, 'user_id', t.user_id, 'email', case when sees_people then t.email end,
          'description', t.description, 'amount_cents', t.amount_cents, 'net_cents', t.net_cents, 'credits', t.credits,
          'method', t.method, 'reference', t.reference, 'ai_provider', t.ai_provider, 'ai_model', t.ai_model,
          'ai_feature', t.ai_feature, 'cost_basis', t.cost_basis, 'events', t.events, 'details', t.details) order by t.ord)
        from (
          select tr.*, row_number() over (order by
            case when p_dir = 'asc' then case p_sort when 'amount_cents' then lpad(tr.amount_cents::text, 14, '0')
              when 'type' then tr.type when 'status' then tr.status when 'email' then coalesce(tr.email, '')
              when 'plan_slug' then coalesce(tr.plan_slug, '') else to_char(tr.occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US') end end asc,
            case when p_dir = 'desc' then case p_sort when 'amount_cents' then lpad(tr.amount_cents::text, 14, '0')
              when 'type' then tr.type when 'status' then tr.status when 'email' then coalesce(tr.email, '')
              when 'plan_slug' then coalesce(tr.plan_slug, '') else to_char(tr.occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US') end end desc,
            tr.occurred_at desc, tr.id) as ord
          from table_rows tr
          order by ord
          offset (p_page - 1) * p_page_size limit p_page_size
        ) t
      ), '[]'::jsonb)
    )
  ) into result;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------- filtros salvos

create table public.admin_saved_filters (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users (id) on delete cascade,
  scope text not null check (scope in ('finance')),
  name text not null check (char_length(name) between 2 and 60),
  filters jsonb not null check (jsonb_typeof(filters) = 'object' and pg_column_size(filters) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (admin_id, scope, name)
);

alter table public.admin_saved_filters enable row level security;
revoke all on public.admin_saved_filters from anon, authenticated;

create function public.admin_saved_filters_list(p_scope text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_admin_permission('finance.view');
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'filters', filters, 'updated_at', updated_at) order by name)
    from public.admin_saved_filters where admin_id = auth.uid() and scope = p_scope
  ), '[]'::jsonb);
end;
$$;

create function public.admin_save_filter(p_scope text, p_name text, p_filters jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  saved uuid;
begin
  perform public.assert_admin_permission('finance.view');
  if p_scope not in ('finance') or p_name is null or char_length(btrim(p_name)) not between 2 and 60
    or p_filters is null or jsonb_typeof(p_filters) <> 'object' or pg_column_size(p_filters) > 4000 then
    raise exception 'invalid_filter';
  end if;
  if (select count(*) from public.admin_saved_filters where admin_id = auth.uid() and scope = p_scope and name <> btrim(p_name)) >= 30 then
    raise exception 'too_many_filters';
  end if;
  insert into public.admin_saved_filters (admin_id, scope, name, filters)
  values (auth.uid(), p_scope, btrim(p_name), p_filters)
  on conflict (admin_id, scope, name) do update set filters = excluded.filters, updated_at = now()
  returning id into saved;
  return saved;
end;
$$;

create function public.admin_delete_saved_filter(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin_permission('finance.view');
  delete from public.admin_saved_filters where id = p_id and admin_id = auth.uid();
end;
$$;

revoke execute on function public.plan_slug_at(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.subscription_origin(uuid, uuid, integer, timestamptz, uuid) from public, anon, authenticated;
revoke execute on function public.asaas_payment_facts(text) from public, anon, authenticated;
revoke execute on function public.finance_movements(timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function public.finance_totals(public.finance_movement[]) from public, anon, authenticated;
revoke execute on function public.admin_finance_explorer(jsonb, integer, integer, text, text, text) from public, anon;
revoke execute on function public.admin_saved_filters_list(text) from public, anon;
revoke execute on function public.admin_save_filter(text, text, jsonb) from public, anon;
revoke execute on function public.admin_delete_saved_filter(uuid) from public, anon;
grant execute on function public.admin_finance_explorer(jsonb, integer, integer, text, text, text) to authenticated;
grant execute on function public.admin_saved_filters_list(text) to authenticated;
grant execute on function public.admin_save_filter(text, text, jsonb) to authenticated;
grant execute on function public.admin_delete_saved_filter(uuid) to authenticated;
