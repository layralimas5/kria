-- Admin, etapa 1: papéis, permissões, MFA obrigatório, auditoria imutável e o
-- dashboard por período. Quem barra é o banco: cada função `admin_*` pede uma
-- permissão e a sessão em aal2 (segundo fator). O front só decide o que mostrar.
--
-- Quem já estava em `admin_users` vira super_admin (era a dona). Daqui em diante
-- papel só muda por `admin_set_role`, nunca pelo cliente e nunca na própria conta.

-- ------------------------------------------------------------- papéis

create type public.admin_role as enum ('super_admin', 'admin', 'support', 'finance', 'analyst');

alter table public.admin_users
  add column role public.admin_role not null default 'super_admin',
  add column granted_by uuid references auth.users (id) on delete set null,
  add column updated_at timestamptz not null default now();

-- Linha nova sem papel explícito recebe o menor acesso.
alter table public.admin_users alter column role set default 'analyst';

-- A matriz de acesso mora aqui e só aqui; o painel lê o resultado por `admin_me`.
create function public.admin_role_permissions(p_role public.admin_role) returns text[]
language sql immutable set search_path = public as $$
  select case p_role
    when 'super_admin' then array[
      'dashboard.view', 'finance.view', 'users.view', 'users.manage', 'credits.adjust',
      'plans.view', 'plans.manage', 'models.view', 'models.manage', 'pricing.manage',
      'audit.view', 'admins.manage'
    ]
    when 'admin' then array[
      'dashboard.view', 'users.view', 'users.manage', 'credits.adjust',
      'plans.view', 'models.view', 'models.manage', 'audit.view'
    ]
    when 'support' then array['dashboard.view', 'users.view']
    when 'finance' then array['dashboard.view', 'finance.view', 'users.view', 'plans.view', 'models.view']
    when 'analyst' then array['dashboard.view', 'plans.view', 'models.view']
  end;
$$;

-- Segundo fator na sessão atual. O claim `aal` vem no JWT do Supabase Auth.
create function public.admin_mfa_ok() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

