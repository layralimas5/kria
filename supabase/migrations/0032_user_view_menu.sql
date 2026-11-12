-- "Ver como usuário" passa a desenhar o app como a pessoa vê: a moldura com o menu do plano dela.
-- Para isso `admin_user_view` devolve também as ferramentas do plano (`tools`), os limites de
-- personagens e marcas e os tipos de mídia que o Studio dela mostra. Continua só leitura e auditado.

create or replace function public.admin_user_view(p_user_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  admin_id uuid := public.assert_admin_permission('users.view');
  plan public.subscription_plans;
  result jsonb;
begin
  if not exists (select 1 from auth.users where id = p_user_id) then raise exception 'account_not_found'; end if;
  plan := public.effective_plan(p_user_id);

  select jsonb_build_object(
    'profile', (select jsonb_build_object('id', p.id, 'display_name', p.display_name, 'username', p.username, 'avatar_path', p.avatar_path,
        'email', u.email, 'created_at', p.created_at)
      from public.profiles p join auth.users u on u.id = p.id where p.id = p_user_id),
    'goal', (select goal from public.user_preferences where user_id = p_user_id),
    'plan', jsonb_build_object('slug', plan.slug, 'name', plan.name, 'price_cents', plan.price_cents, 'monthly_credits', plan.monthly_credits,
      'max_concurrent', plan.max_concurrent, 'daily_credit_limit', plan.daily_credit_limit, 'monthly_credit_limit', plan.monthly_credit_limit,
      'tools', to_jsonb(plan.tools), 'max_personas', plan.max_personas, 'max_brands', plan.max_brands),
    -- Tipos que aparecem no Studio dessa pessoa (mesma regra de usePlanModels no front).
    'kinds', coalesce((select jsonb_agg(distinct m.kind) from public.models m
      where m.active and m.studio and m.kind in ('image', 'video')
        and (m.allowed_plans is null or plan.slug = any(m.allowed_plans))), '[]'::jsonb),
    'wallet', coalesce((select jsonb_build_object('balance', balance, 'subscription_balance', subscription_balance, 'purchased_balance', purchased_balance)
      from public.credit_balances where user_id = p_user_id), jsonb_build_object('balance', 0, 'subscription_balance', 0, 'purchased_balance', 0)),
    'subscription', (select jsonb_build_object('id', s.id, 'plan_slug', s.plan_slug, 'status', s.status, 'price_cents', s.price_cents,
        'monthly_credits', s.monthly_credits, 'current_period_start', s.current_period_start, 'current_period_end', s.current_period_end,
        'canceled_at', s.canceled_at, 'created_at', s.created_at)
      from public.subscriptions s where s.user_id = p_user_id and s.status in ('active', 'past_due', 'canceled')
      order by s.created_at desc limit 1),
    'usage', jsonb_build_object(
      'used_today', public.user_credits_used(p_user_id, public.spend_day_start()),
      'used_month', public.user_credits_used(p_user_id, public.spend_month_start()),
      'daily_limit', plan.daily_credit_limit,
      'monthly_limit', plan.monthly_credit_limit
    ),
    'generations', coalesce((select jsonb_agg(g order by g.created_at desc) from (
      select g.id, g.model_slug, m.name as model_name, g.kind, g.prompt, g.status, g.credits, g.output_path, g.output_type, g.error,
        g.created_at, g.completed_at
      from public.generations g left join public.models m on m.slug = g.model_slug
      where g.user_id = p_user_id and g.kind in ('image', 'video')
      order by g.created_at desc limit 60
    ) g), '[]'::jsonb),
    'personas', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'image_path', image_path) order by created_at desc)
      from public.personas where user_id = p_user_id), '[]'::jsonb)
  ) into result;

  perform public.admin_log(admin_id, 'user.view_as', p_user_id, null, '{}'::jsonb, null);
  return result;
end;
$$;
