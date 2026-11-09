-- Listas do admin: todas as gerações e todas as assinaturas, com filtro e paginação.
-- Só leitura. Quem vê é quem já vê usuários (users.view); custo em US$ e valores pagos
-- só voltam para quem tem finance.view.

create index if not exists generations_status_created on public.generations (status, created_at desc);
create index if not exists subscriptions_status_created on public.subscriptions (status, created_at desc);

-- Gerações mais recentes primeiro. Filtros opcionais: status, ferramenta (slug do modelo) e
-- e-mail (contém). Até 100 por página; `total` conta tudo que casa com o filtro.
create function public.admin_generations(
  p_status text default null, p_model text default null, p_email text default null,
  p_limit integer default 50, p_offset integer default 0
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  sees_money boolean;
  lim integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  off integer := greatest(coalesce(p_offset, 0), 0);
  email_filter text := nullif(trim(lower(p_email)), '');
begin
  perform public.assert_admin_permission('users.view');
  sees_money := public.has_admin_permission('finance.view');

  return (
    with filtered as (
      select g.*, u.email, m.name as model_name
      from public.generations g
      join auth.users u on u.id = g.user_id
      join public.models m on m.slug = g.model_slug
      where (p_status is null or g.status::text = p_status)
        and (p_model is null or g.model_slug = p_model)
        and (email_filter is null or lower(u.email) like '%' || email_filter || '%')
    )
    select jsonb_build_object(
      'total', (select count(*) from filtered),
      'rows', coalesce((
        select jsonb_agg(row_to_json(r) order by r.created_at desc)
        from (
          select f.id, f.user_id, f.email, f.model_slug, f.model_name, f.kind, f.status::text as status,
            f.credits, left(f.prompt, 160) as prompt, f.error, f.format_slug, f.billed_on_failure,
            f.input_tokens, f.output_tokens,
            case when sees_money then coalesce(f.actual_cost_usd, f.spend_usd, f.provider_cost_usd) end as cost_usd,
            f.created_at, f.completed_at,
            extract(epoch from (f.completed_at - f.created_at))::integer as duration_seconds
          from filtered f
          order by f.created_at desc
          limit lim offset off
        ) r
      ), '[]'::jsonb)
    )
  );
end;
$$;

-- Assinaturas mais recentes primeiro, com o último pagamento. Filtros: status e e-mail.
create function public.admin_subscriptions(
  p_status text default null, p_email text default null,
  p_limit integer default 50, p_offset integer default 0
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  sees_money boolean;
  lim integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  off integer := greatest(coalesce(p_offset, 0), 0);
  email_filter text := nullif(trim(lower(p_email)), '');
begin
  perform public.assert_admin_permission('users.view');
  sees_money := public.has_admin_permission('finance.view');

  return (
    with filtered as (
      select s.*, u.email, p.name as plan_name
      from public.subscriptions s
      join auth.users u on u.id = s.user_id
      join public.subscription_plans p on p.slug = s.plan_slug
      where (p_status is null or s.status::text = p_status)
        and (email_filter is null or lower(u.email) like '%' || email_filter || '%')
    )
    select jsonb_build_object(
      'total', (select count(*) from filtered),
      'counts', (
        select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
        from (select status::text as status, count(*) as n from public.subscriptions group by status) c
      ),
      'rows', coalesce((
        select jsonb_agg(row_to_json(r) order by r.created_at desc)
        from (
          select f.id, f.user_id, f.email, f.plan_slug, f.plan_name, f.plan_version, f.status::text as status,
            case when sees_money then f.price_cents end as price_cents,
            f.monthly_credits, f.current_period_end, f.canceled_at, f.ended_at, f.created_at,
            (select count(*) from public.subscription_payments sp where sp.subscription_id = f.id and sp.status = 'confirmed') as payments,
            (select max(sp.paid_at) from public.subscription_payments sp where sp.subscription_id = f.id and sp.status = 'confirmed') as last_paid_at,
            case when sees_money then (select coalesce(sum(sp.amount_cents), 0) from public.subscription_payments sp
              where sp.subscription_id = f.id and sp.status = 'confirmed') end as paid_cents
          from filtered f
          order by f.created_at desc
          limit lim offset off
        ) r
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke execute on function public.admin_generations(text, text, text, integer, integer) from public, anon;
revoke execute on function public.admin_subscriptions(text, text, integer, integer) from public, anon;
grant execute on function public.admin_generations(text, text, text, integer, integer) to authenticated;
grant execute on function public.admin_subscriptions(text, text, integer, integer) to authenticated;
