-- Chamados de suporte (24/11/2026, pedido da Lay): a pessoa abre um chamado na aba Suporte e acompanha a
-- conversa; a operação atende em /admin/chamados, no estilo GLPI (fila, prioridade, situação, nota interna).
--   * Tabelas fechadas: nada de select/insert direto. Tudo passa pelas funções abaixo.
--   * Nota interna (`internal`) nunca sai para a pessoa.
--   * Plano com suporte prioritário abre o chamado já em prioridade alta.
--   * Freio contra abuso: no máximo 5 chamados abertos ao mesmo tempo e 10 por dia por conta.

-- ------------------------------------------------------------ tabelas

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity unique,
  user_id uuid references auth.users (id) on delete set null,
  category text not null check (category in ('problem', 'generation', 'billing', 'account', 'suggestion', 'other')),
  subject text not null check (char_length(subject) between 5 and 120),
  -- open: novo, ninguém pegou. in_progress: em atendimento. waiting_user: a operação respondeu e espera a pessoa.
  -- resolved: resolvido (a pessoa pode reabrir respondendo).
  status text not null default 'open' check (status in ('open', 'in_progress', 'waiting_user', 'resolved')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  -- Plano no momento da abertura, para a fila mostrar sem recalcular.
  plan_name text,
  user_unread boolean not null default false,
  admin_unread boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index support_tickets_user_idx on public.support_tickets (user_id, updated_at desc);
create index support_tickets_queue_idx on public.support_tickets (status, updated_at desc);

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  author text not null check (author in ('user', 'admin')),
  author_id uuid references auth.users (id) on delete set null,
  body text not null check (char_length(body) between 1 and 5000),
  internal boolean not null default false check (not internal or author = 'admin'),
  created_at timestamptz not null default now()
);

create index support_messages_ticket_idx on public.support_messages (ticket_id, created_at);

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
revoke all on public.support_tickets, public.support_messages from anon, authenticated;

-- ------------------------------------------------------------ permissões

-- `support.view` lê a fila; `support.manage` responde e muda situação e prioridade. O papel `support` ganha as duas.
create or replace function public.admin_role_permissions(p_role public.admin_role) returns text[]
language sql immutable set search_path = public as $$
  select case p_role
    when 'super_admin' then array[
      'dashboard.view', 'finance.view', 'users.view', 'users.manage', 'credits.adjust',
      'plans.view', 'plans.manage', 'models.view', 'models.manage', 'pricing.manage',
      'audit.view', 'admins.manage', 'finance.override', 'expenses.manage', 'support.view', 'support.manage'
    ]
    when 'admin' then array[
      'dashboard.view', 'users.view', 'users.manage', 'credits.adjust',
      'plans.view', 'models.view', 'models.manage', 'audit.view', 'support.view', 'support.manage'
    ]
    when 'support' then array['dashboard.view', 'users.view', 'support.view', 'support.manage']
    when 'finance' then array['dashboard.view', 'finance.view', 'users.view', 'plans.view', 'models.view', 'expenses.manage']
    when 'analyst' then array['dashboard.view', 'plans.view', 'models.view']
  end;
$$;

-- ------------------------------------------------------------ apoio

create function public.support_ticket_json(t public.support_tickets, p_for_admin boolean) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', t.id, 'number', t.number, 'category', t.category, 'subject', t.subject, 'status', t.status,
    'priority', t.priority, 'plan_name', t.plan_name, 'created_at', t.created_at, 'updated_at', t.updated_at,
    'resolved_at', t.resolved_at,
    'unread', case when p_for_admin then t.admin_unread else t.user_unread end,
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'author', m.author, 'body', m.body, 'internal', m.internal, 'created_at', m.created_at
      ) order by m.created_at, m.id)
      from public.support_messages m
      where m.ticket_id = t.id and (p_for_admin or not m.internal)
    ), '[]'::jsonb)
  );
$$;
revoke execute on function public.support_ticket_json(public.support_tickets, boolean) from public, anon, authenticated;

-- ------------------------------------------------------------ pessoa

