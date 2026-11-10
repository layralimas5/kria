-- Controles da conta pelo admin (Usuários > ficha): excluir a conta, trocar a senha, mandar o link de
-- redefinição e ver o Dashboard como a pessoa vê.
--
-- Excluir e trocar senha precisam da chave de serviço do Auth, então rodam na function `admin-users`.
-- Antes, a function pergunta ao banco, com o JWT de quem pediu, se pode (`admin_check_user_action`:
-- permissão `users.manage`, segundo fator, motivo, conta existente, nunca a própria nem a de outro
-- admin). Depois, registra na auditoria (`admin_log_user_action`). A senha nunca passa pelo banco.
--
-- "Ver como usuário" é só leitura: `admin_user_view` devolve o que o Dashboard da pessoa mostra,
-- sem abrir a sessão dela, e cada visualização fica na auditoria (`user.view_as`).

create function public.admin_check_user_action(p_user_id uuid, p_action text, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  admin_id uuid := public.assert_admin_permission('users.manage');
  target_email text;
begin
  if p_action not in ('delete', 'password', 'reset_link') then raise exception 'invalid_action'; end if;
  if char_length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'reason_required'; end if;
  if p_user_id = admin_id then raise exception 'cannot_change_self'; end if;
  select email::text into target_email from auth.users where id = p_user_id;
  if not found then raise exception 'account_not_found'; end if;
  -- Conta de quem opera o painel muda só pela tela de Administradores (tira o acesso antes).
  if exists (select 1 from public.admin_users where user_id = p_user_id) then raise exception 'target_is_admin'; end if;
  return jsonb_build_object('email', target_email);
end;
$$;

create function public.admin_log_user_action(p_user_id uuid, p_action text, p_reason text, p_details jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  admin_id uuid := public.assert_admin_permission('users.manage');
begin
  if p_action not in ('delete', 'password', 'reset_link') then raise exception 'invalid_action'; end if;
  if char_length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'reason_required'; end if;
  perform public.admin_log(admin_id, 'user.' || p_action, p_user_id, null,
    coalesce(p_details, '{}'::jsonb) - 'password', left(trim(p_reason), 300));
end;
$$;

create function public.admin_user_view(p_user_id uuid) returns jsonb
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
      'max_concurrent', plan.max_concurrent, 'daily_credit_limit', plan.daily_credit_limit, 'monthly_credit_limit', plan.monthly_credit_limit),
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

revoke execute on function public.admin_check_user_action(uuid, text, text) from public, anon;
revoke execute on function public.admin_log_user_action(uuid, text, text, jsonb) from public, anon;
revoke execute on function public.admin_user_view(uuid) from public, anon;
grant execute on function public.admin_check_user_action(uuid, text, text) to authenticated;
grant execute on function public.admin_log_user_action(uuid, text, text, jsonb) to authenticated;
grant execute on function public.admin_user_view(uuid) to authenticated;
