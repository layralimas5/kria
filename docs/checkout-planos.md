# Checkout próprio dos planos (21/11/2026, migration 0041)

Quem clica em assinar um plano (landing ou tela Assinatura) cai em `/assinar/:plan`: a página de checkout do
Vynkio, no mesmo visual claro da loja (`docs/loja.md`). Antes, o cartão ia para a tela do Asaas e o Pix para a
fatura do Asaas. Agora tudo acontece na página do Vynkio, com os produtos da loja oferecidos como "leve junto".

## Como funciona

1. `PlanCheckoutPage` pede a oferta à function `subscribe` (`action: 'offer'`): plano (nome, linha, preço,
   créditos, até 6 benefícios), "leve junto" e o e-mail da conta. Exige login (a assinatura é da conta).
2. A pessoa preenche nome, CPF e celular (o e-mail é o da conta), escolhe cartão ou Pix e marca os extras.
3. `action: 'pay'` (`_shared/planCheckout.ts` valida, `_shared/planQuote.ts` soma) recalcula no servidor e recusa
   se o total que a pessoa viu não bater (`price_changed`).
   - **Cartão**: assinatura pela API do Asaas com o cartão (`createCardSubscription`). A primeira mensalidade sai na
     hora e o Asaas guarda o cartão para as próximas. Recusado = 402 com a mensagem do Asaas, nada criado.
     Os extras viram um pedido da loja (`store_orders` com `user_id` e `subscription_id`) cobrado à vista no mesmo
     cartão, numa cobrança à parte. Se só os extras forem recusados, o plano segue e a pessoa é avisada.
   - **Pix**: assinatura Pix (uma cobrança por mês). Com extras, a **primeira** mensalidade recebe o valor deles
     (`PUT /payments/{id}`, `setPixPaymentValue`); as seguintes continuam com o valor do plano. O QR aparece na
     própria página e ela pergunta o status a cada 4 s (`action: 'status'`). Se o Asaas não aceitar somar, segue
     só o plano e o pedido dos extras fica `failed`, sem ligação com a cobrança.
4. O `asaas-webhook` ativa o plano como sempre. Na primeira mensalidade Pix com extras, ele acha o pedido pela
   cobrança, libera os downloads (e-mail pelo Gmail do Vynkio) e registra no plano só a parte dele (`splitFirstPayment`),
   para o MRR e o financeiro não contarem os extras como mensalidade. Só libera se o valor pago cobre os extras.
5. Depois de pago, a pessoa vai para `/assinatura?assinatura=<id>&pedido=<token>`: a confirmação e o link dos extras.

## Oferecer um produto como "leve junto" nos planos

```sql
update public.store_products set offer_on_plans = true where slug = 'kria-personagens';
-- Preço de oferta (opcional; vazio = preço normal) e a frase da caixa:
update public.store_products set bump_price_cents = 990, bump_pitch = 'Leve junto com o plano.' where slug = 'kria-personagens';
```

Aparecem até 3, na ordem de cadastro. A imagem da caixa é a `cover_url` do produto (a capa do PDF fica em
`<página de vendas>/capa-produto.jpg`, gerada por `npm run cover` em `pessoais/kria-personagens`).

Capa do topo do checkout: `public/checkout/vynkio-capa.jpg`, gerada por `npm run checkout:cover` com fotos reais
da landing.

## Depoimentos (só reais)

- Só deixa depoimento quem pagou: assinante com mensalidade confirmada (`submit_testimonial`, na tela Assinatura)
  ou comprador da loja com pedido pago (`store-order`, `action: 'review'`, na página do pedido).
- A pessoa marca a autorização para publicar. Tudo entra como `pending`.
- No admin, Comercial > Depoimentos: aprovar ou esconder (`plans.manage`, vai para a auditoria). O texto não se edita.
- O checkout mostra até 6 aprovados (`public_testimonials`): primeiro nome e inicial do sobrenome. Sem aprovado,
  o bloco não aparece. Não existe caminho para criar depoimento sem uma compra por trás, e não deve existir.
- No modo demo aparece um único cartão que se apresenta como exemplo de layout.

## Antes de ligar (sandbox)

- Aplicar a 0041. Publicar `subscribe`, `store-order` e `asaas-webhook` (esta com `--no-verify-jwt`).
- Cartão de teste do Asaas: assinatura criada, `PAYMENT_CONFIRMED` ativa o plano, extras cobrados à parte.
- Cartão recusado: nada criado, mensagem do Asaas na tela.
- Pix com extra: o QR mostra plano + extra; pago, o plano ativa com o valor do plano em `subscription_payments`
  e o pedido dos extras vira pago com e-mail. A segunda mensalidade (no Asaas) vem só com o valor do plano.
- Conferir no sandbox se o `PUT` da primeira cobrança de uma assinatura funciona (a documentação não proíbe nem
  garante). Se falhar, o checkout já segue só com o plano e avisa.
