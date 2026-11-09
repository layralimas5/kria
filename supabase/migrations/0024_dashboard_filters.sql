-- Dashboard com filtros: além do período, plano (o plano atual da conta) e ferramenta (modelo).
-- Mesmos números e mesmo formato do 0014; os filtros só recortam a base.
--   Plano: contas cujo plano valendo agora é esse ('gratis' = sem assinatura valendo).
--   Ferramenta: gerações, créditos, custo e ativos passam a contar só esse modelo.
-- Receita, MRR e churn seguem o filtro de plano; a ferramenta não muda a parte financeira.

drop function if exists public.admin_dashboard(timestamptz, timestamptz);

create function public.admin_dashboard(
  p_from timestamptz, p_to timestamptz, p_plan text default null, p_model text default null
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  tz constant text := 'America/Sao_Paulo';
  span interval;
  prev_from timestamptz;
  sees_money boolean;
  sees_users boolean;
  today_start timestamptz := date_trunc('day', now() at time zone tz) at time zone tz;
  result jsonb;
begin
  perform public.assert_admin_permission('dashboard.view');
  if p_from is null or p_to is null or p_from >= p_to or p_to - p_from > interval '400 days' then
    raise exception 'invalid_period';
  end if;
  span := p_to - p_from;
  prev_from := p_from - span;
  sees_money := public.has_admin_permission('finance.view');
  sees_users := public.has_admin_permission('users.view');

  with
  live_all as (
    select s.* from public.subscriptions s
    where (s.status in ('active', 'past_due') and s.current_period_end + interval '3 days' > now())
       or (s.status = 'canceled' and s.current_period_end > now())
  ),
  members as (
    select u.id as user_id from auth.users u
    where p_plan is null
       or coalesce((select l.plan_slug from live_all l where l.user_id = u.id order by l.created_at desc limit 1), 'gratis') = p_plan
  ),
  all_gens as (
    select g.* from public.generations g
    where (p_model is null or g.model_slug = p_model)
      and (p_plan is null or g.user_id in (select user_id from members))
  ),
  gens as (
    select g.*, m.name as model_name, m.provider from all_gens g join public.models m on m.slug = g.model_slug
    where g.created_at >= p_from and g.created_at < p_to
  ),
  reservations as (
    select cr.* from public.credit_reservations cr
    where cr.status = 'captured'
      and (p_plan is null or cr.user_id in (select user_id from members))
      and (p_model is null or exists (select 1 from public.generations g where g.id = cr.generation_id and g.model_slug = p_model))
  ),
  people as (
    select p.* from public.profiles p where p_plan is null or p.id in (select user_id from members)
  ),
  live as (
    select * from live_all where p_plan is null or plan_slug = p_plan
  ),
  received as (
    select s.plan_slug, p.amount_cents as cents, p.paid_at as at, 'subscription' as source
    from public.subscription_payments p join public.subscriptions s on s.id = p.subscription_id
    where p.status = 'confirmed' and (p_plan is null or s.plan_slug = p_plan)
    union all
    select null, price_cents, paid_at, 'pack' from public.purchases
    where status = 'paid' and (p_plan is null or user_id in (select user_id from members))
  ),
  days as (
    select d::date as day
    from generate_series((p_from at time zone tz)::date, ((p_to - interval '1 microsecond') at time zone tz)::date, interval '1 day') d
  )
  select jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'filters', jsonb_build_object('plan', p_plan, 'model', p_model),
    'users', jsonb_build_object(
      'total', (select count(*) from members),
      'new_in_period', (select count(*) from people where created_at >= p_from and created_at < p_to),
      'new_previous', (select count(*) from people where created_at >= prev_from and created_at < p_from),
      'new_today', (select count(*) from people where created_at >= today_start),
      'new_7d', (select count(*) from people where created_at >= now() - interval '7 days'),
      'new_30d', (select count(*) from people where created_at >= now() - interval '30 days'),
      'active_1d', (select count(distinct user_id) from all_gens where created_at >= now() - interval '1 day'),
      'active_30d', (select count(distinct user_id) from all_gens where created_at >= now() - interval '30 days'),
      'active_in_period', (select count(distinct user_id) from gens),
      'paying', (select count(distinct user_id) from live),
      'onboarded_in_period', (select count(*) from public.user_preferences up join people p on p.id = up.user_id
        where p.created_at >= p_from and p.created_at < p_to and up.onboarded_at is not null),
      'first_generation_in_period', (select count(*) from people p
        where p.created_at >= p_from and p.created_at < p_to
          and exists (select 1 from all_gens g where g.user_id = p.id)),
      'converted_in_period', (select count(*) from people p
        where p.created_at >= p_from and p.created_at < p_to
          and (exists (select 1 from public.subscription_payments sp where sp.user_id = p.id and sp.status = 'confirmed')
               or exists (select 1 from public.purchases pu where pu.user_id = p.id and pu.status = 'paid')))
    ),
    'generations', jsonb_build_object(
      'total', (select count(*) from gens),
      'succeeded', (select count(*) from gens where status = 'succeeded'),
      'failed', (select count(*) from gens where status = 'failed'),
      'open', (select count(*) from gens where status in ('queued', 'running')),
      'image', (select count(*) from gens where kind = 'image'),
      'video', (select count(*) from gens where kind = 'video'),
      'text', (select count(*) from gens where kind = 'text'),
      'today', (select count(*) from all_gens where created_at >= today_start),
      'month', (select count(*) from all_gens where created_at >= date_trunc('month', now() at time zone tz) at time zone tz),
      'credits_consumed', (select coalesce(sum(amount), 0) from reservations where settled_at >= p_from and settled_at < p_to),
      'previous_total', (select count(*) from all_gens where created_at >= prev_from and created_at < p_from),
      'previous_failed', (select count(*) from all_gens where status = 'failed' and created_at >= prev_from and created_at < p_from)
    ),
    'plan_distribution', coalesce((
      select jsonb_agg(row_to_json(r) order by r.position)
      from (
        select p.slug, p.name, p.position,
          case when p.slug = 'gratis'
            then (select count(*) from auth.users) - (select count(distinct user_id) from live_all)
            else (select count(distinct l.user_id) from live_all l where l.plan_slug = p.slug)
          end as users
        from public.subscription_plans p
        where p_plan is null or p.slug = p_plan
      ) r
    ), '[]'::jsonb),
    'by_model', coalesce((
      select jsonb_agg(row_to_json(r) order by r.total desc)
      from (
        select model_slug, model_name as name, kind, provider, count(*) as total,
          count(*) filter (where status = 'failed') as failed,
          coalesce(sum(credits) filter (where status = 'succeeded'), 0) as credits,
          case when sees_money then coalesce(sum(provider_cost_usd) filter (where status = 'succeeded'), 0) end as cost_usd
        from gens group by model_slug, model_name, kind, provider
      ) r
    ), '[]'::jsonb),
    'series', (
      select jsonb_agg(row_to_json(r) order by r.day)
      from (
        select d.day,
          (select count(*) from people p where (p.created_at at time zone tz)::date = d.day
             and p.created_at >= p_from and p.created_at < p_to) as signups,
          (select count(*) from gens g where (g.created_at at time zone tz)::date = d.day and g.status = 'succeeded') as succeeded,
          (select count(*) from gens g where (g.created_at at time zone tz)::date = d.day and g.status = 'failed') as failed,
          (select coalesce(sum(amount), 0) from reservations cr
             where cr.settled_at >= p_from and cr.settled_at < p_to and (cr.settled_at at time zone tz)::date = d.day) as credits,
          (select count(*) from public.subscriptions s where s.status <> 'pending' and (p_plan is null or s.plan_slug = p_plan)
             and s.created_at >= p_from and s.created_at < p_to and (s.created_at at time zone tz)::date = d.day) as new_subscriptions,
          (select count(*) from public.subscriptions s where (p_plan is null or s.plan_slug = p_plan)
             and s.canceled_at >= p_from and s.canceled_at < p_to and (s.canceled_at at time zone tz)::date = d.day) as cancellations,
          case when sees_money then (select coalesce(sum(cents), 0) from received x
             where x.at >= p_from and x.at < p_to and (x.at at time zone tz)::date = d.day) end as revenue_cents,
          case when sees_money then (select coalesce(sum(g.provider_cost_usd), 0) from gens g
             where g.status = 'succeeded' and (g.created_at at time zone tz)::date = d.day) end as api_cost_usd
        from days d
      ) r
    ),
    'top_consumers', case when sees_users then coalesce((
      select jsonb_agg(row_to_json(r) order by r.credits desc)
      from (
        select cr.user_id, u.email::text as email, sum(cr.amount) as credits, count(*) as generations
        from reservations cr join auth.users u on u.id = cr.user_id
        where cr.settled_at >= p_from and cr.settled_at < p_to
        group by cr.user_id, u.email
        order by sum(cr.amount) desc
        limit 5
      ) r
    ), '[]'::jsonb) end,
    'finance', case when sees_money then jsonb_build_object(
      'mrr_cents', (select coalesce(sum(price_cents), 0) from live where status in ('active', 'past_due')),
      'past_due', (select count(*) from live where status = 'past_due'),
      'received_cents', (select coalesce(sum(cents), 0) from received where at >= p_from and at < p_to),
      'received_previous_cents', (select coalesce(sum(cents), 0) from received where at >= prev_from and at < p_from),
      'received_total_cents', (select coalesce(sum(cents), 0) from received),
      'subscription_received_cents', (select coalesce(sum(cents), 0) from received where source = 'subscription' and at >= p_from and at < p_to),
      'pack_received_cents', (select coalesce(sum(cents), 0) from received where source = 'pack' and at >= p_from and at < p_to),
      'payments_count', (select count(*) from received where at >= p_from and at < p_to),
      'refunds_cents', (select coalesce(sum(sp.amount_cents), 0) from public.subscription_payments sp
        join public.subscriptions s on s.id = sp.subscription_id
        where sp.status = 'refunded' and sp.paid_at >= p_from and sp.paid_at < p_to and (p_plan is null or s.plan_slug = p_plan))
        + (select coalesce(sum(price_cents), 0) from public.purchases where status = 'refunded' and created_at >= p_from and created_at < p_to
            and (p_plan is null or user_id in (select user_id from members))),
      'new_subscriptions', (select count(*) from public.subscriptions where status <> 'pending' and created_at >= p_from and created_at < p_to
        and (p_plan is null or plan_slug = p_plan)),
      'cancellations', (select count(*) from public.subscriptions where canceled_at >= p_from and canceled_at < p_to
        and (p_plan is null or plan_slug = p_plan)),
      'cancellations_previous', (select count(*) from public.subscriptions where canceled_at >= prev_from and canceled_at < p_from
        and (p_plan is null or plan_slug = p_plan)),
      'churn_base', case when p_plan is null then public.subscriptions_live_at(p_from) else (
        select count(*) from public.subscriptions s
        where s.plan_slug = p_plan
          and coalesce(s.canceled_at, 'infinity') > p_from
          and coalesce(s.ended_at, 'infinity') > p_from
          and exists (select 1 from public.subscription_payments sp where sp.subscription_id = s.id and sp.paid_at <= p_from)) end,
      'churn_lost', (select count(*) from public.subscriptions s
        where (p_plan is null or s.plan_slug = p_plan)
          and exists (select 1 from public.subscription_payments p where p.subscription_id = s.id and p.paid_at < p_to)
          and ((s.canceled_at >= p_from and s.canceled_at < p_to)
            or (s.canceled_at is null and s.ended_at >= p_from and s.ended_at < p_to
                and not exists (select 1 from public.subscriptions n where n.user_id = s.user_id and n.id <> s.id
                  and n.created_at >= s.created_at and n.status <> 'pending')))),
      'api_cost_usd', (select coalesce(sum(provider_cost_usd), 0) from gens where status = 'succeeded'),
      'api_cost_previous_usd', (select coalesce(sum(provider_cost_usd), 0) from all_gens
        where status = 'succeeded' and created_at >= prev_from and created_at < p_from),
      'api_cost_unknown', (select count(*) from gens where status = 'succeeded' and provider_cost_usd is null),
      'usd_brl', (select usd_brl from public.pricing_settings),
      'payment_fee_rate', (select payment_fee_rate from public.pricing_settings),
      'by_plan', coalesce((
        select jsonb_agg(row_to_json(r) order by r.position)
        from (
          select p.slug, p.name, p.position,
            (select count(*) from live l where l.plan_slug = p.slug and l.status in ('active', 'past_due')) as subscribers,
            (select coalesce(sum(l.price_cents), 0) from live l where l.plan_slug = p.slug and l.status in ('active', 'past_due')) as mrr_cents,
            (select coalesce(sum(x.cents), 0) from received x where x.plan_slug = p.slug and x.at >= p_from and x.at < p_to) as received_cents
          from public.subscription_plans p where p.public and (p_plan is null or p.slug = p_plan)
        ) r
      ), '[]'::jsonb)
    ) end
  ) into result;
  return result;
end;
$$;

revoke execute on function public.admin_dashboard(timestamptz, timestamptz, text, text) from public, anon;
grant execute on function public.admin_dashboard(timestamptz, timestamptz, text, text) to authenticated;
