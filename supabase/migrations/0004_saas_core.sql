-- Kria: núcleo do SaaS (fase 1).
--
-- Carteira em dois baldes. `subscription_balance` vem do plano e renova a
-- cada ciclo pago (o que sobrou expira na renovação). `purchased_balance`
-- vem de pacote avulso, boas-vindas e ajuste, e não expira. `balance` é a
-- soma, mantida pelas funções e conferida por check, para o app e o
-- realtime continuarem lendo uma coluna só.
--
-- Geração reserva crédito: o débito nasce com a geração (gasta primeiro o
-- balde do plano) e fica preso em `credit_reservations`. Concluiu, a reserva
-- é capturada; falhou, volta para os mesmos baldes de onde saiu.
--
-- O extrato é imutável (trigger) e cada linha guarda quanto saiu de cada
-- balde, o saldo depois do movimento e, quando existe, uma chave idempotente.
--
-- Admin: quem está em `admin_users`. Toda ação de admin é uma função que
-- confere `is_admin()` no banco e grava em `admin_audit_logs`.

-- ------------------------------------------------------ preço do crédito

-- Uma linha só. Converte o custo do fornecedor (US$) em créditos:
-- custo × câmbio × (1 + folga do câmbio) × markup ÷ valor do crédito.
create table public.pricing_settings (
  id boolean primary key default true check (id),
  usd_brl numeric(8, 4) not null default 5.60 check (usd_brl > 0),
  fx_buffer numeric(5, 4) not null default 0.10 check (fx_buffer between 0 and 1),
  markup numeric(6, 3) not null default 2.5 check (markup >= 1),
  -- O crédito mais barato vendido (plano Studio: R$ 149,90 / 1.500). Calcular
  -- a margem pelo crédito mais barato garante que nenhum plano dá prejuízo.
  credit_value_brl numeric(8, 4) not null default 0.10 check (credit_value_brl > 0),
  updated_at timestamptz not null default now()
);

insert into public.pricing_settings default values;

-- --------------------------------------------------------------- planos

create table public.subscription_plans (
  slug text primary key check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (char_length(name) between 1 and 30),
  description text not null default '' check (char_length(description) <= 160),
  price_cents integer not null check (price_cents >= 0),
  monthly_credits integer not null check (monthly_credits >= 0),
  max_concurrent integer not null default 3 check (max_concurrent between 1 and 20),
  features text[] not null default '{}',
  -- `public = false` é o plano grátis implícito de quem não assina: não se compra.
  public boolean not null default true,
  highlight boolean not null default false,
  active boolean not null default true,
  position integer not null default 0,
  -- Sobe quando preço ou créditos mudam; assinatura guarda o que contratou.
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  check (not public or price_cents >= 500)
);

insert into public.subscription_plans (slug, name, description, price_cents, monthly_credits, max_concurrent, features, public, highlight, position) values
  ('gratis', 'Grátis', 'Créditos avulsos, sem mensalidade.', 0, 0, 2,
   array['Créditos de boas-vindas', 'Pacotes avulsos com Pix'], false, false, 0),
  ('starter', 'Starter', 'Para começar a publicar toda semana.', 5990, 300, 3,
   array['300 créditos por mês', '3 gerações ao mesmo tempo', 'Todos os modelos liberados no plano'], true, false, 10),
  ('pro', 'Pro', 'Para quem publica todo dia.', 7990, 700, 4,
   array['700 créditos por mês', '4 gerações ao mesmo tempo', 'Modelos premium de vídeo'], true, true, 20),
  ('studio', 'Studio', 'Para operação de conteúdo e anúncios.', 14990, 1500, 6,
   array['1.500 créditos por mês', '6 gerações ao mesmo tempo', 'Modelos premium de vídeo'], true, false, 30);

-- ------------------------------------------------- catálogo de modelos

-- `credits` continua sendo o preço cobrado. `provider_cost_usd` é o custo real
-- conferido no fornecedor (nulo = ainda não conferido) e alimenta o preço
-- sugerido e a margem no admin. `allowed_plans` nulo libera para todos.
alter table public.models
  add column provider text not null default 'fal' check (provider ~ '^[a-z0-9-]{2,30}$'),
  add column provider_cost_usd numeric(10, 4) check (provider_cost_usd >= 0),
  add column allowed_plans text[],
  add column updated_at timestamptz not null default now();

