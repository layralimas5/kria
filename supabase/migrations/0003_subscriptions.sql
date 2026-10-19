-- Assinaturas mensais (Starter, Pro, Studio) pagas no cartão pelo checkout
-- recorrente do Asaas. Os pacotes avulsos de `credit_packs` continuam como
-- créditos adicionais.
--
-- Regras:
--   * Plano, preço, créditos do mês, limite de personagens, lista de
--     benefícios e tabela comparativa vivem em `subscription_plans`. Mudar
--     qualquer valor comercial é um update aqui, sem deploy.
--   * Benefício só entra pelo webhook autenticado do Asaas
--     (`grant_subscription_payment`), nunca pela volta do navegador.
--   * Cada cobrança paga credita uma vez só (índice único por payment_id).
--   * Créditos do plano não vencem: o que sobra fica na conta.
--   * Cancelar mantém o plano até o fim do período pago.

-- -------------------------------------------------------------- planos

create table public.subscription_plans (
  slug text primary key check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (char_length(name) between 1 and 40),
  tagline text not null default '' check (char_length(tagline) <= 160),
  price_cents integer not null check (price_cents >= 500),
  monthly_credits integer not null check (monthly_credits > 0),
  max_personas integer not null check (max_personas > 0),
  cta_label text not null check (char_length(cta_label) between 1 and 40),
  badge text check (char_length(badge) <= 30),
  highlight boolean not null default false,
  -- Benefícios do card: [{ "label": "...", "soon": false }]. `soon` = ainda não existe no produto.
  features jsonb not null default '[]'::jsonb check (jsonb_typeof(features) = 'array'),
  -- Linhas da tabela comparativa: { "<chave>": "texto" | "yes" | "no" | "soon" }.
  comparison jsonb not null default '{}'::jsonb check (jsonb_typeof(comparison) = 'object'),
  active boolean not null default true,
  position integer not null default 0
);

-- Conta sem assinatura (só os créditos de boas-vindas ou avulsos).
create table public.plan_settings (
  id boolean primary key default true check (id),
  free_max_personas integer not null default 1 check (free_max_personas >= 0)
);
insert into public.plan_settings (id) values (true);

-- -------------------------------------------------------- assinaturas

create type public.subscription_status as enum ('pending', 'active', 'overdue', 'canceled', 'expired');

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_slug text not null references public.subscription_plans (slug),
  status public.subscription_status not null default 'pending',
  price_cents integer not null check (price_cents > 0),
  provider_checkout_id text unique,
  provider_subscription_id text unique,
  provider_customer_id text,
  checkout_url text,
  current_period_end timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_user_recent on public.subscriptions (user_id, created_at desc);
-- Uma assinatura em andamento por pessoa (cancelada com período pago não conta).
create unique index subscriptions_one_open on public.subscriptions (user_id)
  where status in ('pending', 'active', 'overdue');

-- ------------------------------------------------- extrato: créditos do plano

alter type public.ledger_reason add value if not exists 'subscription';

alter table public.credit_ledger
  add column subscription_id uuid references public.subscriptions (id) on delete set null,
  add column payment_id text;

create unique index credit_ledger_one_payment on public.credit_ledger (payment_id) where payment_id is not null;

-- ------------------------------------------------------------------ RLS

alter table public.subscription_plans enable row level security;
alter table public.plan_settings enable row level security;
alter table public.subscriptions enable row level security;

revoke all on public.subscription_plans, public.plan_settings, public.subscriptions from anon, authenticated;
grant select on public.subscription_plans, public.plan_settings to anon, authenticated;
grant select on public.subscriptions to authenticated;

create policy "active plans" on public.subscription_plans for select to anon, authenticated using (active);
create policy "plan settings" on public.plan_settings for select to anon, authenticated using (true);
create policy "own subscriptions" on public.subscriptions for select to authenticated using (user_id = auth.uid());

-- ------------------------------------------------------ plano vigente

-- O plano que vale agora: assinatura paga (ativa ou cancelada) cujo período
-- ainda não acabou. Inadimplente perde o benefício quando o período vence.
create function public.current_plan(p_user_id uuid) returns public.subscription_plans
language sql stable security definer set search_path = public as $$
  select p.* from public.subscriptions s
  join public.subscription_plans p on p.slug = s.plan_slug
  where s.user_id = p_user_id
    and s.status in ('active', 'overdue', 'canceled')
    and s.current_period_end > now()
  order by s.current_period_end desc
  limit 1
$$;

-- ------------------------------------------- pagamento confirmado: liberar

