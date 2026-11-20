-- Checkout próprio da loja (docs/loja.md): a pessoa paga na página do Vynkio, sem a tela do Asaas.
-- Pix com QR na própria página e cartão pela API (o número do cartão só passa pela function, nunca é
-- gravado). Um pedido pode levar mais de um produto (order bump), e o cartão parcela com juros visíveis.

alter table public.store_products
  -- Capa no topo do checkout (URL https pública) e uma linha curta abaixo do nome.
  add column cover_url text check (cover_url is null or cover_url ~ '^https://'),
  add column tagline text check (tagline is null or length(tagline) between 2 and 160),
  -- Parcelas no cartão: até quantas e o juro ao mês repassado ao comprador (0 = sem juros).
  add column max_installments integer not null default 12 check (max_installments between 1 and 12),
  add column interest_monthly numeric(5, 4) not null default 0.0299 check (interest_monthly between 0 and 0.1),
  -- Produtos oferecidos como "leve junto" neste checkout, na ordem em que aparecem.
  add column bump_slugs text[] not null default '{}' check (cardinality(bump_slugs) <= 3),
  -- Preço do produto quando entra como "leve junto" (vazio = o preço normal).
  add column bump_price_cents integer check (bump_price_cents is null or bump_price_cents between 500 and 1000000),
  add column bump_pitch text check (bump_pitch is null or length(bump_pitch) between 2 and 200);

alter type public.store_order_status add value if not exists 'failed';

alter table public.store_orders
  add column payment_method text check (payment_method in ('pix', 'card')),
  add column installments integer not null default 1 check (installments between 1 and 12),
  -- Valor cobrado: soma dos itens mais juros do parcelamento. `price_cents` segue sendo a soma dos itens.
  add column total_cents integer check (total_cents is null or total_cents > 0),
  add column provider_installment_id text,
  add column pix_payload text,
  add column pix_qr_base64 text,
  add column pix_expires_at timestamptz,
  -- sha256 do IP: freio contra teste de cartão roubado, sem guardar o IP.
  add column client_ip_hash text;

create index store_orders_ip_recent on public.store_orders (client_ip_hash, created_at);
create index store_orders_installment on public.store_orders (provider_installment_id) where provider_installment_id is not null;

create table public.store_order_items (
  order_id uuid not null references public.store_orders (id) on delete cascade,
  product_slug text not null references public.store_products (slug),
  price_cents integer not null check (price_cents > 0),
  -- Item principal (o da página de vendas) ou "leve junto".
  is_bump boolean not null default false,
  downloads integer not null default 0,
  primary key (order_id, product_slug)
);

alter table public.store_order_items enable row level security;
revoke all on public.store_order_items from anon, authenticated;

-- Pedidos de antes desta migration têm um item só: o produto do pedido.
insert into public.store_order_items (order_id, product_slug, price_cents, downloads)
select id, product_slug, price_cents, downloads from public.store_orders
on conflict do nothing;
