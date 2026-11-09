-- Central de comando do admin (/admin): o que o painel precisa além de `admin_dashboard`, `admin_business`
-- e `admin_ai_costs`. Uma chamada, só leitura, agregada no banco:
--   receita bruta e reembolsos por dia (com o período anterior alinhado), receita prevista, MRR perdido,
--   churn dos últimos 30 dias, despesas de base e de marketing (CAC);
--   custo de IA por funcionalidade, por modelo (com série diária dos cinco mais caros) e os 10 usuários
--   que mais custaram;
--   DAU, MAU, contas que nunca geraram, saldo perto do fim ou zerado, ativos por dia e coortes semanais;
--   operação: tempo de geração, abertas e travadas, falhas que o fornecedor cobrou, saúde por provedor
--   (derivada das gerações das últimas 24 h) e erros recentes;
--   planos e parâmetros para a simulação de cenários.
-- Permissões: `dashboard.view` para tudo; dinheiro só com `finance.view`; e-mail só com `users.view`.

create function public.admin_command_center(p_from timestamptz, p_to timestamptz) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  tz constant text := 'America/Sao_Paulo';
  span interval;
  sees_money boolean;
  sees_people boolean;
  settings public.pricing_settings;
  today_start timestamptz := date_trunc('day', now() at time zone tz) at time zone tz;
  month_start timestamptz := date_trunc('month', now() at time zone tz) at time zone tz;
  week_start timestamptz := date_trunc('week', now() at time zone tz) at time zone tz;
  result jsonb;
