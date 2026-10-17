-- Kria: base do produto.
--
-- Créditos: o saldo vive em `credit_balances` (com check >= 0, que segura a
-- corrida entre duas gerações simultâneas) e todo movimento fica em
-- `credit_ledger`. Saldo e extrato só mudam por funções `security definer`;
-- ninguém escreve nessas tabelas pelo cliente.
--
-- Geração: o crédito é debitado quando a geração nasce e devolvido se ela
-- falhar. Os índices únicos do extrato garantem um débito e no máximo um
-- estorno por geração, e um crédito por compra, mesmo com webhook repetido.

-- ---------------------------------------------------------------- perfis

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------- créditos

create table public.credit_balances (
  user_id uuid primary key references auth.users (id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create type public.ledger_reason as enum ('signup_bonus', 'purchase', 'generation', 'generation_refund', 'adjustment');

create table public.credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  delta integer not null check (delta <> 0),
  reason public.ledger_reason not null,
  generation_id uuid,
  purchase_id uuid,
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now()
);

create index credit_ledger_user_recent on public.credit_ledger (user_id, created_at desc);
create unique index credit_ledger_one_signup_bonus on public.credit_ledger (user_id) where reason = 'signup_bonus';
create unique index credit_ledger_one_charge on public.credit_ledger (generation_id) where reason = 'generation';
create unique index credit_ledger_one_refund on public.credit_ledger (generation_id) where reason = 'generation_refund';
create unique index credit_ledger_one_purchase on public.credit_ledger (purchase_id) where reason = 'purchase';

-- --------------------------------------------------------------- modelos

-- Catálogo editável sem deploy: trocar endpoint, preço ou desligar um
-- modelo é um update aqui. `defaults` entra no corpo enviado ao fal.ai.
create table public.models (
  slug text primary key check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (char_length(name) between 1 and 40),
  description text not null default '' check (char_length(description) <= 160),
  kind text not null check (kind in ('image', 'video')),
  endpoint text not null check (endpoint ~ '^[a-z0-9._/-]+$'),
  image_input text check (image_input in ('image_url', 'image_urls', 'start_image_url')),
  requires_image boolean not null default false,
  credits integer not null check (credits > 0),
  defaults jsonb not null default '{}'::jsonb check (jsonb_typeof(defaults) = 'object'),
  active boolean not null default true,
  position integer not null default 0,
  check (not requires_image or image_input is not null)
);

-- -------------------------------------------------------------- personas

create table public.personas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  description text not null default '' check (char_length(description) <= 500),
  image_path text not null,
  created_at timestamptz not null default now()
);

create index personas_user_recent on public.personas (user_id, created_at desc);

-- -------------------------------------------------------------- gerações

create type public.generation_status as enum ('queued', 'running', 'succeeded', 'failed');

