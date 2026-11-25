# App instalável e notificações (0043)

O Vynkio é um PWA: qualquer pessoa instala pelo navegador e abre pelo ícone, como app. Com o app
(ou o navegador) autorizado, o servidor manda notificação para a tela de bloqueio pelo Web Push.

## O que avisa

| Tópico        | Quem pode ligar                                 | Quando chega                                                         | Onde liga                         |
| ------------- | ----------------------------------------------- | -------------------------------------------------------------------- | --------------------------------- |
| `generations` | qualquer conta                                  | imagem ou vídeo ficou pronto, ou falhou (créditos devolvidos)          | `/conta/configuracoes`            |
| `sales`       | admin com `finance.view` e segundo fator (aal2) | assinatura nova, renovação, pacote de créditos e venda da loja         | `/admin/conta#notificacoes`       |

- Venda mostra o plano e o valor, nunca nome, e-mail ou CPF: tela de bloqueio é pública.
- Venda só avisa quando o pagamento foi **aplicado** (`activate_subscription_period` devolveu `activated`,
  `grant_purchase` creditou, pedido da loja passou a pago). `PAYMENT_CONFIRMED` e `PAYMENT_RECEIVED` da mesma
  cobrança não avisam duas vezes. "Leve junto" do checkout de plano entra no aviso da assinatura, sem aviso próprio.
- Geração só avisa quem fechou a geração (`complete_generation`/`fail_generation` devolveu `true`): webhook do fal e
  polling correm juntos e avisam uma vez. Se o app estiver aberto na tela, o service worker não mostra (o sino já mostra).
- Notificação nunca derruba nada: `_shared/push.ts` não lança, só registra no log.

## Peças

- Banco (0043): `push_subscriptions` (um aparelho por linha, com `topics`). O navegador grava por
  `save_push_subscription` e apaga por `remove_push_subscription`; a tabela só tem `select` do dono. O servidor lê os
  destinos por `push_targets(topic, user)` e soma falhas por `push_register_failure` (10 seguidas apagam).
  Endereço de envio só de serviço de push conhecido (`is_push_endpoint`): o servidor faz POST nele, então URL livre seria SSRF.
- Servidor: `_shared/webPush.ts` (RFC 8291 + VAPID, só WebCrypto, testado com o exemplo da RFC), `_shared/push.ts`
  (envia e limpa aparelho que saiu: 404/410), `_shared/pushMessages.ts` (textos), `asaas-webhook/notifySale.ts`,
  `_shared/settle.ts` (geração). Function `push-test`: o botão "Mandar um teste".
- Front: `public/manifest.webmanifest`, `public/sw.js` (sem cache de página, só instalação e push), ícones em
  `public/app` (`npm run pwa:icons`), `public/_headers` (sw e manifest sem cache na Netlify), `src/lib/pwa.ts`,
  `src/lib/push.ts`, `usePushNotifications`, `useInstallApp`, `PushSettings`, `InstallApp`.
- Sair da conta desinscreve o aparelho na hora (`useSession`); o servidor apaga a linha no próximo envio.

## iPhone

Só recebe notificação com o Vynkio **instalado** (Safari > Compartilhar > Adicionar à Tela de Início, iOS 16.4+) e aberto
pelo ícone. A tela explica isso sozinha. Android, Windows e Mac recebem também pelo navegador.

## Colocar no ar

1. Gerar as chaves uma vez: `npm run vapid:keys`. Trocar a chave depois desliga todos os aparelhos inscritos.
2. Segredos das functions: `npx supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:...`
3. Front: `VITE_VAPID_PUBLIC_KEY` (a mesma pública) nas variáveis da Netlify e no `.env.local`.
4. Migration: `npx supabase db query --linked -f supabase/migrations/0043_push_notifications.sql` (nunca `db push`).
5. Functions: `npx supabase functions deploy push-test`, `asaas-webhook --no-verify-jwt`, `fal-webhook --no-verify-jwt`
   e `generation-status` (as três últimas usam `settle.ts`/`notifySale.ts`).
6. Merge na main (a Netlify publica). No celular: instalar o app, entrar no admin, Conta > Notificação de venda > ligar > Mandar um teste.