-- O custo do fornecedor é dado interno: o cliente lê só o que o app mostra.
revoke select on public.models from anon, authenticated;
grant select (slug, name, description, kind, image_input, requires_image, credits, defaults, badge, active, position, allowed_plans)
  on public.models to anon, authenticated;

-- ------------------------------------------------------------- carteira

alter table public.credit_balances
  add column purchased_balance integer not null default 0 check (purchased_balance >= 0),
  add column subscription_balance integer not null default 0 check (subscription_balance >= 0);

-- Tudo o que existia até aqui é boas-vindas ou compra: não expira.
update public.credit_balances set purchased_balance = balance;

alter table public.credit_balances
  add constraint credit_balances_sum check (balance = purchased_balance + subscription_balance);

-- --------------------------------------------------------------- extrato

alter table public.credit_ledger
  add column subscription_delta integer not null default 0,
  add column purchased_delta integer not null default 0,
  add column balance_after integer,
  add column subscription_id uuid,
  add column payment_id text,
  add column actor_id uuid,
  add column idempotency_key text check (char_length(idempotency_key) <= 120);

update public.credit_ledger set purchased_delta = delta;

alter table public.credit_ledger
  add constraint credit_ledger_split check (delta = subscription_delta + purchased_delta);

create unique index credit_ledger_idempotency on public.credit_ledger (idempotency_key) where idempotency_key is not null;

-- Extrato não se edita. Apagar só acontece em cascata quando a conta é excluída.
create function public.credit_ledger_immutable() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' then raise exception 'ledger_is_immutable'; end if;
  if exists (select 1 from auth.users where id = old.user_id) then raise exception 'ledger_is_immutable'; end if;
  return old;
end;
$$;

create trigger credit_ledger_no_update before update on public.credit_ledger
  for each row execute function public.credit_ledger_immutable();
create trigger credit_ledger_no_delete before delete on public.credit_ledger
  for each row execute function public.credit_ledger_immutable();

-- -------------------------------------------------------------- perfis

alter table public.profiles
  add column suspended_at timestamptz,
  add column suspended_reason text check (char_length(suspended_reason) <= 300);

-- --------------------------------------------------------------- gerações

alter table public.generations
  add column idempotency_key text check (char_length(idempotency_key) between 8 and 80),
  add column provider_cost_usd numeric(10, 4);

create unique index generations_idempotency on public.generations (user_id, idempotency_key) where idempotency_key is not null;

create type public.reservation_status as enum ('held', 'captured', 'released');

create table public.credit_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  generation_id uuid not null unique references public.generations (id) on delete cascade,
  amount integer not null check (amount > 0),
  subscription_amount integer not null check (subscription_amount >= 0),
  purchased_amount integer not null check (purchased_amount >= 0),
  status public.reservation_status not null default 'held',
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  check (amount = subscription_amount + purchased_amount)
);

create index credit_reservations_held on public.credit_reservations (user_id) where status = 'held';

-- Gerações abertas antes desta migration já tinham debitado: viram reservas do balde comprado.
insert into public.credit_reservations (user_id, generation_id, amount, subscription_amount, purchased_amount, status, settled_at)
select user_id, id, credits, 0, credits,
  (case status when 'succeeded' then 'captured' when 'failed' then 'released' else 'held' end)::public.reservation_status,
  completed_at
from public.generations;

-- ----------------------------------------------------------- assinaturas

create type public.subscription_status as enum ('pending', 'active', 'past_due', 'canceled', 'expired');

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_slug text not null references public.subscription_plans (slug),
  plan_version integer not null default 1,
  status public.subscription_status not null default 'pending',
  price_cents integer not null check (price_cents > 0),
  monthly_credits integer not null check (monthly_credits >= 0),
  provider_checkout_id text unique,
  checkout_url text,
  provider_subscription_id text unique,
  provider_customer_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  canceled_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_user_recent on public.subscriptions (user_id, created_at desc);
create unique index subscriptions_one_live on public.subscriptions (user_id) where status in ('active', 'past_due');

