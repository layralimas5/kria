# Loja de infoprodutos

Venda avulsa de produto digital (kit, e-book, pack) sem conta no Vynkio. Criada em 19/11/2026.

## Como funciona

1. O botão da página de vendas aponta para `https://vynkio-ia.com.br/comprar/<slug>`.
2. `BuyPage` chama a function `store-checkout`, que cria o pedido em `store_orders` e o checkout avulso
   do Asaas (Pix ou cartão). Nome, e-mail, CPF e celular são pedidos pelo Asaas, não pelo Vynkio.
3. Depois de pagar, a pessoa volta para `/pedido/<token>` (`OrderPage`), que pergunta o status a cada
   4 s pela function `store-order`.
4. O `asaas-webhook` (`asaas-webhook/store.ts`) marca o pedido como pago e manda o mesmo link por
   e-mail (Resend), uma vez só.
5. "Baixar agora" pede à `store-order` uma URL assinada de 10 minutos do arquivo no bucket privado
   `store`. Cada pedido baixa até 30 vezes. Pedido estornado não baixa mais.

O token de 64 caracteres é a única chave do pedido. As tabelas `store_products` e `store_orders` não
têm policy: só as functions leem (0039).

## Cadastrar um produto

1. Subir o arquivo (.zip ou .pdf, até 500 MB) no Storage, bucket `store`, numa pasta com o slug:
   `kria-personagens/kria-personagens-insanos.zip`.
2. No SQL Editor:

```sql
insert into public.store_products (slug, name, price_cents, file_path, file_name, sales_url, active)
values ('kria-personagens', 'Kria Personagens Insanos', 4700,
        'kria-personagens/kria-personagens-insanos.zip', 'kria-personagens-insanos.zip',
        'https://<página de vendas>', true);
```

3. Na página de vendas, o botão de compra leva para `https://vynkio-ia.com.br/comprar/kria-personagens`.

Trocar preço: `update public.store_products set price_cents = ..., updated_at = now() where slug = '...'`.
Pedido já criado mantém o preço com que nasceu.

## Segredos

| Segredo | Para quê |
|---|---|
| `RESEND_API_KEY` | Envio do e-mail de entrega. Sem ele, a entrega fica só na página |
| `STORE_EMAIL_FROM` | Remetente verificado no Resend, ex.: `Vynkio <entrega@vynkio-ia.com.br>` |
| `STORE_EMAIL_REPLY_TO` | Opcional: para onde vai a resposta do comprador |

O Asaas já usa as chaves do Vynkio (`ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`), e o webhook já recebe os
eventos de checkout e de cobrança avulsa.

## Garantia e estorno

O estorno é feito no painel do Asaas. O evento `PAYMENT_REFUNDED` marca o pedido como `refunded` e
encerra o download.

## Ver as vendas

```sql
select o.created_at, o.product_slug, o.status, o.price_cents, o.buyer_email, o.downloads, o.email_sent_at
from public.store_orders o order by o.created_at desc limit 50;
```

`buyer_email` só aparece depois do pagamento confirmado. As vendas da loja ainda não entram no
Financeiro do admin.