create function public.open_support_ticket(p_category text, p_subject text, p_body text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  plan public.subscription_plans;
  ticket_id uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_category not in ('problem', 'generation', 'billing', 'account', 'suggestion', 'other') then raise exception 'invalid_category'; end if;
  if char_length(trim(coalesce(p_subject, ''))) not between 5 and 120 then raise exception 'invalid_subject'; end if;
  if char_length(trim(coalesce(p_body, ''))) not between 10 and 5000 then raise exception 'invalid_body'; end if;
  if (select count(*) from public.support_tickets where user_id = uid and status <> 'resolved') >= 5 then
    raise exception 'too_many_open_tickets';
  end if;
  if (select count(*) from public.support_tickets where user_id = uid and created_at > now() - interval '1 day') >= 10 then
    raise exception 'too_many_tickets_today';
  end if;

  plan := public.effective_plan(uid);
  insert into public.support_tickets (user_id, category, subject, priority, plan_name)
  values (uid, p_category, trim(p_subject), case when plan.support_channel = 'whatsapp_priority' then 'high' else 'normal' end, plan.name)
  returning id into ticket_id;
  insert into public.support_messages (ticket_id, author, author_id, body) values (ticket_id, 'user', uid, trim(p_body));
  return ticket_id;
end;
$$;
revoke execute on function public.open_support_ticket(text, text, text) from public, anon;
grant execute on function public.open_support_ticket(text, text, text) to authenticated;

-- Lista da própria pessoa, sem as mensagens.
create function public.my_support_tickets() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  return coalesce((
    select jsonb_agg(public.support_ticket_json(t, false) - 'messages' order by t.updated_at desc)
    from public.support_tickets t where t.user_id = auth.uid()
  ), '[]'::jsonb);
end;
$$;
revoke execute on function public.my_support_tickets() from public, anon;
grant execute on function public.my_support_tickets() to authenticated;

-- Abrir o chamado marca a resposta da operação como lida.
create function public.my_support_ticket(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  t public.support_tickets;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  update public.support_tickets set user_unread = false where id = p_id and user_id = auth.uid() returning * into t;
  if not found then raise exception 'ticket_not_found'; end if;
  return public.support_ticket_json(t, false);
end;
$$;
revoke execute on function public.my_support_ticket(uuid) from public, anon;
grant execute on function public.my_support_ticket(uuid) to authenticated;

-- Responder reabre o chamado que estava esperando a pessoa ou já resolvido.
create function public.reply_support_ticket(p_id uuid, p_body text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  t public.support_tickets;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 5000 then raise exception 'invalid_body'; end if;
  select * into t from public.support_tickets where id = p_id and user_id = auth.uid() for update;
  if not found then raise exception 'ticket_not_found'; end if;
  insert into public.support_messages (ticket_id, author, author_id, body) values (t.id, 'user', auth.uid(), trim(p_body));
  update public.support_tickets
  set status = case when status in ('waiting_user', 'resolved') then 'open' else status end,
      resolved_at = null, admin_unread = true, user_unread = false, updated_at = now()
  where id = t.id returning * into t;
  return public.support_ticket_json(t, false);
end;
$$;
revoke execute on function public.reply_support_ticket(uuid, text) from public, anon;
grant execute on function public.reply_support_ticket(uuid, text) to authenticated;

-- A própria pessoa encerra quando o problema sumiu.
create function public.resolve_my_support_ticket(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  t public.support_tickets;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  update public.support_tickets set status = 'resolved', resolved_at = now(), updated_at = now()
  where id = p_id and user_id = auth.uid() returning * into t;
  if not found then raise exception 'ticket_not_found'; end if;
  return public.support_ticket_json(t, false);
end;
$$;
revoke execute on function public.resolve_my_support_ticket(uuid) from public, anon;
grant execute on function public.resolve_my_support_ticket(uuid) to authenticated;

-- ------------------------------------------------------------ admin

-- Fila inteira (até 300 mais recentes) e a contagem por situação, para os indicadores do topo.
create function public.admin_support_tickets() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_admin_permission('support.view');
  return jsonb_build_object(
    'tickets', coalesce((
      select jsonb_agg(q.item order by q.updated_at desc) from (
        select t.updated_at, (public.support_ticket_json(t, true) - 'messages') || jsonb_build_object(
          'email', (select u.email::text from auth.users u where u.id = t.user_id),
          'display_name', (select p.display_name from public.profiles p where p.id = t.user_id),
          'messages_count', (select count(*) from public.support_messages m where m.ticket_id = t.id and not m.internal)
        ) as item
        from public.support_tickets t
        order by t.updated_at desc
        limit 300
      ) q
    ), '[]'::jsonb),
    'counts', jsonb_build_object(
      'open', (select count(*) from public.support_tickets where status = 'open'),
      'in_progress', (select count(*) from public.support_tickets where status = 'in_progress'),
      'waiting_user', (select count(*) from public.support_tickets where status = 'waiting_user'),
      'resolved', (select count(*) from public.support_tickets where status = 'resolved'),
      'unread', (select count(*) from public.support_tickets where admin_unread)
    )
  );
end;
$$;
revoke execute on function public.admin_support_tickets() from public, anon;
grant execute on function public.admin_support_tickets() to authenticated;

-- Quantos chamados pedem atenção (novos ou com resposta não lida): vira o número no menu do admin.
create function public.admin_support_attention() returns integer
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_admin_permission('support.view');
  return (select count(*)::int from public.support_tickets where admin_unread or status = 'open');
end;
$$;
revoke execute on function public.admin_support_attention() from public, anon;
grant execute on function public.admin_support_attention() to authenticated;

create function public.admin_support_ticket(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  t public.support_tickets;
begin
  perform public.assert_admin_permission('support.view');
  update public.support_tickets set admin_unread = false where id = p_id returning * into t;
  if not found then raise exception 'ticket_not_found'; end if;
  return public.support_ticket_json(t, true) || jsonb_build_object(
    'user_id', t.user_id,
    'email', (select u.email::text from auth.users u where u.id = t.user_id),
    'display_name', (select p.display_name from public.profiles p where p.id = t.user_id),
    'current_plan', (select ep.name from public.effective_plan(t.user_id) ep where t.user_id is not null)
  );
end;
$$;
revoke execute on function public.admin_support_ticket(uuid) from public, anon;
grant execute on function public.admin_support_ticket(uuid) to authenticated;

-- Resposta pública passa o chamado para "aguardando a pessoa" (salvo outra situação escolhida); nota interna não muda nada para ela.
create function public.admin_reply_support_ticket(p_id uuid, p_body text, p_internal boolean, p_status text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  admin_id uuid := public.assert_admin_permission('support.manage');
  t public.support_tickets;
  next_status text;
begin
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 5000 then raise exception 'invalid_body'; end if;
  if p_status is not null and p_status not in ('open', 'in_progress', 'waiting_user', 'resolved') then raise exception 'invalid_status'; end if;
  select * into t from public.support_tickets where id = p_id for update;
  if not found then raise exception 'ticket_not_found'; end if;

  next_status := coalesce(p_status, case when coalesce(p_internal, false) then t.status else 'waiting_user' end);
  insert into public.support_messages (ticket_id, author, author_id, body, internal)
  values (t.id, 'admin', admin_id, trim(p_body), coalesce(p_internal, false));
  update public.support_tickets
  set status = next_status,
      resolved_at = case when next_status = 'resolved' then coalesce(resolved_at, now()) else null end,
      user_unread = user_unread or not coalesce(p_internal, false),
      admin_unread = false,
      updated_at = now()
  where id = t.id returning * into t;

  perform public.admin_log(admin_id, case when coalesce(p_internal, false) then 'support.note' else 'support.reply' end,
    t.user_id, t.id::text, jsonb_build_object('number', t.number, 'status', t.status), null);
  return public.admin_support_ticket(t.id);
end;
$$;
revoke execute on function public.admin_reply_support_ticket(uuid, text, boolean, text) from public, anon;
grant execute on function public.admin_reply_support_ticket(uuid, text, boolean, text) to authenticated;

-- Situação e prioridade; nulo mantém o que está.
create function public.admin_update_support_ticket(p_id uuid, p_status text, p_priority text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  admin_id uuid := public.assert_admin_permission('support.manage');
  before public.support_tickets;
  t public.support_tickets;
begin
  if p_status is not null and p_status not in ('open', 'in_progress', 'waiting_user', 'resolved') then raise exception 'invalid_status'; end if;
  if p_priority is not null and p_priority not in ('low', 'normal', 'high', 'urgent') then raise exception 'invalid_priority'; end if;
  select * into before from public.support_tickets where id = p_id for update;
  if not found then raise exception 'ticket_not_found'; end if;
  update public.support_tickets
  set status = coalesce(p_status, status),
      priority = coalesce(p_priority, priority),
      resolved_at = case when coalesce(p_status, status) = 'resolved' then coalesce(resolved_at, now()) else null end,
      updated_at = now()
  where id = p_id returning * into t;
  perform public.admin_log(admin_id, 'support.update', t.user_id, t.id::text,
    jsonb_build_object('number', t.number, 'status', jsonb_build_array(before.status, t.status),
      'priority', jsonb_build_array(before.priority, t.priority)), null);
  return public.admin_support_ticket(t.id);
end;
$$;
revoke execute on function public.admin_update_support_ticket(uuid, text, text) from public, anon;
grant execute on function public.admin_update_support_ticket(uuid, text, text) to authenticated;