create table public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  provider_payment_id text not null unique,
  amount_cents integer not null check (amount_cents >= 0),
  status text not null default 'confirmed' check (status in ('confirmed', 'refunded')),
  due_date date,
  invoice_url text check (invoice_url ~ '^https://'),
  paid_at timestamptz not null default now()
);

create index subscription_payments_user_recent on public.subscription_payments (user_id, paid_at desc);

-- ------------------------------------------------------- preferências

create table public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  goal text check (goal in ('influencers', 'viral_videos', 'ugc_ads', 'images', 'social_content', 'all_tools')),
  onboarded_at timestamptz,
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------- admin

create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.admin_audit_logs (
  id bigint generated always as identity primary key,
  admin_id uuid references auth.users (id) on delete set null,
  action text not null check (char_length(action) <= 60),
  target_user_id uuid,
  target text check (char_length(target) <= 120),
  details jsonb not null default '{}'::jsonb,
  reason text check (char_length(reason) <= 300),
  created_at timestamptz not null default now()
);

create index admin_audit_logs_recent on public.admin_audit_logs (created_at desc);

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

create function public.assert_admin() returns uuid
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return auth.uid();
end;
$$;

-- ------------------------------------------------------------------ RLS

alter table public.pricing_settings enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.credit_reservations enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_payments enable row level security;
alter table public.user_preferences enable row level security;
alter table public.admin_users enable row level security;
alter table public.admin_audit_logs enable row level security;

revoke all on public.pricing_settings, public.subscription_plans, public.credit_reservations, public.subscriptions,
  public.subscription_payments, public.user_preferences, public.admin_users, public.admin_audit_logs
  from anon, authenticated;

grant select on public.subscription_plans to anon, authenticated;
grant select on public.credit_reservations, public.subscriptions, public.subscription_payments,
  public.user_preferences, public.admin_audit_logs to authenticated;
grant insert (user_id, goal, onboarded_at), update (goal, onboarded_at, updated_at) on public.user_preferences to authenticated;

create policy "active plans" on public.subscription_plans for select to anon, authenticated using (active);
create policy "own reservations" on public.credit_reservations for select to authenticated using (user_id = auth.uid());
create policy "own subscriptions" on public.subscriptions for select to authenticated using (user_id = auth.uid());
create policy "own subscription payments" on public.subscription_payments for select to authenticated using (user_id = auth.uid());
create policy "own preferences" on public.user_preferences for select to authenticated using (user_id = auth.uid());
create policy "own preferences insert" on public.user_preferences for insert to authenticated with check (user_id = auth.uid());
create policy "own preferences update" on public.user_preferences for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "admins read audit" on public.admin_audit_logs for select to authenticated using (public.is_admin());

-- ------------------------------------------------- movimento da carteira

