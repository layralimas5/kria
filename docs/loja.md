# Loja de infoprodutos

Venda avulsa de produto digital (kit, e-book, pack) sem conta no Vynkio. Criada em 19/11/2026.

## Como funciona (checkout próprio, desde 20/11/2026, migration 0040)

1. O botão da página de vendas aponta para `https://vynkio-ia.com.br/comprar/<slug>`.
2. `CheckoutPage` pede a oferta à `store-checkout` (`action: 'offer'`): capa, nome, linha curta, preço, "leve junto"
   e regra de parcelas. Tudo na mesma tela, sem a página do Asaas: nome, e-mail, CPF, celular, Pix ou cartão.
3. Ao pagar (`action: 'pay'`), a function recalcula o pedido no servidor (`_shared/storeCheckout.ts`) e recusa se o
   total que a pessoa viu não bater (`price_changed`). Cria o pedido em `store_orders`, os itens em `store_order_items`,
   o cliente no Asaas (pelo CPF) e a cobrança direta:
   - **Pix**: cobrança com vencimento hoje; o QR e o copia e cola ficam no pedido e aparecem em `/pedido/<token>`.
   - **Cartão**: cobrança na hora pela API, à vista ou parcelado (`installmentCount` + `totalValue`). O número do cartão
     só passa pela function a caminho do Asaas: não é gravado, não vai para log, não volta na resposta. O Asaas não tem
     tokenização no navegador (conferido em 20/11), por isso o cartão passa pela function. Recusado = 402 com a mensagem
     do Asaas e o pedido fica `failed`.
4. A pessoa cai em `/pedido/<token>` (`OrderPage`), que pergunta o status a cada 4 s pela `store-order`.
5. O `asaas-webhook` (`asaas-webhook/store.ts`) marca pago e manda o link por e-mail (Gmail do Vynkio), uma vez só, para o
   e-mail digitado no checkout. Cartão recusado depois (captura ou análise de risco) e Pix vencido viram `failed`.
6. "Baixar" pede à `store-order` uma URL assinada de 10 minutos do arquivo de cada produto do pedido. Cada produto
   baixa até 30 vezes. Pedido estornado não baixa mais.

**Parcelas e juros.** Juro ao mês repassado a quem compra (`interest_monthly`, padrão 2,99%), tabela Price, parcela
arredondada para cima no centavo (`_shared/installments.ts`, a mesma conta no front e na function). À vista nunca tem
juros; parcela mínima de R$ 5. Para vender sem juros: `interest_monthly = 0`. Lembre que o Asaas cobra a taxa dele
por parcela: com juro zero, a taxa sai da sua margem.

**Leve junto (order bump).** Até 3 produtos em `bump_slugs` do produto principal, cada um ativo e com arquivo próprio.
O preço de oferta é `bump_price_cents` do produto oferecido (vazio = preço normal) e a frase é `bump_pitch`.

**Visual (21/11).** No padrão das plataformas de infoproduto: fundo claro, coluna única, faixa escura com a marca
no topo, capa 1200x480, preço com "ou Nx de" (maior parcela), e-mail com confirmação (o acesso chega por ele),
"leve junto" em caixa tracejada e botão verde. Os campos claros ficam em `components/checkout/fields.tsx`; o resto
do app continua escuro. Verde dos botões é `green-700` (texto branco com contraste AA). Ver no `npm run dev:demo`
em `/comprar/kria-personagens`.

**Freios.** Sem login: no máximo 40 pedidos pendentes a cada 10 minutos e 6 tentativas por IP por hora (o IP fica só
como sha256 em `client_ip_hash`). Se aparecer teste de cartão em massa, o próximo passo é captcha (Turnstile) no botão.

O token de 64 caracteres é a única chave do pedido. As tabelas `store_products`, `store_orders` e `store_order_items`
não têm policy: só as functions leem (0039 e 0040).

## Cadastrar um produto

1. Subir o arquivo (.zip ou .pdf, até 500 MB) no Storage, bucket `store`, numa pasta com o slug:
   `kria-personagens/kria-personagens-insanos.zip`.
2. No SQL Editor:

```sql
insert into public.store_products (slug, name, price_cents, file_path, file_name, sales_url, active,
                                   cover_url, tagline, max_installments, interest_monthly)
values ('kria-personagens', 'Kria Personagens Insanos', 4700,
        'kria-personagens/kria-personagens-insanos.zip', 'kria-personagens-insanos.zip',
        'https://<página de vendas>', true,
        'https://<capa 1200x480 pública>', '100 personagens prontos para criar conteúdo com IA', 12, 0.0299);
```

Oferecer outro produto como "leve junto" no checkout dele:

```sql
update public.store_products set bump_price_cents = 1990, bump_pitch = 'Os prompts que eu uso. Só neste checkout.'
where slug = 'pack-prompts';
update public.store_products set bump_slugs = '{pack-prompts}' where slug = 'kria-personagens';
```

A capa pode ficar num bucket público do Supabase ou no próprio site de vendas (precisa ser `https://`).

3. Na página de vendas, o botão de compra leva para `https://vynkio-ia.com.br/comprar/kria-personagens`.

Trocar preço: `update public.store_products set price_cents = ..., updated_at = now() where slug = '...'`.
Pedido já criado mantém o preço com que nasceu.

## Segredos

| Segredo | Para quê |
|---|---|
| `STORE_SMTP_USER` | Gmail que envia o e-mail de entrega: `vynkio.suporte@gmail.com` (o mesmo dos e-mails de login) |
| `STORE_SMTP_PASS` | Senha de app do Google dessa conta. Sem ela, a entrega fica só na página |

O envio é por SMTP na porta 465 (as Edge Functions bloqueiam 25 e 587). O Gmail limita a 500 e-mails por dia,
somados aos de login: passou disso, trocar `_shared/storeMailer.ts` por um serviço de envio.

O Asaas já usa as chaves do Vynkio (`ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`). No painel do webhook, marcar também
`PAYMENT_CREDIT_CARD_CAPTURE_REFUSED` e `PAYMENT_REPROVED_BY_RISK_ANALYSIS`.

## Antes de vender de verdade (testar no sandbox)

1. Aplicar 0039 e 0040 no SQL Editor; publicar `store-checkout`, `store-order` e `asaas-webhook`.
2. Pix: gerar, pagar pelo painel do sandbox e ver a página virar "Pagamento confirmado" e o e-mail sair.
3. Cartão à vista e em 3x com os cartões de teste do Asaas; conferir no painel que o total é o do checkout e que as
   parcelas confirmam o pedido (o webhook acha a parcela pelo `provider_installment_id` se a referência não vier).
4. Cartão recusado: a mensagem aparece no checkout e nada é cobrado.
5. Estorno pelo painel: o download para.

## Garantia e estorno

O estorno é feito no painel do Asaas. O evento `PAYMENT_REFUNDED` marca o pedido como `refunded` e
encerra o download.

## Ver as vendas

```sql
select o.created_at, o.product_slug, o.status, o.payment_method, o.installments, o.price_cents, o.total_cents,
       o.buyer_email, o.email_sent_at,
       (select string_agg(i.product_slug, ' + ') from public.store_order_items i where i.order_id = o.id) as itens
from public.store_orders o order by o.created_at desc limit 50;
``` As vendas da loja ainda não entram no
Financeiro do admin.