create function public.grant_subscription_payment(
  p_subscription_id uuid,
  p_payment_id text,
  p_provider_subscription_id text,
  p_customer_id text,
  p_period_end timestamptz
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  s public.subscriptions;
  plan_credits integer;
  inserted integer;
begin
  if p_payment_id is null or char_length(p_payment_id) = 0 then raise exception 'payment_required'; end if;

  select * into s from public.subscriptions where id = p_subscription_id for update;
  if not found then raise exception 'subscription_not_found'; end if;

  update public.subscriptions
  set status = case when status = 'canceled' then 'canceled'::public.subscription_status else 'active' end,
      provider_subscription_id = coalesce(provider_subscription_id, p_provider_subscription_id),
      provider_customer_id = coalesce(p_customer_id, provider_customer_id),
      current_period_end = greatest(coalesce(current_period_end, p_period_end), p_period_end),
      updated_at = now()
  where id = s.id;

  select monthly_credits into plan_credits from public.subscription_plans where slug = s.plan_slug;

  insert into public.credit_ledger (user_id, delta, reason, subscription_id, payment_id, note)
  values (s.user_id, plan_credits, 'subscription', s.id, p_payment_id, 'Créditos do plano')
  on conflict (payment_id) where payment_id is not null do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then return false; end if;

  update public.credit_balances set balance = balance + plan_credits, updated_at = now() where user_id = s.user_id;
  return true;
end;
$$;

-- --------------------------------------- personagens: limite pelo plano

create or replace function public.create_persona(p_generation_id uuid, p_name text, p_description text default '')
returns public.personas
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  max_personas integer;
  source public.generations;
  persona public.personas;
begin
  if uid is null then raise exception 'not_authenticated'; end if;

  select * into source from public.generations
  where id = p_generation_id and user_id = uid and status = 'succeeded' and kind = 'image' and output_path is not null;
  if not found then raise exception 'source_not_found'; end if;

  select coalesce((public.current_plan(uid)).max_personas, (select free_max_personas from public.plan_settings))
  into max_personas;
  if (select count(*) from public.personas where user_id = uid) >= max_personas then
    raise exception 'too_many_personas';
  end if;

  insert into public.personas (user_id, name, description, image_path)
  values (uid, trim(p_name), coalesce(trim(p_description), ''), source.output_path)
  returning * into persona;
  return persona;
end;
$$;

revoke execute on function public.current_plan(uuid) from public, anon, authenticated;
revoke execute on function public.grant_subscription_payment(uuid, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.current_plan(uuid) to service_role;
grant execute on function public.grant_subscription_payment(uuid, text, text, text, timestamptz) to service_role;

-- --------------------------------------------------------------- seed
-- Valores comerciais iniciais (não são limites de consumo validados).
-- Benefício com "soon": true aparece como "Em breve" até existir no produto.

insert into public.subscription_plans
  (slug, name, tagline, price_cents, monthly_credits, max_personas, cta_label, badge, highlight, features, comparison, position)
values
  ('starter', 'krIA Starter', 'Seu primeiro passo na criação com IA.', 5990, 300, 2, 'Começar com Starter', null, false,
   '[
     {"label": "300 créditos por mês", "soon": false},
     {"label": "Até 2 personagens de IA salvos", "soon": false},
     {"label": "Geração de imagens com IA", "soon": false},
     {"label": "Vídeos com IA nos modelos habilitados", "soon": false},
     {"label": "Histórico de criações", "soon": false},
     {"label": "Download do que ficou pronto", "soon": false},
     {"label": "Legendas, roteiros e copys", "soon": true},
     {"label": "Biblioteca de prompts", "soon": true}
   ]',
   '{"credits": "300 por mês", "personas": "Até 2", "images": "yes", "videos": "yes", "motion_control": "no",
     "ugc": "no", "copy": "soon", "prompts": "soon", "premium_models": "no", "history": "yes",
     "priority": "no", "support": "E-mail"}',
   10),
  ('pro', 'krIA Pro', 'Crie mais, experimente mais e produza conteúdos incríveis.', 7990, 700, 5, 'Quero ser Pro', 'Mais popular', true,
   '[
     {"label": "700 créditos por mês", "soon": false},
     {"label": "Até 5 personagens salvos", "soon": false},
     {"label": "Tudo do Starter", "soon": false},
     {"label": "Vídeo com fala e som (Veo 3.1)", "soon": false},
     {"label": "Personagens como referência visual", "soon": false},
     {"label": "Motion Control", "soon": true},
     {"label": "Recursos avançados de UGC", "soon": true},
     {"label": "Templates de vídeos virais", "soon": true},
     {"label": "Anúncios e roteiros comerciais", "soon": true},
     {"label": "Biblioteca de prompts premium", "soon": true}
   ]',
   '{"credits": "700 por mês", "personas": "Até 5", "images": "yes", "videos": "yes", "motion_control": "soon",
     "ugc": "soon", "copy": "soon", "prompts": "soon", "premium_models": "no", "history": "yes",
     "priority": "no", "support": "E-mail"}',
   20),
  ('studio', 'krIA Studio', 'Para creators, marcas e profissionais que querem produzir em escala.', 14990, 1500, 15, 'Escolher Studio', null, false,
   '[
     {"label": "1.500 créditos por mês", "soon": false},
     {"label": "Até 15 personagens salvos", "soon": false},
     {"label": "Tudo do Pro", "soon": false},
     {"label": "Histórico completo e exportação", "soon": false},
     {"label": "Modelos premium", "soon": true},
     {"label": "Projetos e campanhas organizados", "soon": true},
     {"label": "Processamento prioritário", "soon": true},
     {"label": "Biblioteca de anúncios UGC", "soon": true},
     {"label": "Templates profissionais", "soon": true},
     {"label": "Suporte prioritário", "soon": true}
   ]',
   '{"credits": "1.500 por mês", "personas": "Até 15", "images": "yes", "videos": "yes", "motion_control": "soon",
     "ugc": "soon", "copy": "soon", "prompts": "soon", "premium_models": "soon", "history": "yes",
     "priority": "soon", "support": "soon"}',
   30)
on conflict (slug) do nothing;