-- Único lugar que mexe no saldo: muda os baldes e escreve o extrato juntos.
-- O check >= 0 de cada balde segura qualquer tentativa de ficar negativo.
create function public.wallet_move(
  p_user_id uuid,
  p_subscription_delta integer,
  p_purchased_delta integer,
  p_reason public.ledger_reason,
  p_note text,
  p_generation_id uuid default null,
  p_purchase_id uuid default null,
  p_subscription_id uuid default null,
  p_payment_id text default null,
  p_actor_id uuid default null,
  p_idempotency_key text default null
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  new_balance integer;
begin
  if p_subscription_delta = 0 and p_purchased_delta = 0 then
    select balance into new_balance from public.credit_balances where user_id = p_user_id;
    return new_balance;
  end if;

  update public.credit_balances
  set subscription_balance = subscription_balance + p_subscription_delta,
      purchased_balance = purchased_balance + p_purchased_delta,
      balance = balance + p_subscription_delta + p_purchased_delta,
      updated_at = now()
  where user_id = p_user_id
  returning balance into new_balance;
  if not found then raise exception 'account_not_found'; end if;

  insert into public.credit_ledger (
    user_id, delta, subscription_delta, purchased_delta, balance_after, reason, note,
    generation_id, purchase_id, subscription_id, payment_id, actor_id, idempotency_key
  ) values (
    p_user_id, p_subscription_delta + p_purchased_delta, p_subscription_delta, p_purchased_delta, new_balance, p_reason,
    left(p_note, 300), p_generation_id, p_purchase_id, p_subscription_id, p_payment_id, p_actor_id, p_idempotency_key
  );
  return new_balance;
end;
$$;

-- ------------------------------------------------ plano em vigor

-- Plano que vale agora: assinatura ativa, em atraso (dentro da carência) ou
-- cancelada mas ainda no período pago. Sem nada disso, o grátis.
create function public.effective_plan(p_user_id uuid) returns public.subscription_plans
language sql stable security definer set search_path = public as $$
  select coalesce(
    (
      select p from public.subscriptions s
      join public.subscription_plans p on p.slug = s.plan_slug
      where s.user_id = p_user_id
        and (
          (s.status in ('active', 'past_due') and s.current_period_end + interval '3 days' > now())
          or (s.status = 'canceled' and s.current_period_end > now())
        )
      order by s.current_period_end desc
      limit 1
    ),
    (select p from public.subscription_plans p where slug = 'gratis')
  );
$$;

-- Fecha a assinatura que passou do prazo e zera o balde do plano. Chamada
-- antes de gastar crédito (preguiçosa) e pelo cron diário.
create function public.expire_lapsed_subscriptions(p_user_id uuid default null) returns integer
language plpgsql security definer set search_path = public as $$
declare
  s public.subscriptions;
  leftover integer;
  closed integer := 0;
begin
  for s in
    select * from public.subscriptions
    where (p_user_id is null or user_id = p_user_id)
      and (
        (status in ('active', 'past_due') and current_period_end + interval '3 days' <= now())
        or (status = 'canceled' and current_period_end <= now())
      )
    for update
  loop
    update public.subscriptions set status = 'expired', ended_at = now(), updated_at = now() where id = s.id;
    -- Outra assinatura do mesmo dono ainda valendo segura o balde.
    if (public.effective_plan(s.user_id)).slug = 'gratis' then
      select subscription_balance into leftover from public.credit_balances where user_id = s.user_id for update;
      if coalesce(leftover, 0) > 0 then
        perform public.wallet_move(s.user_id, -leftover, 0, 'subscription_expire', 'Fim do período do plano',
          p_subscription_id => s.id);
      end if;
    end if;
    closed := closed + 1;
  end loop;
  return closed;
end;
$$;

-- ------------------------------------------------- geração: criar

drop function public.create_generation(uuid, text, text, uuid, uuid);

-- Valida, reserva e cria a geração numa transação só. A mesma chave
-- idempotente levanta `duplicate_request`: quem chamou busca a geração que
-- já existe e não manda de novo ao fornecedor nem cobra outra vez.
create function public.create_generation(
  p_user_id uuid,
  p_model_slug text,
  p_prompt text,
  p_persona_id uuid default null,
  p_source_generation_id uuid default null,
  p_idempotency_key text default null
) returns public.generations
language plpgsql security definer set search_path = public as $$
declare
  m public.models;
  g public.generations;
  plan public.subscription_plans;
  wallet public.credit_balances;
  running integer;
  from_subscription integer;
begin
  perform public.expire_lapsed_subscriptions(p_user_id);

  -- A trava da carteira serializa as gerações da mesma pessoa.
  select * into wallet from public.credit_balances where user_id = p_user_id for update;
  if not found then raise exception 'account_not_found'; end if;

  if p_idempotency_key is not null and exists (
    select 1 from public.generations where user_id = p_user_id and idempotency_key = p_idempotency_key
  ) then
    raise exception 'duplicate_request';
  end if;

  if exists (select 1 from public.profiles where id = p_user_id and suspended_at is not null) then
    raise exception 'account_suspended';
  end if;

  select * into m from public.models where slug = p_model_slug and active;
  if not found then raise exception 'model_unavailable'; end if;

  if char_length(coalesce(trim(p_prompt), '')) not between 3 and 2000 then
    raise exception 'invalid_prompt';
  end if;

  if p_persona_id is not null and p_source_generation_id is not null then
    raise exception 'one_image_only';
  end if;

  if m.requires_image and p_persona_id is null and p_source_generation_id is null then
    raise exception 'image_required';
  end if;

  if not m.requires_image and (p_persona_id is not null or p_source_generation_id is not null) then
    raise exception 'model_takes_no_image';
  end if;

  if p_persona_id is not null and not exists (
    select 1 from public.personas where id = p_persona_id and user_id = p_user_id
  ) then
    raise exception 'persona_not_found';
  end if;

  if p_source_generation_id is not null and not exists (
    select 1 from public.generations
    where id = p_source_generation_id and user_id = p_user_id
      and status = 'succeeded' and kind = 'image' and output_path is not null
  ) then
    raise exception 'source_not_found';
  end if;

  plan := public.effective_plan(p_user_id);
  if m.allowed_plans is not null and not (plan.slug = any (m.allowed_plans)) then
    raise exception 'plan_required';
  end if;

  select count(*) into running from public.generations
  where user_id = p_user_id and status in ('queued', 'running');
  if running >= plan.max_concurrent then raise exception 'too_many_running'; end if;

  if wallet.balance < m.credits then raise exception 'insufficient_credits'; end if;

  insert into public.generations (
    user_id, model_slug, kind, prompt, persona_id, source_generation_id, credits, idempotency_key, provider_cost_usd
  ) values (
    p_user_id, m.slug, m.kind, trim(p_prompt), p_persona_id, p_source_generation_id, m.credits, p_idempotency_key, m.provider_cost_usd
  ) returning * into g;

  from_subscription := least(wallet.subscription_balance, m.credits);
  insert into public.credit_reservations (user_id, generation_id, amount, subscription_amount, purchased_amount)
  values (p_user_id, g.id, m.credits, from_subscription, m.credits - from_subscription);

  perform public.wallet_move(p_user_id, -from_subscription, -(m.credits - from_subscription), 'generation', m.name,
    p_generation_id => g.id);
  return g;
end;
$$;

-- --------------------------------------------- geração: concluir/falhar

create or replace function public.complete_generation(p_id uuid, p_output_path text, p_output_type text)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update public.generations
  set status = 'succeeded', output_path = p_output_path, output_type = p_output_type,
      completed_at = now(), updated_at = now()
  where id = p_id and status in ('queued', 'running');
  if not found then return false; end if;

  update public.credit_reservations set status = 'captured', settled_at = now()
  where generation_id = p_id and status = 'held';
  return true;
end;
$$;

-- Marca como falha e devolve a reserva aos baldes de onde saiu. Só age em
-- geração aberta, então webhook e polling juntos estornam uma vez.
create or replace function public.fail_generation(p_id uuid, p_error text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  g public.generations;
  r public.credit_reservations;
begin
  update public.generations
  set status = 'failed', error = left(coalesce(p_error, 'Falha na geração'), 500),
      completed_at = now(), updated_at = now()
  where id = p_id and status in ('queued', 'running')
  returning * into g;
  if not found then return false; end if;

  update public.credit_reservations set status = 'released', settled_at = now()
  where generation_id = p_id and status = 'held'
  returning * into r;
  if not found then return true; end if;

  perform public.wallet_move(g.user_id, r.subscription_amount, r.purchased_amount, 'generation_refund',
    'Estorno de geração que falhou', p_generation_id => g.id);
  return true;
end;
$$;

-- ---------------------------------------------------- compra: creditar

create or replace function public.grant_purchase(p_purchase_id uuid, p_payment_id text default null)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  p public.purchases;
begin
  update public.purchases
  set status = 'paid', paid_at = now(), provider_payment_id = coalesce(p_payment_id, provider_payment_id)
  where id = p_purchase_id and status in ('pending', 'expired')
  returning * into p;
  if not found then return false; end if;

  perform public.wallet_move(p.user_id, 0, p.credits, 'purchase', 'Compra de créditos', p_purchase_id => p.id);
  return true;
end;
$$;

-- -------------------------------------------- assinatura: ciclo pago

-- Chamada pelo webhook do Asaas quando uma cobrança da assinatura é paga.
-- Idempotente pelo id do pagamento. Abre o período, troca o que sobrou do
-- balde do plano pelos créditos do mês e encerra qualquer outra assinatura
-- viva da pessoa (troca de plano). Devolve as assinaturas do Asaas que o
-- webhook precisa cancelar lá.
create function public.activate_subscription_period(
  p_subscription_id uuid,
  p_payment_id text,
  p_amount_cents integer,
  p_due_date date default null,
  p_invoice_url text default null,
  p_provider_subscription_id text default null,
  p_provider_customer_id text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s public.subscriptions;
  period_start timestamptz;
  period_end timestamptz;
  leftover integer;
  replaced text[];
begin
  select * into s from public.subscriptions where id = p_subscription_id for update;
  if not found then raise exception 'subscription_not_found'; end if;

  if exists (select 1 from public.subscription_payments where provider_payment_id = p_payment_id) then
    return jsonb_build_object('outcome', 'already_applied', 'replaced', '[]'::jsonb);
  end if;

  if s.status = 'expired' and s.ended_at is not null and s.current_period_end is not null then
    -- Pagamento atrasado de assinatura já encerrada: registra e deixa para revisão.
    insert into public.subscription_payments (subscription_id, user_id, provider_payment_id, amount_cents, due_date, invoice_url)
    values (s.id, s.user_id, p_payment_id, p_amount_cents, p_due_date, p_invoice_url);
    return jsonb_build_object('outcome', 'expired_review', 'replaced', '[]'::jsonb);
  end if;

  period_start := coalesce(p_due_date::timestamp at time zone 'America/Sao_Paulo', now());
  if s.current_period_end is not null and s.current_period_end > period_start then
    period_start := s.current_period_end;
  end if;
  period_end := period_start + interval '1 month';

  -- Troca de plano: as outras assinaturas vivas acabam aqui.
  with closed as (
    update public.subscriptions
    set status = 'expired', ended_at = now(), updated_at = now()
    where user_id = s.user_id and id <> s.id and status in ('pending', 'active', 'past_due', 'canceled')
    returning provider_subscription_id, status
  )
  select coalesce(array_agg(provider_subscription_id) filter (where provider_subscription_id is not null), '{}')
  into replaced from closed;

  update public.subscriptions
  set status = 'active',
      provider_subscription_id = coalesce(p_provider_subscription_id, provider_subscription_id),
      provider_customer_id = coalesce(p_provider_customer_id, provider_customer_id),
      current_period_start = period_start,
      current_period_end = period_end,
      canceled_at = case when status = 'canceled' then canceled_at else null end,
      updated_at = now()
  where id = s.id;

  insert into public.subscription_payments (subscription_id, user_id, provider_payment_id, amount_cents, due_date, invoice_url)
  values (s.id, s.user_id, p_payment_id, p_amount_cents, p_due_date, p_invoice_url);

  select subscription_balance into leftover from public.credit_balances where user_id = s.user_id for update;
  if coalesce(leftover, 0) > 0 then
    perform public.wallet_move(s.user_id, -leftover, 0, 'subscription_expire', 'Créditos do ciclo anterior',
      p_subscription_id => s.id, p_payment_id => p_payment_id, p_idempotency_key => 'subexp:' || p_payment_id);
  end if;
  if s.monthly_credits > 0 then
    perform public.wallet_move(s.user_id, s.monthly_credits, 0, 'subscription_grant', 'Créditos do plano',
      p_subscription_id => s.id, p_payment_id => p_payment_id, p_idempotency_key => 'subpay:' || p_payment_id);
  end if;

  return jsonb_build_object('outcome', 'activated', 'replaced', to_jsonb(replaced));
end;
$$;

-- Atraso, cancelamento e fim vindos do Asaas ou do botão "cancelar".
create function public.set_subscription_status(p_subscription_id uuid, p_status public.subscription_status)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  s public.subscriptions;
begin
  select * into s from public.subscriptions where id = p_subscription_id for update;
  if not found then return false; end if;

  if p_status = 'past_due' and s.status <> 'active' then return false; end if;
  if p_status = 'canceled' and s.status not in ('active', 'past_due') then return false; end if;
  if p_status = 'expired' and s.status = 'expired' then return false; end if;
  if p_status in ('pending', 'active') then raise exception 'invalid_transition'; end if;

  update public.subscriptions
  set status = p_status,
      canceled_at = case when p_status = 'canceled' then now() else canceled_at end,
      ended_at = case when p_status = 'expired' then now() else ended_at end,
      updated_at = now()
  where id = s.id;

  -- Assinatura que nunca pagou (checkout expirado) não tem balde para zerar.
  if p_status = 'expired' and s.current_period_end is not null then
    perform public.expire_lapsed_subscriptions(s.user_id);
  end if;
  return true;
end;
$$;

-- ------------------------------------------------------- conta nova

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  signup_bonus constant integer := 20;
begin
  insert into public.profiles (id, display_name, username)
  values (new.id, left(nullif(new.raw_user_meta_data ->> 'display_name', ''), 80), public.unique_username(new.email));

  insert into public.credit_balances (user_id, balance, purchased_balance) values (new.id, 0, 0);
  perform public.wallet_move(new.id, 0, signup_bonus, 'signup_bonus', 'Créditos de boas-vindas');
  insert into public.user_preferences (user_id) values (new.id);
  return new;
end;
$$;

insert into public.user_preferences (user_id, onboarded_at)
select id, now() from auth.users
on conflict (user_id) do nothing;

-- ------------------------------------------------------- funções admin

create function public.admin_log(p_admin uuid, p_action text, p_target_user uuid, p_target text, p_details jsonb, p_reason text)
returns void
language sql security definer set search_path = public as $$
  insert into public.admin_audit_logs (admin_id, action, target_user_id, target, details, reason)
  values (p_admin, p_action, p_target_user, p_target, coalesce(p_details, '{}'::jsonb), p_reason);
$$;

create function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  since constant timestamptz := now() - interval '30 days';
  result jsonb;
begin
  perform public.assert_admin();

  select jsonb_build_object(
    'total_users', (select count(*) from auth.users),
    'new_users_30d', (select count(*) from public.profiles where created_at >= since),
    'active_subscribers', (select count(*) from public.subscriptions where status in ('active', 'past_due')),
    'past_due', (select count(*) from public.subscriptions where status = 'past_due'),
    'mrr_cents', (select coalesce(sum(price_cents), 0) from public.subscriptions where status in ('active', 'past_due')),
    'new_subscriptions_30d', (select count(*) from public.subscriptions where status <> 'pending' and created_at >= since),
    'cancellations_30d', (select count(*) from public.subscriptions where canceled_at >= since),
    'subscription_revenue_30d_cents', (select coalesce(sum(amount_cents), 0) from public.subscription_payments where status = 'confirmed' and paid_at >= since),
    'pack_revenue_30d_cents', (select coalesce(sum(price_cents), 0) from public.purchases where status = 'paid' and paid_at >= since),
    'generations_30d', (select count(*) from public.generations where created_at >= since),
    'generations_failed_30d', (select count(*) from public.generations where status = 'failed' and created_at >= since),
    'credits_consumed_30d', (select coalesce(sum(amount), 0) from public.credit_reservations where status = 'captured' and settled_at >= since),
    'api_cost_usd_30d', (select coalesce(sum(provider_cost_usd), 0) from public.generations where status = 'succeeded' and completed_at >= since),
    'api_cost_unknown_30d', (select count(*) from public.generations where status = 'succeeded' and completed_at >= since and provider_cost_usd is null),
    'pricing', (select to_jsonb(ps) - 'id' from public.pricing_settings ps),
    'revenue_by_plan', coalesce((
      select jsonb_agg(row_to_json(r) order by r.position)
      from (
        select p.slug, p.name, p.position, count(s.id) as subscribers, coalesce(sum(s.price_cents), 0) as mrr_cents
        from public.subscription_plans p
        left join public.subscriptions s on s.plan_slug = p.slug and s.status in ('active', 'past_due')
        where p.public
        group by p.slug, p.name, p.position
      ) r
    ), '[]'::jsonb),
    'by_model', coalesce((
      select jsonb_agg(row_to_json(r) order by r.total desc)
      from (
        select g.model_slug, m.provider, count(*) as total,
          count(*) filter (where g.status = 'failed') as failed,
          coalesce(sum(g.credits) filter (where g.status = 'succeeded'), 0) as credits,
          coalesce(sum(g.provider_cost_usd) filter (where g.status = 'succeeded'), 0) as cost_usd
        from public.generations g join public.models m on m.slug = g.model_slug
        where g.created_at >= since
        group by g.model_slug, m.provider
      ) r
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

create function public.admin_search_users(p_query text default '', p_limit integer default 30)
returns table (
  id uuid, email text, display_name text, username text, balance integer, subscription_balance integer,
  purchased_balance integer, plan_slug text, subscription_status public.subscription_status,
  suspended_at timestamptz, created_at timestamptz, generations bigint
)
language plpgsql stable security definer set search_path = public as $$
declare
  term text := '%' || lower(trim(coalesce(p_query, ''))) || '%';
begin
  perform public.assert_admin();
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

create function public.admin_user_detail(p_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_admin();
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
    'payments', coalesce((select jsonb_agg(row_to_json(x)) from (
      select 'subscription' as type, amount_cents, status, paid_at as at from public.subscription_payments where user_id = p_user_id
      union all
      select 'pack', price_cents, status::text, coalesce(paid_at, created_at) from public.purchases where user_id = p_user_id
      order by at desc limit 30) x), '[]'::jsonb)
  );
end;
$$;

-- Ajuste manual vai sempre no balde comprado (não expira) e exige motivo.
create function public.admin_adjust_credits(p_user_id uuid, p_amount integer, p_reason text) returns integer
language plpgsql security definer set search_path = public as $$
declare
  admin_id uuid := public.assert_admin();
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

create function public.admin_set_suspended(p_user_id uuid, p_suspended boolean, p_reason text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  admin_id uuid := public.assert_admin();
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

create function public.admin_update_plan(
  p_slug text, p_price_cents integer, p_monthly_credits integer, p_max_concurrent integer, p_active boolean, p_features text[]
) returns public.subscription_plans
language plpgsql security definer set search_path = public as $$
declare
  admin_id uuid := public.assert_admin();
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

create function public.admin_update_model(
  p_slug text, p_active boolean, p_credits integer, p_provider_cost_usd numeric, p_allowed_plans text[]
) returns public.models
language plpgsql security definer set search_path = public as $$
declare
  admin_id uuid := public.assert_admin();
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

create function public.admin_update_pricing(p_usd_brl numeric, p_fx_buffer numeric, p_markup numeric, p_credit_value_brl numeric)
returns public.pricing_settings
language plpgsql security definer set search_path = public as $$
declare
  admin_id uuid := public.assert_admin();
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

-- Catálogo completo para o admin (o select público mostra só os ativos).
create function public.admin_models() returns setof public.models
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_admin();
  return query select * from public.models order by position;
end;
$$;

create function public.admin_plans() returns setof public.subscription_plans
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_admin();
  return query select * from public.subscription_plans order by position;
end;
$$;

-- --------------------------------------------------------- permissões

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.create_persona(uuid, text, text) to authenticated;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_search_users(text, integer) to authenticated;
grant execute on function public.admin_user_detail(uuid) to authenticated;
grant execute on function public.admin_adjust_credits(uuid, integer, text) to authenticated;
grant execute on function public.admin_set_suspended(uuid, boolean, text) to authenticated;
grant execute on function public.admin_update_plan(text, integer, integer, integer, boolean, text[]) to authenticated;
grant execute on function public.admin_update_model(text, boolean, integer, numeric, text[]) to authenticated;
grant execute on function public.admin_update_pricing(numeric, numeric, numeric, numeric) to authenticated;
grant execute on function public.admin_models() to authenticated;
grant execute on function public.admin_plans() to authenticated;

grant execute on function public.create_generation(uuid, text, text, uuid, uuid, text) to service_role;
grant execute on function public.complete_generation(uuid, text, text) to service_role;
grant execute on function public.fail_generation(uuid, text) to service_role;
grant execute on function public.grant_purchase(uuid, text) to service_role;
grant execute on function public.activate_subscription_period(uuid, text, integer, date, text, text, text) to service_role;
grant execute on function public.set_subscription_status(uuid, public.subscription_status) to service_role;
grant execute on function public.expire_lapsed_subscriptions(uuid) to service_role;

-- Funções criadas daqui em diante não nascem executáveis pelo cliente.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ---------------------------------------------------- cron e realtime

-- Encerra assinaturas vencidas todo dia às 3h (UTC) quando o pg_cron existe.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('kria-expire-subscriptions', '0 3 * * *', 'select public.expire_lapsed_subscriptions()');
  end if;
end;
$$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.subscriptions;
  end if;
end;
$$;
