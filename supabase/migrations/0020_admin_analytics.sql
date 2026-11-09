-- Analytics do painel: retenção, ferramentas mais usadas e controle de créditos e tokens.
-- Só leitura: uma função que agrega o que já existe (gerações, exportações do Multiplicador,
-- extrato de créditos, saldos, assinaturas). Nenhuma tabela nova, nenhum dado alterado.
--
-- "Atividade" = gerar algo ou exportar no Multiplicador. Login sozinho não conta como uso;
-- ele aparece à parte (auth.users.last_sign_in_at) para comparar.
-- Custo em US$, e-mails e saldo por pessoa só voltam para quem tem a permissão.

create index if not exists generations_user_created on public.generations (user_id, created_at);
create index if not exists credit_ledger_created on public.credit_ledger (created_at);

create function public.admin_analytics(p_from timestamptz, p_to timestamptz) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  tz constant text := 'America/Sao_Paulo';
  span interval;
  prev_from timestamptz;
  sees_money boolean;
  sees_users boolean;
  week0 timestamptz;
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
  -- Oito semanas de coorte terminando na semana do fim do período (segunda a domingo, Brasília).
  week0 := (date_trunc('week', (p_to - interval '1 microsecond') at time zone tz) - interval '7 weeks') at time zone tz;

  with
  activity as (
    select user_id, created_at as at from public.generations
    union all
    select user_id, created_at from public.multiplier_exports
  ),
  last_activity as (
    select user_id, max(at) as at, min(at) as first_at, count(*) as actions from activity group by user_id
  ),
  gens as (
    select g.*, coalesce(g.actual_cost_usd, g.spend_usd, g.provider_cost_usd) as cost_usd
    from public.generations g
    where g.created_at >= p_from and g.created_at < p_to
  ),
  live as (
    select distinct on (s.user_id) s.user_id, s.plan_slug from public.subscriptions s
    where (s.status in ('active', 'past_due') and s.current_period_end + interval '3 days' > now())
       or (s.status = 'canceled' and s.current_period_end > now())
    order by s.user_id, s.created_at desc
  ),
  days as (
    select d::date as day
    from generate_series((p_from at time zone tz)::date, ((p_to - interval '1 microsecond') at time zone tz)::date, interval '1 day') d
  ),
  cohort_users as (
    select p.id as user_id, date_trunc('week', p.created_at at time zone tz) at time zone tz as week_start, p.created_at
    from public.profiles p
    where p.created_at >= week0 and p.created_at < p_to
  ),
  cohort_activity as (
    select cu.week_start, cu.user_id, floor(extract(epoch from (a.at - cu.week_start)) / 604800)::int as week_n
    from cohort_users cu join activity a on a.user_id = cu.user_id
    where a.at >= cu.week_start
  ),
  signed_up as (
    select p.id as user_id, p.created_at from public.profiles p where p.created_at >= p_from and p.created_at < p_to
  ),
  ledger as (
    select * from public.credit_ledger where created_at >= p_from and created_at < p_to
  )
  select jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),

    'retention', jsonb_build_object(
      'dau', (select count(distinct user_id) from activity where at >= now() - interval '1 day'),
      'wau', (select count(distinct user_id) from activity where at >= now() - interval '7 days'),
      'mau', (select count(distinct user_id) from activity where at >= now() - interval '30 days'),
      'logins_7d', (select count(*) from auth.users where last_sign_in_at >= now() - interval '7 days'),
      'logins_30d', (select count(*) from auth.users where last_sign_in_at >= now() - interval '30 days'),
      'ever_active', (select count(*) from last_activity),
      'total_users', (select count(*) from public.profiles),
      -- Quem se cadastrou no período e voltou a usar na janela: D1 = 24h a 48h depois do cadastro,
      -- D7 = 7 a 14 dias, D30 = 30 a 60 dias. Só entra na base quem já teve tempo de chegar lá.
      'returning', (
        select jsonb_agg(jsonb_build_object('day', w.n, 'eligible', w.eligible, 'returned', w.returned) order by w.n)
        from (
          select n,
            (select count(*) from signed_up su where su.created_at + make_interval(days => n) <= now()) as eligible,
            (select count(*) from signed_up su
              where su.created_at + make_interval(days => n) <= now()
                and exists (select 1 from activity a where a.user_id = su.user_id
                  and a.at >= su.created_at + make_interval(days => n)
                  and a.at < su.created_at + make_interval(days => n * 2)))
            as returned
          from unnest(array[1, 7, 30]) n
        ) w
      ),
      'activation', jsonb_build_object(
        'signed_up', (select count(*) from signed_up),
        'activated', (select count(*) from signed_up su where exists (select 1 from activity a where a.user_id = su.user_id)),
        'activated_24h', (select count(*) from signed_up su
          where exists (select 1 from activity a where a.user_id = su.user_id and a.at < su.created_at + interval '1 day'))
      ),
      'cohorts', coalesce((
        select jsonb_agg(jsonb_build_object(
          'week_start', c.week_start,
          'size', c.size,
          'weeks', (
            select jsonb_agg(
              (select count(distinct ca.user_id) from cohort_activity ca where ca.week_start = c.week_start and ca.week_n = k)
              order by k)
            from generate_series(0, greatest(0, floor(extract(epoch from (now() - c.week_start)) / 604800)::int)) k
            where k <= 7
          )
        ) order by c.week_start)
        from (select week_start, count(*) as size from cohort_users group by week_start) c
      ), '[]'::jsonb),
      'subscriptions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'month', to_char(m.month_start at time zone tz, 'YYYY-MM'),
          'live_at_start', public.subscriptions_live_at(m.month_start),
          'new', (select count(*) from public.subscriptions s where s.created_at >= m.month_start and s.created_at < m.month_end
            and exists (select 1 from public.subscription_payments sp where sp.subscription_id = s.id and sp.status = 'confirmed')),
          'canceled', (select count(*) from public.subscriptions s where s.canceled_at >= m.month_start and s.canceled_at < m.month_end)
        ) order by m.month_start)
        from (
          select (d at time zone tz) as month_start, ((d + interval '1 month') at time zone tz) as month_end
          from generate_series(date_trunc('month', now() at time zone tz) - interval '5 months', date_trunc('month', now() at time zone tz), interval '1 month') d
        ) m
      ), '[]'::jsonb),
      -- Já usaram, mas pararam há 14 dias ou mais. Pagante primeiro: é quem dá para recuperar.
      'dormant_count', (select count(*) from last_activity where at < now() - interval '14 days'),
      'dormant', case when sees_users then coalesce((
        select jsonb_agg(row_to_json(r))
        from (
          select la.user_id, u.email, la.at as last_activity_at, u.last_sign_in_at, la.actions,
            coalesce(l.plan_slug, 'gratis') as plan_slug, coalesce(b.balance, 0) as balance
          from last_activity la
          join auth.users u on u.id = la.user_id
          left join live l on l.user_id = la.user_id
          left join public.credit_balances b on b.user_id = la.user_id
          where la.at < now() - interval '14 days'
          order by (l.plan_slug is not null) desc, la.at desc
          limit 20
        ) r
      ), '[]'::jsonb) else null end
    ),

    'tools', jsonb_build_object(
      'total', (select count(*) from gens),
      'previous_total', (select count(*) from public.generations where created_at >= prev_from and created_at < p_from),
      'multiplier_exports', (select count(*) from public.multiplier_exports where created_at >= p_from and created_at < p_to and status = 'done'),
      'by_tool', coalesce((
        select jsonb_agg(row_to_json(r) order by r.total desc)
        from (
          select g.model_slug, m.name, m.kind,
            count(*) as total,
            count(distinct g.user_id) as users,
            count(*) filter (where g.status = 'succeeded') as succeeded,
            count(*) filter (where g.status = 'failed') as failed,
            coalesce(sum(g.credits) filter (where g.status = 'succeeded'), 0) as credits,
            case when sees_money then round(coalesce(sum(g.cost_usd), 0), 4) end as cost_usd,
            (select count(*) from public.generations pg where pg.model_slug = g.model_slug and pg.created_at >= prev_from and pg.created_at < p_from) as previous_total
          from gens g join public.models m on m.slug = g.model_slug
          group by g.model_slug, m.name, m.kind
        ) r
      ), '[]'::jsonb),
      'by_plan', coalesce((
        select jsonb_agg(row_to_json(r) order by r.total desc)
        from (
          select coalesce(l.plan_slug, 'gratis') as plan_slug,
            count(*) as total,
            count(distinct g.user_id) as users,
            count(*) filter (where g.kind = 'image') as image,
            count(*) filter (where g.kind = 'video') as video,
            count(*) filter (where g.kind = 'text') as text
          from gens g left join live l on l.user_id = g.user_id
          group by 1
        ) r
      ), '[]'::jsonb),
      'by_format', coalesce((
        select jsonb_agg(row_to_json(r) order by r.total desc)
        from (
          select g.format_slug as slug, count(*) as total, count(distinct g.user_id) as users
          from gens g where g.format_slug is not null group by 1 order by 2 desc limit 10
        ) r
      ), '[]'::jsonb),
      'series', (
        select jsonb_agg(jsonb_build_object(
          'day', d.day,
          'image', (select count(*) from gens g where g.kind = 'image' and (g.created_at at time zone tz)::date = d.day),
          'video', (select count(*) from gens g where g.kind = 'video' and (g.created_at at time zone tz)::date = d.day),
          'text', (select count(*) from gens g where g.kind = 'text' and (g.created_at at time zone tz)::date = d.day),
          'users', (select count(distinct g.user_id) from gens g where (g.created_at at time zone tz)::date = d.day)
        ) order by d.day)
        from days d
      )
    ),

    'credits', jsonb_build_object(
      -- Extrato do período por motivo: o que entrou e o que saiu, separando assinatura e avulso.
      'by_reason', coalesce((
        select jsonb_agg(row_to_json(r) order by r.reason)
        from (
          select reason::text as reason, count(*) as entries,
            coalesce(sum(delta) filter (where delta > 0), 0) as credited,
            coalesce(-sum(delta) filter (where delta < 0), 0) as debited,
            coalesce(sum(subscription_delta), 0) as subscription_net,
            coalesce(sum(purchased_delta), 0) as purchased_net
          from ledger group by reason
        ) r
      ), '[]'::jsonb),
      'granted', (select coalesce(sum(delta), 0) from ledger where delta > 0 and reason <> 'generation_refund'),
      'spent', (select coalesce(-sum(delta), 0) from ledger where reason = 'generation')
        - (select coalesce(sum(delta), 0) from ledger where reason = 'generation_refund'),
      'expired', (select coalesce(-sum(delta), 0) from ledger where reason = 'subscription_expire'),
      -- Fotografia de agora: créditos em carteira (passivo) e reservados em gerações abertas.
      'outstanding', (select coalesce(sum(balance), 0) from public.credit_balances),
      'outstanding_subscription', (select coalesce(sum(subscription_balance), 0) from public.credit_balances),
      'outstanding_purchased', (select coalesce(sum(purchased_balance), 0) from public.credit_balances),
      'wallets_with_balance', (select count(*) from public.credit_balances where balance > 0),
      'held', (select coalesce(sum(amount), 0) from public.credit_reservations where status = 'held'),
      'series', (
        select jsonb_agg(jsonb_build_object(
          'day', d.day,
          'granted', (select coalesce(sum(delta), 0) from ledger l where l.delta > 0 and l.reason <> 'generation_refund' and (l.created_at at time zone tz)::date = d.day),
          'spent', (select coalesce(-sum(delta), 0) from ledger l where l.reason = 'generation' and (l.created_at at time zone tz)::date = d.day)
        ) order by d.day)
        from days d
      ),
      'top_spenders', case when sees_users then coalesce((
        select jsonb_agg(row_to_json(r))
        from (
          select l.user_id, u.email, -sum(l.delta) as spent, count(*) as generations, coalesce(b.balance, 0) as balance
          from ledger l join auth.users u on u.id = l.user_id
          left join public.credit_balances b on b.user_id = l.user_id
          where l.reason = 'generation'
          group by l.user_id, u.email, b.balance
          order by 3 desc limit 10
        ) r
      ), '[]'::jsonb) else null end
    ),

    'tokens', jsonb_build_object(
      'input', (select coalesce(sum(input_tokens), 0) from gens),
      'output', (select coalesce(sum(output_tokens), 0) from gens),
      'measured', (select count(*) from gens where kind = 'text' and input_tokens is not null),
      'unmeasured', (select count(*) from gens where kind = 'text' and status = 'succeeded' and input_tokens is null),
      'cost_usd', case when sees_money then (select round(coalesce(sum(cost_usd), 0), 4) from gens where kind = 'text') end,
      'by_model', coalesce((
        select jsonb_agg(row_to_json(r) order by r.input + r.output desc)
        from (
          select g.model_slug, m.name, count(*) as requests,
            coalesce(sum(g.input_tokens), 0) as input, coalesce(sum(g.output_tokens), 0) as output,
            case when sees_money then round(coalesce(sum(g.cost_usd), 0), 4) end as cost_usd
          from gens g join public.models m on m.slug = g.model_slug
          where g.kind = 'text'
          group by g.model_slug, m.name
        ) r
      ), '[]'::jsonb),
      'series', (
        select jsonb_agg(jsonb_build_object(
          'day', d.day,
          'input', (select coalesce(sum(input_tokens), 0) from gens g where (g.created_at at time zone tz)::date = d.day),
          'output', (select coalesce(sum(output_tokens), 0) from gens g where (g.created_at at time zone tz)::date = d.day)
        ) order by d.day)
        from days d
      ),
      'top_users', case when sees_users then coalesce((
        select jsonb_agg(row_to_json(r))
        from (
          select g.user_id, u.email, count(*) as requests,
            coalesce(sum(g.input_tokens), 0) as input, coalesce(sum(g.output_tokens), 0) as output,
            case when sees_money then round(coalesce(sum(g.cost_usd), 0), 4) end as cost_usd
          from gens g join auth.users u on u.id = g.user_id
          where g.kind = 'text' and g.input_tokens is not null
          group by g.user_id, u.email
          order by coalesce(sum(g.input_tokens), 0) + coalesce(sum(g.output_tokens), 0) desc limit 10
        ) r
      ), '[]'::jsonb) else null end
    )
  ) into result;

  return result;
end;
$$;

revoke execute on function public.admin_analytics(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_analytics(timestamptz, timestamptz) to authenticated;
