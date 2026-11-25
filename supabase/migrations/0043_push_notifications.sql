-- Notificações no aparelho (Web Push, docs/app-e-notificacoes.md).
--
-- Cada aparelho que aceitou notificação vira uma linha, com os tópicos que quer receber:
--   generations: a geração da pessoa ficou pronta ou falhou (qualquer conta)
--   sales:       venda confirmada pelo Asaas (só quem administra com finance.view)
--
-- O navegador grava pela função (nunca direto na tabela) e só o servidor envia. O endereço de envio
-- só pode ser de um serviço de push conhecido: o servidor faz POST nele, então endereço livre seria SSRF.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) <= 1000),
  p256dh text not null check (p256dh ~ '^[A-Za-z0-9_-]{80,100}$'),
  auth text not null check (auth ~ '^[A-Za-z0-9_-]{16,30}$'),
  topics text[] not null default '{generations}' check (topics <@ array['generations', 'sales']::text[]),
  device_label text check (char_length(device_label) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_sent_at timestamptz,
  failures integer not null default 0 check (failures >= 0)
);

create index push_subscriptions_user on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "push: dono lê os próprios aparelhos" on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());

revoke insert, update, delete on public.push_subscriptions from anon, authenticated;

-- Serviços de push dos navegadores (Chrome/Edge/Android, Firefox, Windows, Safari/iPhone).
create function public.is_push_endpoint(p_endpoint text) returns boolean
language sql immutable set search_path = public as $$
  select p_endpoint ~ '^https://(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.notify\.windows\.com|web\.push\.apple\.com|[a-z0-9-]+\.push\.apple\.com)/'
$$;

alter table public.push_subscriptions
  add constraint push_subscriptions_known_service check (public.is_push_endpoint(endpoint));

/**
 * Grava (ou atualiza) o aparelho da conta logada com os tópicos escolhidos. O mesmo navegador
 * logado em outra conta passa a ser dessa conta: notificação segue quem está no aparelho.
 */
create function public.save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_topics text[],
  p_device_label text default null
) returns text[]
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_topics text[];
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_endpoint is null or not public.is_push_endpoint(p_endpoint) then raise exception 'invalid_push_endpoint'; end if;
  v_topics := array(select distinct t from unnest(coalesce(p_topics, '{}')) as t order by t);
  if cardinality(v_topics) = 0 then raise exception 'invalid_push_topics'; end if;
  if not (v_topics <@ array['generations', 'sales']::text[]) then raise exception 'invalid_push_topics'; end if;
  if 'sales' = any (v_topics) and not public.has_admin_permission('finance.view') then raise exception 'forbidden'; end if;

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, topics, device_label)
  values (v_user, p_endpoint, p_p256dh, p_auth, v_topics, left(nullif(trim(p_device_label), ''), 80))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        topics = excluded.topics, device_label = excluded.device_label,
        updated_at = now(), failures = 0;
  return v_topics;
end;
$$;

create function public.remove_push_subscription(p_endpoint text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
  return found;
end;
$$;

/**
 * Para quem o servidor manda: os aparelhos da pessoa (generations), os de quem ainda administra
 * com finance.view (sales) ou todos os da pessoa (test, o botão "Mandar um teste").
 * Admin removido ou rebaixado para de receber venda na hora.
 */
create function public.push_targets(p_topic text, p_user_id uuid default null)
returns table (id uuid, endpoint text, p256dh text, auth text)
language sql stable security definer set search_path = public as $$
  select s.id, s.endpoint, s.p256dh, s.auth
  from public.push_subscriptions s
  where (p_topic = 'test' or p_topic = any (s.topics))
    and case
      when p_topic = 'sales' then exists (
        select 1 from public.admin_users a
        where a.user_id = s.user_id and 'finance.view' = any (public.admin_role_permissions(a.role))
      )
      else s.user_id = p_user_id
    end
$$;

-- Serviço de push recusando muitas vezes seguidas: o aparelho morreu sem avisar.
create function public.push_register_failure(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update public.push_subscriptions set failures = failures + 1, updated_at = now() where id = p_id;
  delete from public.push_subscriptions where id = p_id and failures >= 10;
$$;

grant execute on function public.save_push_subscription(text, text, text, text[], text) to authenticated;
grant execute on function public.remove_push_subscription(text) to authenticated;
grant execute on function public.push_targets(text, uuid) to service_role;
grant execute on function public.push_register_failure(uuid) to service_role;