begin
  perform public.assert_admin_permission('dashboard.view');
  perform public.assert_admin_period(p_from, p_to);
  sees_money := public.has_admin_permission('finance.view');
  sees_people := public.has_admin_permission('users.view');
  select * into settings from public.pricing_settings;
  span := p_to - p_from;

  with
  days as (
    select d::date as day, row_number() over (order by d) - 1 as idx
    from generate_series((p_from at time zone tz)::date, ((p_to - interval '1 microsecond') at time zone tz)::date, interval '1 day') d
  ),
  -- Pagamentos brutos: mensalidade confirmada ou depois reembolsada, mais pacotes pagos. Reembolso fica
  -- na data do pagamento original (o Asaas não informa a data do estorno).
  payments as (
    select p.paid_at as at, p.amount_cents as cents, (p.status = 'refunded') as refunded
    from public.subscription_payments p
    where p.paid_at >= p_from - span and p.paid_at < p_to
    union all
    select x.paid_at, x.price_cents, false from public.purchases x
    where x.status = 'paid' and x.paid_at >= p_from - span and x.paid_at < p_to
  ),
  pay_by_day as (
    select (at at time zone tz)::date as day, sum(cents) as gross, sum(cents) filter (where refunded) as refunds
    from payments where at >= p_from group by 1
  ),
  prev_by_day as (
    select ((at + span) at time zone tz)::date as day, sum(cents) as gross
    from payments where at < p_from group by 1
  ),
  members as (
    select u.id as user_id, ep.slug as plan_slug, ep.name as plan_name, ep.price_cents, ep.monthly_credits
    from auth.users u cross join lateral public.effective_plan(u.id) ep
  ),
  ev as (
    select e.*, case
        when g.kind = 'text' or e.kind = 'text' then 'text'
        when g.format_slug is not null then 'format'
        when g.persona_id is not null then 'character'
        else coalesce(g.kind, e.kind)
      end as feature
    from public.ai_usage_events e left join public.generations g on g.id = e.generation_id
    where e.occurred_at >= least(p_from, month_start) and e.occurred_at < greatest(p_to, now())
  ),
  cur as (select * from ev where occurred_at >= p_from and occurred_at < p_to),
  top_models as (
    select model_slug from cur group by model_slug order by sum(cost_brl) desc limit 5
  ),
  gens as (
    select g.id, g.user_id, g.status, g.kind, g.model_slug, g.error, g.created_at, g.completed_at, g.updated_at,
      m.provider, m.name as model_name
    from public.generations g join public.models m on m.slug = g.model_slug
    where g.created_at >= least(p_from, now() - interval '1 day') and g.created_at < greatest(p_to, now())
  ),
  gen_cur as (select * from gens where created_at >= p_from and created_at < p_to),
  balances as (
    select m.user_id, coalesce(b.balance, 0) as balance, m.monthly_credits,
      exists (select 1 from public.generations g where g.user_id = m.user_id) as generated
    from members m left join public.credit_balances b on b.user_id = m.user_id
  ),
  cohorts as (
    select p.id as user_id, date_trunc('week', p.created_at at time zone tz) as cohort
    from public.profiles p
    where p.created_at >= ((date_trunc('week', now() at time zone tz) - interval '7 weeks') at time zone tz)
  ),
  cohort_activity as (
    select c.cohort, floor(extract(epoch from (date_trunc('week', g.created_at at time zone tz) - c.cohort)) / 604800)::int as week,
      count(distinct c.user_id) as users
    from cohorts c join public.generations g on g.user_id = c.user_id
    where g.created_at at time zone tz >= c.cohort
    group by 1, 2
  ),
  -- Assinaturas vivas há 30 dias (já pagas, não canceladas nem encerradas): base do churn mensal.
  churn_base as (
    select s.id, s.price_cents, s.canceled_at, s.ended_at from public.subscriptions s
    where coalesce(s.canceled_at, 'infinity') > now() - interval '30 days'
      and coalesce(s.ended_at, 'infinity') > now() - interval '30 days'
      and exists (select 1 from public.subscription_payments p where p.subscription_id = s.id and p.paid_at <= now() - interval '30 days')
  ),
  -- Assinaturas que contavam no MRR no início do período e saíram dentro dele.
  mrr_lost as (
    select s.price_cents from public.subscriptions s
    where coalesce(s.canceled_at, 'infinity') > p_from and coalesce(s.ended_at, 'infinity') > p_from
      and least(coalesce(s.canceled_at, 'infinity'), coalesce(s.ended_at, 'infinity')) < p_to
      and exists (select 1 from public.subscription_payments p where p.subscription_id = s.id and p.paid_at <= p_from)
  )
  select jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'settings', jsonb_build_object(
      'credit_value_brl', settings.credit_value_brl,
      'usd_brl', settings.usd_brl,
      'payment_fee_rate', case when sees_money then settings.payment_fee_rate end,
      'min_margin_rate', (select min_margin_rate from public.finance_settings)
    ),
    'plans', coalesce((
      select jsonb_agg(jsonb_build_object('slug', p.slug, 'name', p.name, 'price_cents', p.price_cents,
        'monthly_credits', p.monthly_credits, 'status', p.status) order by p.position)
      from public.subscription_plans p where p.status <> 'draft'
    ), '[]'::jsonb),
    'revenue', case when sees_money then jsonb_build_object(
      'series', (
        select jsonb_agg(jsonb_build_object('day', d.day, 'gross_cents', coalesce(c.gross, 0), 'refunds_cents', coalesce(c.refunds, 0),
          'previous_gross_cents', coalesce(pv.gross, 0)) order by d.day)
        from days d left join pay_by_day c on c.day = d.day left join prev_by_day pv on pv.day = d.day
      ),
      'gross_cents', (select coalesce(sum(cents), 0) from payments where at >= p_from),
      'refunds_cents', (select coalesce(sum(cents), 0) from payments where at >= p_from and refunded),
      'previous_gross_cents', (select coalesce(sum(cents), 0) from payments where at < p_from),
      'previous_refunds_cents', (select coalesce(sum(cents), 0) from payments where at < p_from and refunded),
      'lifetime_gross_cents', (
        (select coalesce(sum(amount_cents), 0) from public.subscription_payments)
        + (select coalesce(sum(price_cents), 0) from public.purchases where status = 'paid')
      ),
      'lifetime_refunds_cents', (select coalesce(sum(amount_cents), 0) from public.subscription_payments where status = 'refunded'),
      'month_received_cents', (
        (select coalesce(sum(amount_cents), 0) from public.subscription_payments where status = 'confirmed' and paid_at >= month_start)
        + (select coalesce(sum(price_cents), 0) from public.purchases where status = 'paid' and paid_at >= month_start)
      ),
      -- Prevista: renovações das assinaturas ativas que não pediram cancelamento. Em atraso fica à parte.
      'projected_next_month_cents', (select coalesce(sum(price_cents), 0) from public.subscriptions
        where status = 'active' and canceled_at is null and ended_at is null),
      'at_risk_cents', (select coalesce(sum(price_cents), 0) from public.subscriptions where status = 'past_due'),
      'mrr_start_cents', public.mrr_cents_at(p_from),
      'mrr_lost_cents', (select coalesce(sum(price_cents), 0) from mrr_lost),
      'churn_30d', jsonb_build_object(
        'base', (select count(*) from churn_base),
        'lost', (select count(*) from churn_base where least(coalesce(canceled_at, 'infinity'), coalesce(ended_at, 'infinity')) <= now()),
        'base_cents', (select coalesce(sum(price_cents), 0) from churn_base),
        'lost_cents', (select coalesce(sum(price_cents), 0) from churn_base
          where least(coalesce(canceled_at, 'infinity'), coalesce(ended_at, 'infinity')) <= now())
      ),
      'expenses_90d_cents', (select coalesce(sum(amount_cents), 0) from public.operating_expenses
        where voided_at is null and incurred_on > (now() at time zone tz)::date - 90),
      'expenses_by_day', coalesce((
        select jsonb_agg(jsonb_build_object('day', incurred_on, 'cents', cents) order by incurred_on)
        from (select incurred_on, sum(amount_cents) as cents from public.operating_expenses
              where voided_at is null and incurred_on >= (p_from at time zone tz)::date
                and incurred_on <= ((p_to - interval '1 microsecond') at time zone tz)::date
              group by incurred_on) x
      ), '[]'::jsonb),
      'marketing_cents', (select coalesce(sum(amount_cents), 0) from public.operating_expenses
        where voided_at is null and category = 'marketing' and incurred_on >= (p_from at time zone tz)::date
          and incurred_on <= ((p_to - interval '1 microsecond') at time zone tz)::date),
      -- Primeira mensalidade da vida da conta caiu no período (base do CAC).
      'new_paying', (select count(*) from (select user_id, min(paid_at) as first_paid from public.subscription_payments group by user_id) f
        where f.first_paid >= p_from and f.first_paid < p_to),
      'paying_ai_cost_brl', (select coalesce(sum(c.cost_brl), 0) from cur c join members m on m.user_id = c.user_id where m.price_cents > 0)
    ) end,
    'ai', jsonb_build_object(
      'cost_today_brl', (select coalesce(sum(cost_brl), 0) from ev where occurred_at >= today_start),
      'cost_month_brl', (select coalesce(sum(cost_brl), 0) from ev where occurred_at >= month_start),
      'cost_brl', (select coalesce(sum(cost_brl), 0) from cur),
      'credits', (select coalesce(sum(credits), 0) from cur),
      'events', (select count(*) from cur),
      'unknown', (select count(*) from cur where cost_basis = 'unknown'),
      'series', (
        select jsonb_agg(jsonb_build_object('day', d.day, 'cost_brl', coalesce(a.cost, 0), 'generations', coalesce(a.n, 0)) order by d.day)
        from days d left join (
          select (occurred_at at time zone tz)::date as day, sum(cost_brl) as cost, count(*) as n from cur group by 1
        ) a on a.day = d.day
      ),
      'by_feature', coalesce((
        select jsonb_agg(row_to_json(r) order by r.cost_brl desc)
        from (select feature, count(*) as generations, coalesce(sum(credits), 0) as credits, coalesce(sum(cost_brl), 0) as cost_brl,
                count(distinct user_id) as users
              from cur group by feature) r
      ), '[]'::jsonb),
      'by_model', coalesce((
        select jsonb_agg(row_to_json(r) order by r.cost_brl desc)
        from (select c.model_slug, m.name, c.provider, count(*) as generations, coalesce(sum(c.credits), 0) as credits,
                coalesce(sum(c.cost_brl), 0) as cost_brl
              from cur c left join public.models m on m.slug = c.model_slug
              group by c.model_slug, m.name, c.provider order by sum(c.cost_brl) desc limit 12) r
      ), '[]'::jsonb),
      'model_series', coalesce((
        select jsonb_agg(row_to_json(r) order by r.day)
        from (select (occurred_at at time zone tz)::date as day, model_slug, sum(cost_brl) as cost_brl
              from cur where model_slug in (select model_slug from top_models) group by 1, 2) r
      ), '[]'::jsonb),
      'top_users', coalesce((
        select jsonb_agg(row_to_json(r) order by r.cost_brl desc)
        from (select c.user_id,
                case when sees_people then (select email::text from auth.users where id = c.user_id) end as email,
                m.plan_name, m.plan_slug, count(*) as generations, coalesce(sum(c.credits), 0) as credits, coalesce(sum(c.cost_brl), 0) as cost_brl
              from cur c left join members m on m.user_id = c.user_id
              group by c.user_id, m.plan_name, m.plan_slug order by sum(c.cost_brl) desc limit 10) r
      ), '[]'::jsonb)
    ),
    'users', jsonb_build_object(
      'dau', (select count(distinct user_id) from gens where created_at >= today_start),
      'mau', (select count(distinct g.user_id) from public.generations g where g.created_at >= now() - interval '30 days'),
      'wau', (select count(distinct g.user_id) from public.generations g where g.created_at >= week_start),
      'active_period', (select count(distinct user_id) from gen_cur),
      'generations_period', (select count(*) from gen_cur),
      'never_used', (select count(*) from balances where not generated),
      'used_ai', (select count(*) from balances where generated),
      'near_limit', (select count(*) from balances
        where balance > 0 and balance < greatest(ceil(coalesce(monthly_credits, 0) * 0.2), 20)),
      'exhausted', (select count(*) from balances where balance = 0 and generated),
      'active_series', (
        select jsonb_agg(jsonb_build_object('day', d.day, 'users', coalesce(a.users, 0)) order by d.day)
        from days d left join (
          select (created_at at time zone tz)::date as day, count(distinct user_id) as users from gen_cur group by 1
        ) a on a.day = d.day
      ),
      'cohorts', coalesce((
        select jsonb_agg(jsonb_build_object(
          'cohort', to_char(w.cohort, 'YYYY-MM-DD'),
          'size', (select count(*) from cohorts c where c.cohort = w.cohort),
          'active', (
            select jsonb_agg(
              case when w.cohort + (k || ' weeks')::interval > date_trunc('week', now() at time zone tz) then null
                else coalesce((select users from cohort_activity a where a.cohort = w.cohort and a.week = k), 0) end
              order by k)
            from generate_series(0, 7) k
          )
        ) order by w.cohort)
        from (select distinct cohort from cohorts) w
      ), '[]'::jsonb)
    ),
    'operations', jsonb_build_object(
      'total', (select count(*) from gen_cur),
      'succeeded', (select count(*) from gen_cur where status = 'succeeded'),
      'failed', (select count(*) from gen_cur where status = 'failed'),
      'open', (select count(*) from public.generations where status in ('queued', 'running')),
      'stuck', (select count(*) from public.generations where status in ('queued', 'running') and created_at < now() - interval '15 minutes'),
      'failed_billed', (select count(*) from cur where status = 'failed_billed'),
      'failed_billed_cost_brl', (select coalesce(sum(cost_brl), 0) from cur where status = 'failed_billed'),
      'duration', coalesce((
        select jsonb_agg(row_to_json(r) order by r.kind)
        from (select kind, count(*) as samples,
                round(avg(extract(epoch from completed_at - created_at))::numeric, 1) as avg_seconds,
                round((percentile_cont(0.9) within group (order by extract(epoch from completed_at - created_at)))::numeric, 1) as p90_seconds
              from gen_cur where status = 'succeeded' and completed_at is not null group by kind) r
      ), '[]'::jsonb),
      'providers', coalesce((
        select jsonb_agg(row_to_json(r) order by r.provider)
        from (select m.provider,
                (select count(*) from gens g where g.provider = m.provider and g.created_at >= now() - interval '1 day') as total_24h,
                (select count(*) from gens g where g.provider = m.provider and g.created_at >= now() - interval '1 day' and g.status = 'failed') as failed_24h,
                (select max(g.completed_at) from public.generations g join public.models x on x.slug = g.model_slug
                  where x.provider = m.provider and g.status = 'succeeded') as last_success_at,
                (select max(g.updated_at) from public.generations g join public.models x on x.slug = g.model_slug
                  where x.provider = m.provider and g.status = 'failed') as last_failure_at
              from (select distinct provider from public.models where active) m) r
      ), '[]'::jsonb),
      'errors', coalesce((
        select jsonb_agg(row_to_json(r) order by r.at desc)
        from (select g.id, g.updated_at as at, g.model_name, g.provider, g.kind, left(coalesce(g.error, 'sem mensagem'), 180) as error,
                case when sees_people then (select email::text from auth.users where id = g.user_id) end as email
              from gen_cur g where g.status = 'failed' order by g.updated_at desc limit 15) r
      ), '[]'::jsonb)
    )
  ) into result;
  return result;
end;
$$;
revoke execute on function public.admin_command_center(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_command_center(timestamptz, timestamptz) to authenticated;
