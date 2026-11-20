-- Loja de infoprodutos (docs/loja.md): venda avulsa sem conta no Vynkio. O comprador paga no checkout
-- do Asaas (Pix ou cartão), o asaas-webhook marca o pedido como pago e a entrega é um link com token:
-- página de download e o mesmo link por e-mail. Nada aqui é lido pelo navegador: as tabelas não têm
-- policy, só as functions (service role) mexem, e o arquivo sai por URL assinada de poucos minutos.

create table public.store_products (
  slug text primary key check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (length(name) between 2 and 80),
  price_cents integer not null check (price_cents between 500 and 1000000),
  -- Caminho no bucket `store` e nome do arquivo que a pessoa baixa.
  file_path text not null check (length(file_path) between 3 and 200),
  file_name text not null check (file_name ~ '^[A-Za-z0-9._-]{3,120}$'),
  -- Página de vendas, para o botão "voltar" do checkout.
  sales_url text not null check (sales_url ~ '^https://'),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type public.store_order_status as enum ('pending', 'paid', 'refunded', 'expired');

create table public.store_orders (
  id uuid primary key default gen_random_uuid(),
  product_slug text not null references public.store_products (slug),
  price_cents integer not null check (price_cents > 0),
  status public.store_order_status not null default 'pending',
  -- 64 caracteres hex: é a chave da página de download e do link do e-mail.
  access_token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  provider_checkout_id text unique,
  checkout_url text,
  provider_payment_id text unique,
  provider_customer_id text,
  buyer_email text,
  buyer_name text,
  paid_at timestamptz,
  refunded_at timestamptz,
  email_sent_at timestamptz,
  downloads integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index store_orders_pending_recent on public.store_orders (created_at) where status = 'pending';

alter table public.store_products enable row level security;
alter table public.store_orders enable row level security;
revoke all on public.store_products, public.store_orders from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('store', 'store', false, 524288000, array['application/zip', 'application/pdf'])
on conflict (id) do nothing;
