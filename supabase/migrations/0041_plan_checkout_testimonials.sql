-- Checkout próprio dos planos (docs/checkout-planos.md) e depoimentos de clientes reais.
--
-- 1. Produto da loja pode ser oferecido como "leve junto" no checkout dos planos (`offer_on_plans`).
--    Os extras viram um pedido da loja ligado à pessoa e à assinatura: no cartão é uma cobrança à
--    parte; no Pix entram na primeira mensalidade (o webhook separa o valor do plano e o dos extras).
-- 2. Depoimentos: só de quem pagou (pedido da loja pago ou assinatura com cobrança confirmada), com
--    autorização para publicar, e só aparecem depois de aprovados no admin. Nunca se cria depoimento
--    em nome de alguém: não existe função que grave depoimento sem uma compra real por trás.

alter table public.store_products
  add column offer_on_plans boolean not null default false;

alter table public.store_orders
  add column user_id uuid references auth.users (id) on delete set null,
  add column subscription_id uuid references public.subscriptions (id) on delete set null;

create index store_orders_subscription on public.store_orders (subscription_id) where subscription_id is not null;

-- --------------------------------------------------------------- depoimentos

create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  -- 'vynkio': aparece no checkout dos planos; 'store': no checkout do produto.
  scope text not null check (scope in ('vynkio', 'store')),
  product_slug text references public.store_products (slug) on delete cascade,
  source text not null check (source in ('store_order', 'subscription')),
  store_order_id uuid unique references public.store_orders (id) on delete cascade,
  -- Conta excluída leva o depoimento junto.
  user_id uuid references auth.users (id) on delete cascade,
  author_name text not null check (char_length(author_name) between 2 and 60),
  author_role text check (char_length(author_role) <= 80),
  body text not null check (char_length(body) between 20 and 600),
  rating smallint not null check (rating between 1 and 5),
  consent_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'approved', 'hidden')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((scope = 'store') = (product_slug is not null)),
  check ((source = 'store_order') = (store_order_id is not null)),
  check ((source = 'subscription') = (user_id is not null and scope = 'vynkio'))
);

create unique index testimonials_one_per_account on public.testimonials (user_id) where source = 'subscription';
create index testimonials_public on public.testimonials (scope, product_slug, created_at desc) where status = 'approved';

alter table public.testimonials enable row level security;
revoke all on public.testimonials from anon, authenticated;

/** Vitrine: só aprovados, só o primeiro nome e a inicial do sobrenome. */
create function public.public_testimonials(p_scope text, p_product text default null) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.created_at desc), '[]'::jsonb)
  from (
    select
      split_part(trim(author_name), ' ', 1)
        || coalesce(' ' || nullif(left(split_part(trim(author_name), ' ', 2), 1), '') || '.', '') as name,
      author_role as role, body, rating, created_at
    from public.testimonials
    where status = 'approved' and scope = p_scope
      and (p_scope = 'vynkio' or product_slug = p_product)
    order by created_at desc
    limit 6
  ) t;
$$;
revoke execute on function public.public_testimonials(text, text) from public;
grant execute on function public.public_testimonials(text, text) to anon, authenticated;

/** Quem assina e já pagou pelo menos uma mensalidade pode deixar um depoimento sobre o Vynkio. */
create function public.submit_testimonial(p_author_name text, p_author_role text, p_body text, p_rating integer, p_consent boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_consent is not true then raise exception 'consent_required'; end if;
  if not exists (
    select 1 from public.subscription_payments where user_id = uid and status = 'confirmed'
  ) then
    raise exception 'not_a_customer';
  end if;
  insert into public.testimonials (scope, source, user_id, author_name, author_role, body, rating)
  values ('vynkio', 'subscription', uid, trim(p_author_name), nullif(trim(coalesce(p_author_role, '')), ''), trim(p_body), p_rating)
  on conflict (user_id) where source = 'subscription' do update
    set author_name = excluded.author_name, author_role = excluded.author_role, body = excluded.body,
        rating = excluded.rating, consent_at = now(), status = 'pending', reviewed_at = null;
end;
$$;
revoke execute on function public.submit_testimonial(text, text, text, integer, boolean) from public, anon;
grant execute on function public.submit_testimonial(text, text, text, integer, boolean) to authenticated;

/** Já deixou depoimento? Para a tela da assinatura não pedir de novo. */
create function public.my_testimonial() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'eligible', exists (select 1 from public.subscription_payments where user_id = auth.uid() and status = 'confirmed'),
    'status', (select status from public.testimonials where user_id = auth.uid() and source = 'subscription')
  );
$$;
revoke execute on function public.my_testimonial() from public, anon;
grant execute on function public.my_testimonial() to authenticated;

-- ------------------------------------------------------------------ admin

create function public.admin_testimonials() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_admin_permission('plans.view');
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', t.id, 'scope', t.scope, 'product_slug', t.product_slug, 'source', t.source,
      'author_name', t.author_name, 'author_role', t.author_role, 'body', t.body, 'rating', t.rating,
      'status', t.status, 'created_at', t.created_at, 'reviewed_at', t.reviewed_at
    ) order by (t.status = 'pending') desc, t.created_at desc)
    from public.testimonials t
  ), '[]'::jsonb);
end;
$$;
revoke execute on function public.admin_testimonials() from public, anon;
grant execute on function public.admin_testimonials() to authenticated;

/** Aprovar ou esconder. O texto nunca é editado pelo admin: o depoimento é da pessoa. */
create function public.admin_set_testimonial_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare
  admin_id uuid := public.assert_admin_permission('plans.manage');
  changed public.testimonials;
begin
  if p_status not in ('approved', 'hidden') then raise exception 'invalid_status'; end if;
  update public.testimonials set status = p_status, reviewed_at = now() where id = p_id returning * into changed;
  if not found then raise exception 'testimonial_not_found'; end if;
  perform public.admin_log(admin_id, 'testimonial.' || p_status, changed.user_id, changed.id::text,
    jsonb_build_object('scope', changed.scope, 'product', changed.product_slug, 'rating', changed.rating), null);
end;
$$;
revoke execute on function public.admin_set_testimonial_status(uuid, text) from public, anon;
grant execute on function public.admin_set_testimonial_status(uuid, text) to authenticated;