create function public.has_admin_permission(p_permission text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.admin_mfa_ok() and exists (
    select 1 from public.admin_users a
    where a.user_id = auth.uid() and p_permission = any (public.admin_role_permissions(a.role))
  );
$$;

-- Recusa com o motivo certo: sem acesso, sem segundo fator ou sem a permissão.
create function public.assert_admin_permission(p_permission text) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare
  v_role public.admin_role;
begin
  select role into v_role from public.admin_users where user_id = auth.uid();
  if not found then raise exception 'forbidden'; end if;
  if not public.admin_mfa_ok() then raise exception 'mfa_required'; end if;
  if not (p_permission = any (public.admin_role_permissions(v_role))) then raise exception 'forbidden'; end if;
  return auth.uid();
end;
$$;

-- Função antiga que alguém chame sem permissão específica ainda exige o segundo fator.
create or replace function public.assert_admin() returns uuid
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if not public.admin_mfa_ok() then raise exception 'mfa_required'; end if;
  return auth.uid();
end;
$$;

-- O que o painel precisa saber para montar o menu e pedir o segundo fator.
-- Não exige aal2: é o que diz ao front que falta o segundo fator.
create function public.admin_me() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  a public.admin_users;
begin
  select * into a from public.admin_users where user_id = auth.uid();
  if not found then return null; end if;
  return jsonb_build_object(
    'role', a.role,
    'permissions', to_jsonb(public.admin_role_permissions(a.role)),
    'aal', coalesce(auth.jwt() ->> 'aal', 'aal1')
  );
end;
$$;

-- --------------------------------------------------------- auditoria

alter table public.admin_audit_logs
  add column entity text generated always as (split_part(action, '.', 1)) stored,
  add column result text not null default 'success' check (result in ('success', 'failed'));

create index admin_audit_logs_entity on public.admin_audit_logs (entity, created_at desc);
create index admin_audit_logs_target_user on public.admin_audit_logs (target_user_id, created_at desc) where target_user_id is not null;

-- Registro não se edita nem se apaga. A única mudança aceita é o `on delete set null`
-- do autor quando a conta dele é excluída. `entity` (gerada) ainda vem nula no NEW do BEFORE.
create function public.admin_audit_immutable() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.admin_id is null and old.admin_id is not null
     and (to_jsonb(new) - 'admin_id' - 'entity') = (to_jsonb(old) - 'admin_id' - 'entity') then
    return new;
  end if;
  raise exception 'audit_is_immutable';
end;
$$;

create trigger admin_audit_no_update before update on public.admin_audit_logs
  for each row execute function public.admin_audit_immutable();
create trigger admin_audit_no_delete before delete on public.admin_audit_logs
  for each row execute function public.admin_audit_immutable();

drop policy "admins read audit" on public.admin_audit_logs;
create policy "admins read audit" on public.admin_audit_logs for select to authenticated
  using (public.has_admin_permission('audit.view'));

-- ------------------------------------------- funções da 0004 com permissão

-- O dashboard por período (abaixo) substitui a visão fixa de 30 dias.
drop function public.admin_overview();

-- Parâmetros de preço para a tela de modelos: quem vê modelo vê como o custo vira crédito.
create function public.admin_pricing() returns public.pricing_settings
language plpgsql stable security definer set search_path = public as $$
declare
  settings public.pricing_settings;
begin
  perform public.assert_admin_permission('models.view');
  select * into settings from public.pricing_settings;
  return settings;
end;
$$;

create or replace function public.admin_search_users(p_query text default '', p_limit integer default 30)
returns table (
  id uuid, email text, display_name text, username text, balance integer, subscription_balance integer,
  purchased_balance integer, plan_slug text, subscription_status public.subscription_status,
  suspended_at timestamptz, created_at timestamptz, generations bigint
)
language plpgsql stable security definer set search_path = public as $$
declare
  term text := '%' || lower(trim(coalesce(p_query, ''))) || '%';
begin
  perform public.assert_admin_permission('users.view');
  return query
  select u.id, u.email::text, p.display_name, p.username, b.balance, b.subscription_balance, b.purchased_balance,
    s.plan_slug, s.status, p.suspended_at, p.created_at,
    (select count(*) from public.generations g where g.user_id = u.id)
  from auth.users u
  join public.profiles p on p.id = u.id
  left join public.credit_balances b on b.user_id = u.id
  left join lateral (
    select x.plan_slug, x.status from public.subscriptions x
    where x.user_id = u.id and x.status <> 'pending' order by x.created_at desc limit 1
  ) s on true
  where lower(coalesce(u.email::text, '')) like term or lower(p.username) like term or lower(coalesce(p.display_name, '')) like term
  order by p.created_at desc
  limit least(greatest(p_limit, 1), 100);
end;
$$;

-- Pagamentos só para quem tem `finance.view`; o suporte vê créditos e gerações.
create or replace function public.admin_user_detail(p_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_admin_permission('users.view');
  return jsonb_build_object(
    'ledger', coalesce((select jsonb_agg(row_to_json(l)) from (
      select id, delta, subscription_delta, purchased_delta, balance_after, reason, note, created_at
      from public.credit_ledger where user_id = p_user_id order by created_at desc, id desc limit 40) l), '[]'::jsonb),
    'generations', coalesce((select jsonb_agg(row_to_json(g)) from (
      select id, model_slug, kind, status, credits, provider_cost_usd, error, created_at
      from public.generations where user_id = p_user_id order by created_at desc limit 30) g), '[]'::jsonb),
    'subscriptions', coalesce((select jsonb_agg(row_to_json(s)) from (
      select id, plan_slug, status, price_cents, current_period_end, canceled_at, created_at
      from public.subscriptions where user_id = p_user_id order by created_at desc limit 10) s), '[]'::jsonb),
    'payments', case when public.has_admin_permission('finance.view') then coalesce((select jsonb_agg(row_to_json(x)) from (
      select 'subscription' as type, amount_cents, status, paid_at as at from public.subscription_payments where user_id = p_user_id
      union all
      select 'pack', price_cents, status::text, coalesce(paid_at, created_at) from public.purchases where user_id = p_user_id
      order by at desc limit 30) x), '[]'::jsonb) end
  );
end;
$$;

create or replace function public.admin_adjust_credits(p_user_id uuid, p_amount integer, p_reason text) returns integer
language plpgsql security definer set search_path = public as $$
declare
  admin_id uuid := public.assert_admin_permission('credits.adjust');
  current_purchased integer;
  new_balance integer;
begin
  if p_amount = 0 or abs(p_amount) > 100000 then raise exception 'invalid_amount'; end if;
  if char_length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'reason_required'; end if;

  select purchased_balance into current_purchased from public.credit_balances where user_id = p_user_id for update;
  if not found then raise exception 'account_not_found'; end if;
  if current_purchased + p_amount < 0 then raise exception 'insufficient_credits'; end if;

  new_balance := public.wallet_move(p_user_id, 0, p_amount, 'adjustment', trim(p_reason), p_actor_id => admin_id);
  perform public.admin_log(admin_id, 'credits.adjust', p_user_id, null, jsonb_build_object('amount', p_amount), trim(p_reason));
  return new_balance;
end;
$$;

create or replace function public.admin_set_suspended(p_user_id uuid, p_suspended boolean, p_reason text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  admin_id uuid := public.assert_admin_permission('users.manage');
begin
  if char_length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'reason_required'; end if;
  if p_user_id = admin_id then raise exception 'cannot_suspend_self'; end if;

  update public.profiles
  set suspended_at = case when p_suspended then now() else null end,
      suspended_reason = case when p_suspended then trim(p_reason) else null end
  where id = p_user_id;
  if not found then raise exception 'account_not_found'; end if;

  perform public.admin_log(admin_id, case when p_suspended then 'user.suspend' else 'user.unsuspend' end,
    p_user_id, null, '{}'::jsonb, trim(p_reason));
  return true;
end;
$$;

create or replace function public.admin_update_plan(
  p_slug text, p_price_cents integer, p_monthly_credits integer, p_max_concurrent integer, p_active boolean, p_features text[]
) returns public.subscription_plans
language plpgsql security definer set search_path = public as $$
declare
  admin_id uuid := public.assert_admin_permission('plans.manage');
  before public.subscription_plans;
  after public.subscription_plans;
begin
  select * into before from public.subscription_plans where slug = p_slug for update;
  if not found then raise exception 'plan_not_found'; end if;
  if before.slug = 'gratis' and p_price_cents <> 0 then raise exception 'free_plan_is_free'; end if;

  update public.subscription_plans
  set price_cents = p_price_cents,
      monthly_credits = p_monthly_credits,
      max_concurrent = p_max_concurrent,
      active = p_active,
      features = coalesce(p_features, features),
      version = version + case when p_price_cents <> before.price_cents or p_monthly_credits <> before.monthly_credits then 1 else 0 end,
      updated_at = now()
  where slug = p_slug
  returning * into after;

  perform public.admin_log(admin_id, 'plan.update', null, p_slug,
    jsonb_build_object('before', to_jsonb(before) - 'updated_at', 'after', to_jsonb(after) - 'updated_at'), null);
  return after;
end;
$$;

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
  returning * into after;
  perform public.admin_log(admin_id, 'pricing.update', null, null,
    jsonb_build_object('before', to_jsonb(before) - 'id' - 'updated_at', 'after', to_jsonb(after) - 'id' - 'updated_at'), null);
  return after;
end;
$$;

create or replace function public.admin_models() returns setof public.models
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_admin_permission('models.view');
  return query select * from public.models order by position;
end;
$$;

create or replace function public.admin_plans() returns setof public.subscription_plans
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_admin_permission('plans.view');
  return query select * from public.subscription_plans order by position;
end;
$$;

-- ---------------------------------------------------- administradores

create function public.admin_list_admins() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_admin_permission('admins.manage');
  return coalesce((
    select jsonb_agg(row_to_json(r) order by r.created_at)
    from (
      select a.user_id, u.email::text as email, p.display_name, a.role, a.created_at, a.updated_at, g.email::text as granted_by_email
      from public.admin_users a
      join auth.users u on u.id = a.user_id
      left join public.profiles p on p.id = a.user_id
      left join auth.users g on g.id = a.granted_by
    ) r
  ), '[]'::jsonb);
end;
$$;

-- Dá ou troca o papel de alguém pelo e-mail da conta. Ninguém mexe no próprio
-- papel (nem para subir, nem para se trancar fora) e sempre sobra um super_admin.
create function public.admin_set_role(p_email text, p_role public.admin_role, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  admin_id uuid := public.assert_admin_permission('admins.manage');
  target uuid;
  before public.admin_users;
begin
  if char_length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'reason_required'; end if;
  select id into target from auth.users where lower(email) = lower(trim(coalesce(p_email, '')));
  if not found then raise exception 'user_not_found'; end if;
  if target = admin_id then raise exception 'cannot_change_self'; end if;

  -- Serializa mudanças de papel para a contagem de super_admin não correr.
  lock table public.admin_users in share row exclusive mode;
  select * into before from public.admin_users where user_id = target;

  if before.role = 'super_admin' and p_role <> 'super_admin'
     and (select count(*) from public.admin_users where role = 'super_admin') <= 1 then
    raise exception 'last_super_admin';
  end if;

  insert into public.admin_users (user_id, role, granted_by)
  values (target, p_role, admin_id)
  on conflict (user_id) do update set role = excluded.role, granted_by = excluded.granted_by, updated_at = now();

  perform public.admin_log(admin_id, case when before.user_id is null then 'admin.grant' else 'admin.role_change' end,
    target, p_role::text, jsonb_build_object('before', before.role, 'after', p_role), trim(p_reason));
  return jsonb_build_object('user_id', target, 'role', p_role);
end;
$$;

create function public.admin_remove_admin(p_user_id uuid, p_reason text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  admin_id uuid := public.assert_admin_permission('admins.manage');
  before public.admin_users;
begin
  if char_length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'reason_required'; end if;
  if p_user_id = admin_id then raise exception 'cannot_change_self'; end if;

  lock table public.admin_users in share row exclusive mode;
  select * into before from public.admin_users where user_id = p_user_id;
  if not found then raise exception 'user_not_found'; end if;
  if before.role = 'super_admin' and (select count(*) from public.admin_users where role = 'super_admin') <= 1 then
    raise exception 'last_super_admin';
  end if;

  delete from public.admin_users where user_id = p_user_id;
  perform public.admin_log(admin_id, 'admin.revoke', p_user_id, before.role::text,
    jsonb_build_object('before', before.role), trim(p_reason));
  return true;
end;
$$;

-- ------------------------------------------------------------ dashboard

-- Taxa média do gateway sobre o recebido. Estimativa até a conciliação com o extrato do Asaas.
alter table public.pricing_settings
  add column payment_fee_rate numeric(5, 4) not null default 0.035 check (payment_fee_rate between 0 and 0.2);

create index subscription_payments_paid on public.subscription_payments (paid_at);
create index purchases_paid on public.purchases (paid_at) where status = 'paid';
create index generations_created on public.generations (created_at);
create index credit_reservations_settled on public.credit_reservations (settled_at) where status = 'captured';
create index subscriptions_canceled on public.subscriptions (canceled_at) where canceled_at is not null;
create index profiles_created on public.profiles (created_at);

-- Assinatura "viva" num instante: já pagou ao menos uma vez e não tinha sido
-- cancelada nem encerrada até ali. Base do churn.
create function public.subscriptions_live_at(p_at timestamptz) returns bigint
language sql stable security definer set search_path = public as $$
  select count(*) from public.subscriptions s
  where coalesce(s.canceled_at, 'infinity') > p_at
    and coalesce(s.ended_at, 'infinity') > p_at
    and exists (select 1 from public.subscription_payments p where p.subscription_id = s.id and p.paid_at <= p_at);
$$;

-- Números do período [p_from, p_to), dias no fuso de Brasília. Fotografias de
-- agora (total, ativos, pagantes, MRR) não dependem do período. Bloco financeiro,
-- custo de API e maiores consumidores só voltam para quem tem a permissão.
create function public.admin_dashboard(p_from timestamptz, p_to timestamptz) returns jsonb
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
  gens as (
    select g.*, m.name as model_name, m.provider from public.generations g join public.models m on m.slug = g.model_slug
    where g.created_at >= p_from and g.created_at < p_to
  ),
  live as (
    select s.* from public.subscriptions s
    where (s.status in ('active', 'past_due') and s.current_period_end + interval '3 days' > now())
       or (s.status = 'canceled' and s.current_period_end > now())
  ),
  received as (
    select s.plan_slug, p.amount_cents as cents, p.paid_at as at, 'subscription' as source
    from public.subscription_payments p join public.subscriptions s on s.id = p.subscription_id
    where p.status = 'confirmed'
    union all
    select null, price_cents, paid_at, 'pack' from public.purchases where status = 'paid'
  ),
  days as (
    select d::date as day
    from generate_series((p_from at time zone tz)::date, ((p_to - interval '1 microsecond') at time zone tz)::date, interval '1 day') d
  )
  select jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'users', jsonb_build_object(
      'total', (select count(*) from auth.users),
      'new_in_period', (select count(*) from public.profiles where created_at >= p_from and created_at < p_to),
      'new_previous', (select count(*) from public.profiles where created_at >= prev_from and created_at < p_from),
      'new_today', (select count(*) from public.profiles where created_at >= today_start),
      'new_7d', (select count(*) from public.profiles where created_at >= now() - interval '7 days'),
      'new_30d', (select count(*) from public.profiles where created_at >= now() - interval '30 days'),
      'active_1d', (select count(distinct user_id) from public.generations where created_at >= now() - interval '1 day'),
      'active_30d', (select count(distinct user_id) from public.generations where created_at >= now() - interval '30 days'),
      'active_in_period', (select count(distinct user_id) from gens),
      'paying', (select count(distinct user_id) from live),
      'onboarded_in_period', (select count(*) from public.user_preferences up join public.profiles p on p.id = up.user_id
        where p.created_at >= p_from and p.created_at < p_to and up.onboarded_at is not null),
      'first_generation_in_period', (select count(*) from public.profiles p
        where p.created_at >= p_from and p.created_at < p_to
          and exists (select 1 from public.generations g where g.user_id = p.id)),
      'converted_in_period', (select count(*) from public.profiles p
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
      'today', (select count(*) from public.generations where created_at >= today_start),
      'month', (select count(*) from public.generations where created_at >= date_trunc('month', now() at time zone tz) at time zone tz),
      'credits_consumed', (select coalesce(sum(amount), 0) from public.credit_reservations
        where status = 'captured' and settled_at >= p_from and settled_at < p_to),
      'previous_total', (select count(*) from public.generations where created_at >= prev_from and created_at < p_from),
      'previous_failed', (select count(*) from public.generations where status = 'failed' and created_at >= prev_from and created_at < p_from)
    ),
    'plan_distribution', coalesce((
      select jsonb_agg(row_to_json(r) order by r.position)
      from (
        select p.slug, p.name, p.position,
          case when p.slug = 'gratis'
            then (select count(*) from auth.users) - (select count(distinct user_id) from live)
            else (select count(distinct l.user_id) from live l where l.plan_slug = p.slug)
          end as users
        from public.subscription_plans p
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
          (select count(*) from public.profiles p where (p.created_at at time zone tz)::date = d.day
             and p.created_at >= p_from and p.created_at < p_to) as signups,
          (select count(*) from gens g where (g.created_at at time zone tz)::date = d.day and g.status = 'succeeded') as succeeded,
          (select count(*) from gens g where (g.created_at at time zone tz)::date = d.day and g.status = 'failed') as failed,
          (select coalesce(sum(amount), 0) from public.credit_reservations cr where cr.status = 'captured'
             and cr.settled_at >= p_from and cr.settled_at < p_to and (cr.settled_at at time zone tz)::date = d.day) as credits,
          (select count(*) from public.subscriptions s where s.status <> 'pending'
             and s.created_at >= p_from and s.created_at < p_to and (s.created_at at time zone tz)::date = d.day) as new_subscriptions,
          (select count(*) from public.subscriptions s where s.canceled_at >= p_from and s.canceled_at < p_to
             and (s.canceled_at at time zone tz)::date = d.day) as cancellations,
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
        from public.credit_reservations cr join auth.users u on u.id = cr.user_id
        where cr.status = 'captured' and cr.settled_at >= p_from and cr.settled_at < p_to
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
      'refunds_cents', (select coalesce(sum(amount_cents), 0) from public.subscription_payments
        where status = 'refunded' and paid_at >= p_from and paid_at < p_to)
        + (select coalesce(sum(price_cents), 0) from public.purchases where status = 'refunded' and created_at >= p_from and created_at < p_to),
      'new_subscriptions', (select count(*) from public.subscriptions where status <> 'pending' and created_at >= p_from and created_at < p_to),
      'cancellations', (select count(*) from public.subscriptions where canceled_at >= p_from and canceled_at < p_to),
      'cancellations_previous', (select count(*) from public.subscriptions where canceled_at >= prev_from and canceled_at < p_from),
      'churn_base', public.subscriptions_live_at(p_from),
      'churn_lost', (select count(*) from public.subscriptions s
        where exists (select 1 from public.subscription_payments p where p.subscription_id = s.id and p.paid_at < p_to)
          and ((s.canceled_at >= p_from and s.canceled_at < p_to)
            or (s.canceled_at is null and s.ended_at >= p_from and s.ended_at < p_to
                and not exists (select 1 from public.subscriptions n where n.user_id = s.user_id and n.id <> s.id
                  and n.created_at >= s.created_at and n.status <> 'pending')))),
      'api_cost_usd', (select coalesce(sum(provider_cost_usd), 0) from gens where status = 'succeeded'),
      'api_cost_previous_usd', (select coalesce(sum(provider_cost_usd), 0) from public.generations
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
          from public.subscription_plans p where p.public
        ) r
      ), '[]'::jsonb)
    ) end
  ) into result;
  return result;
end;
$$;

-- ----------------------------------------------------------- permissões

-- A policy da auditoria chama esta função com o papel de quem lê.
grant execute on function public.has_admin_permission(text) to authenticated;
grant execute on function public.admin_me() to authenticated;
grant execute on function public.admin_pricing() to authenticated;
grant execute on function public.admin_dashboard(timestamptz, timestamptz) to authenticated;
grant execute on function public.admin_list_admins() to authenticated;
grant execute on function public.admin_set_role(text, public.admin_role, text) to authenticated;
grant execute on function public.admin_remove_admin(uuid, text) to authenticated;
