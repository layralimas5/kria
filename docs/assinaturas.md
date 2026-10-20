# Assinaturas (Starter, Pro, Studio)

Planos mensais no cartão, pelo checkout recorrente do Asaas (mesmo padrão do
Momentumm). Os pacotes avulsos de `credit_packs` continuam como créditos adicionais.

## Como funciona

1. Landing (`#precos`) lê `subscription_plans` e cada botão leva a `/assinar/<plano>`.
2. Sem login, `RequireAuth` manda para `/entrar` guardando o destino. No cadastro, o
   link de confirmação do e-mail volta para o mesmo `/assinar/<plano>`.
3. `/assinar/<plano>` chama a function `subscribe`, que cria a linha `pending` em
   `subscriptions` e o checkout recorrente, e redireciona para o Asaas.
4. O Asaas chama `asaas-webhook`. Só `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED` de uma
   cobrança de assinatura liberam: `grant_subscription_payment` ativa o plano, grava o
   fim do período e credita os créditos do mês (uma vez por cobrança, mesmo com webhook repetido).
5. A volta do checkout cai em `/conta/assinatura?retorno=...`, que consulta de novo até o
   webhook confirmar. Voltar do checkout não libera nada.

| Regra | Onde |
|---|---|
| Plano vigente = ativa, em atraso ou cancelada com período pago no futuro | `current_plan()` (0003) |
| Limite de personagens pelo plano; sem plano, `plan_settings.free_max_personas` (1) | `create_persona` (0003) |
| Créditos não vencem, acumulam (**descartado em 20/10**: vale a regra do app, crédito do plano renova e não acumula; avulso e boas-vindas não vencem. Os textos da LP já seguem o app; esta implementação sai no merge) | `credit_ledger`, sem expiração |
| Trocar de plano: limite na hora, valor e créditos novos na próxima cobrança | function `subscribe` |
| Cancelar: sem nova cobrança, plano até o fim do período, créditos ficam | function `cancel-subscription` |
| Estorno/chargeback corta o plano na hora; créditos já usados não voltam | `asaas-webhook` |

## Editar planos (admin, sem deploy)

Tudo é update em `subscription_plans` (SQL Editor do Supabase ou Table Editor):

```sql
update subscription_plans set price_cents = 6990, monthly_credits = 350 where slug = 'starter';
update subscription_plans set max_personas = 3 where slug = 'starter';
-- Benefício que ficou pronto: tirar o "soon"
update subscription_plans
set features = jsonb_set(features, '{6,soon}', 'false')
where slug = 'starter';
-- Linha da comparação: "yes", "no", "soon" ou texto livre
update subscription_plans set comparison = comparison || '{"copy": "yes"}' where slug in ('starter', 'pro', 'studio');
update plan_settings set free_max_personas = 2;
```

Preço novo vale para quem assinar depois. Para mudar o valor de quem já assina, é
preciso atualizar a assinatura no Asaas também.

## O que configurar antes de funcionar de verdade

1. `npx supabase db push` (aplica a migration `0003_subscriptions.sql`).
2. Deploy das functions:
   `npx supabase functions deploy subscribe cancel-subscription`
   `npx supabase functions deploy asaas-webhook --no-verify-jwt`
3. Segredos (os mesmos da compra avulsa): `ASAAS_API_KEY`, `ASAAS_ENV`, `ASAAS_WEBHOOK_TOKEN`, `APP_URL`.
4. No painel do Asaas, no webhook já cadastrado, ligar também: `PAYMENT_OVERDUE`,
   `PAYMENT_CHARGEBACK_REQUESTED`, `SUBSCRIPTION_DELETED`, `SUBSCRIPTION_INACTIVATED`.
5. Em Auth > URL Configuration do Supabase, incluir o domínio de produção com `/**`
   (o link de confirmação de e-mail volta para `/assinar/<plano>`).
6. Testar no sandbox do Asaas: assinar, ver o plano ativar em `/conta/assinatura`,
   repetir o evento no painel (não pode creditar duas vezes), trocar de plano, cancelar.

## Ainda não existe

- Assinatura por Pix (precisa coletar CPF; o Momentumm tem o fluxo pronto para copiar).
- Aviso por e-mail de mudança de preço.
- Painel admin com tela para editar planos (hoje é pelo Supabase).
- Recursos marcados "Em breve" (copys, Motion Control, templates, prioridade, suporte prioritário).