create table public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  model_slug text not null references public.models (slug),
  kind text not null check (kind in ('image', 'video')),
  prompt text not null check (char_length(prompt) between 3 and 2000),
  persona_id uuid references public.personas (id) on delete set null,
  source_generation_id uuid references public.generations (id) on delete set null,
  credits integer not null check (credits > 0),
  status public.generation_status not null default 'queued',
  provider_request_id text unique,
  provider_status_url text,
  provider_response_url text,
  output_path text,
  output_type text,
  error text check (char_length(error) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index generations_user_recent on public.generations (user_id, created_at desc);
create index generations_open on public.generations (created_at) where status in ('queued', 'running');

-- ------------------------------------------------------ pacotes e compras

create table public.credit_packs (
  slug text primary key check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (char_length(name) between 1 and 30),
  credits integer not null check (credits > 0),
  price_cents integer not null check (price_cents >= 500),
  highlight boolean not null default false,
  active boolean not null default true,
  position integer not null default 0
);

create type public.purchase_status as enum ('pending', 'paid', 'expired', 'refunded');

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  pack_slug text not null references public.credit_packs (slug),
  credits integer not null check (credits > 0),
  price_cents integer not null check (price_cents > 0),
  status public.purchase_status not null default 'pending',
  provider_checkout_id text unique,
  provider_payment_id text,
  checkout_url text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index purchases_user_recent on public.purchases (user_id, created_at desc);

-- Entrega do Asaas é "pelo menos uma vez": o id do evento segura repetição.
create table public.billing_events (
  id text primary key,
  event text not null,
  payload jsonb not null,
  outcome text,
  received_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ RLS

alter table public.profiles enable row level security;
alter table public.credit_balances enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.models enable row level security;
alter table public.personas enable row level security;
alter table public.generations enable row level security;
alter table public.credit_packs enable row level security;
alter table public.purchases enable row level security;
alter table public.billing_events enable row level security;

revoke all on public.profiles, public.credit_balances, public.credit_ledger, public.models, public.personas,
  public.generations, public.credit_packs, public.purchases, public.billing_events from anon, authenticated;

grant select on public.models, public.credit_packs to anon, authenticated;
grant select on public.profiles, public.credit_balances, public.credit_ledger, public.personas,
  public.generations, public.purchases to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant delete on public.personas to authenticated;

create policy "own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "own balance" on public.credit_balances for select to authenticated using (user_id = auth.uid());
create policy "own ledger" on public.credit_ledger for select to authenticated using (user_id = auth.uid());
create policy "active models" on public.models for select to anon, authenticated using (active);
create policy "own personas" on public.personas for select to authenticated using (user_id = auth.uid());
create policy "own personas delete" on public.personas for delete to authenticated using (user_id = auth.uid());
create policy "own generations" on public.generations for select to authenticated using (user_id = auth.uid());
create policy "active packs" on public.credit_packs for select to anon, authenticated using (active);
create policy "own purchases" on public.purchases for select to authenticated using (user_id = auth.uid());

-- -------------------------------------------------------- conta nova

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  signup_bonus constant integer := 20;
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(nullif(new.raw_user_meta_data ->> 'display_name', ''), 80));

  insert into public.credit_balances (user_id, balance) values (new.id, signup_bonus);
  insert into public.credit_ledger (user_id, delta, reason, note)
  values (new.id, signup_bonus, 'signup_bonus', 'Créditos de boas-vindas');
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------ geração: criar

-- Valida, debita e cria a geração numa transação só. Chamada pela edge
-- function `generate` com a service role, que passa o usuário do JWT.
create function public.create_generation(
  p_user_id uuid,
  p_model_slug text,
  p_prompt text,
  p_persona_id uuid default null,
  p_source_generation_id uuid default null
) returns public.generations
language plpgsql security definer set search_path = public as $$
declare
  max_running constant integer := 3;
  m public.models;
  g public.generations;
  current_balance integer;
  running integer;
begin
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

  select balance into current_balance from public.credit_balances where user_id = p_user_id for update;
  if not found then raise exception 'account_not_found'; end if;

  select count(*) into running from public.generations
  where user_id = p_user_id and status in ('queued', 'running');
  if running >= max_running then raise exception 'too_many_running'; end if;

  if current_balance < m.credits then raise exception 'insufficient_credits'; end if;

  insert into public.generations (user_id, model_slug, kind, prompt, persona_id, source_generation_id, credits)
  values (p_user_id, m.slug, m.kind, trim(p_prompt), p_persona_id, p_source_generation_id, m.credits)
  returning * into g;

  update public.credit_balances set balance = balance - m.credits, updated_at = now() where user_id = p_user_id;
  insert into public.credit_ledger (user_id, delta, reason, generation_id, note)
  values (p_user_id, -m.credits, 'generation', g.id, m.name);

  return g;
end;
$$;

-- --------------------------------------------- geração: concluir/falhar

create function public.complete_generation(p_id uuid, p_output_path text, p_output_type text)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update public.generations
  set status = 'succeeded', output_path = p_output_path, output_type = p_output_type,
      completed_at = now(), updated_at = now()
  where id = p_id and status in ('queued', 'running');
  return found;
end;
$$;

-- Marca como falha e devolve o crédito. Só age em geração aberta, então
-- chamar duas vezes (webhook e polling ao mesmo tempo) estorna uma vez.
create function public.fail_generation(p_id uuid, p_error text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  g public.generations;
begin
  update public.generations
  set status = 'failed', error = left(coalesce(p_error, 'Falha na geração'), 500),
      completed_at = now(), updated_at = now()
  where id = p_id and status in ('queued', 'running')
  returning * into g;
  if not found then return false; end if;

  update public.credit_balances set balance = balance + g.credits, updated_at = now() where user_id = g.user_id;
  insert into public.credit_ledger (user_id, delta, reason, generation_id, note)
  values (g.user_id, g.credits, 'generation_refund', g.id, 'Estorno de geração que falhou');
  return true;
end;
$$;

-- ---------------------------------------------------- compra: creditar

create function public.grant_purchase(p_purchase_id uuid, p_payment_id text default null)
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

  update public.credit_balances set balance = balance + p.credits, updated_at = now() where user_id = p.user_id;
  insert into public.credit_ledger (user_id, delta, reason, purchase_id, note)
  values (p.user_id, p.credits, 'purchase', p.id, 'Compra de créditos');
  return true;
end;
$$;

-- ------------------------------------------------- persona: criar

-- A persona nasce de uma imagem que a própria pessoa gerou aqui. Sem
-- upload de foto: é o que impede usar o rosto de alguém real.
create function public.create_persona(p_generation_id uuid, p_name text, p_description text default '')
returns public.personas
language plpgsql security definer set search_path = public as $$
declare
  max_personas constant integer := 30;
  uid uuid := auth.uid();
  source public.generations;
  persona public.personas;
begin
  if uid is null then raise exception 'not_authenticated'; end if;

  select * into source from public.generations
  where id = p_generation_id and user_id = uid and status = 'succeeded' and kind = 'image' and output_path is not null;
  if not found then raise exception 'source_not_found'; end if;

  if (select count(*) from public.personas where user_id = uid) >= max_personas then
    raise exception 'too_many_personas';
  end if;

  insert into public.personas (user_id, name, description, image_path)
  values (uid, trim(p_name), coalesce(trim(p_description), ''), source.output_path)
  returning * into persona;
  return persona;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.create_generation(uuid, text, text, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.complete_generation(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.fail_generation(uuid, text) from public, anon, authenticated;
revoke execute on function public.grant_purchase(uuid, text) from public, anon, authenticated;
revoke execute on function public.create_persona(uuid, text, text) from public, anon;
grant execute on function public.create_generation(uuid, text, text, uuid, uuid) to service_role;
grant execute on function public.complete_generation(uuid, text, text) to service_role;
grant execute on function public.fail_generation(uuid, text) to service_role;
grant execute on function public.grant_purchase(uuid, text) to service_role;
grant execute on function public.create_persona(uuid, text, text) to authenticated;

-- --------------------------------------------------------------- storage

-- Tudo que é gerado fica em `media/<user_id>/<generation_id>.<ext>`.
-- Leitura só da própria pasta, por URL assinada; escrita só pela service role.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 104857600, array['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/webm'])
on conflict (id) do nothing;

create policy "own media read" on storage.objects for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

-- -------------------------------------------------------------- realtime

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.generations, public.credit_balances;
  end if;
end;
$$;

-- ---------------------------------------------------------------- seeds

-- Preço em créditos calibrado para ~R$ 0,20 por crédito na venda e margem
-- de 2x a 3x sobre o custo do fal.ai. Conferir o preço de cada endpoint em
-- fal.ai/pricing antes de abrir para o público e ajustar aqui.
insert into public.models (slug, name, description, kind, endpoint, image_input, requires_image, credits, defaults, position) values
  ('foto', 'Foto', 'Imagem realista a partir do texto.', 'image',
   'fal-ai/nano-banana-2', null, false, 5, '{"num_images": 1, "aspect_ratio": "4:5", "safety_tolerance": "2"}', 10),
  ('foto-persona', 'Foto com persona', 'A mesma pessoa em qualquer cenário.', 'image',
   'fal-ai/nano-banana-2/edit', 'image_urls', true, 6, '{"num_images": 1, "aspect_ratio": "4:5", "safety_tolerance": "2"}', 20),
  ('video-kling', 'Vídeo Kling', 'Anima uma imagem. 5 segundos, com áudio.', 'video',
   'fal-ai/kling-video/v3/standard/image-to-video', 'start_image_url', true, 40, '{"duration": "5", "generate_audio": true}', 30),
  ('video-veo', 'Vídeo Veo 3.1', 'Anima uma imagem com fala e som. 8 segundos.', 'video',
   'fal-ai/veo3.1/image-to-video', 'image_url', true, 200, '{"duration": "8s", "resolution": "720p", "aspect_ratio": "9:16", "generate_audio": true, "safety_tolerance": "2"}', 40)
on conflict (slug) do nothing;

insert into public.credit_packs (slug, name, credits, price_cents, highlight, position) values
  ('inicial', 'Inicial', 100, 1990, false, 10),
  ('criador', 'Criador', 300, 4990, true, 20),
  ('estudio', 'Estúdio', 800, 11990, false, 30)
on conflict (slug) do nothing;
