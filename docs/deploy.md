# Colocar a Kria IA no ar

Ordem que funciona. Cada passo diz o que conferir antes do próximo.

## 1. Contas

1. **Supabase:** criar projeto novo (plano free serve para testar; o free pausa
   depois de 7 dias parado).
2. **fal.ai:** criar conta, colocar saldo (US$ 10 dá para testar tudo) e gerar a
   chave em *Keys*.
3. **Asaas:** usar a conta sandbox primeiro. Gerar a chave da API.
4. **Anthropic:** criar a chave em console.anthropic.com (Vynkio AI: ideias, copys e roteiros).
   Pôr um limite de gasto mensal no painel antes de abrir ao público.

## 2. Banco

```bash
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push
```

Conferir no painel: tabelas `models` (4 linhas) e `credit_packs` (3 linhas), bucket `media` privado.

**Antes de abrir para o público:** abrir `fal.ai/models/<endpoint>` de cada linha de
`models`, conferir se o endpoint ainda existe e o preço por geração, e ajustar
`credits` para manter margem de 2x a 3x. O crédito vende a R$ 0,15-0,20 (preços de 20/10 na migration 0006).

## 3. Segredos e funções

```bash
cp supabase/.env.example supabase/.env   # preencher; nunca commitar
npx supabase secrets set --env-file supabase/.env
npx supabase functions deploy generate
npx supabase functions deploy generation-status
npx supabase functions deploy buy-credits
npx supabase functions deploy fal-webhook --no-verify-jwt
npx supabase functions deploy asaas-webhook --no-verify-jwt
```

Gerar os dois segredos longos com `node -e "console.log(crypto.randomBytes(32).toString('hex'))"`.

## 4. Asaas

Painel > Integrações > Webhooks: URL `https://<ref>.supabase.co/functions/v1/asaas-webhook`,
token = `ASAAS_WEBHOOK_TOKEN`, eventos `CHECKOUT_PAID`, `CHECKOUT_EXPIRED`,
`CHECKOUT_CANCELED`, `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_REFUNDED`.

## 4b. Fase 1 (planos, admin, conta)

```bash
npx supabase functions deploy subscribe
npx supabase functions deploy cancel-subscription
npx supabase functions deploy account
npx supabase functions deploy asaas-webhook --no-verify-jwt   # de novo: agora trata assinatura
```

- **Webhook do Asaas:** além dos eventos acima, marcar `PAYMENT_OVERDUE`,
  `SUBSCRIPTION_DELETED` e `SUBSCRIPTION_INACTIVATED`.
- **Admin (para o futuro painel de operação, não há tela no app):** no SQL Editor:
  `insert into public.admin_users (user_id) select id from auth.users where email = '<seu e-mail>';`
- **pg_cron:** em Database > Extensions, ligar `pg_cron` e rodar
  `select cron.schedule('kria-expire-subscriptions', '0 3 * * *', 'select public.expire_lapsed_subscriptions()');`
  (a migration agenda sozinha se a extensão já existir). Sem o cron a expiração ainda acontece na
  próxima geração da pessoa, só o painel demora a refletir.
- **Recuperar senha (por código):** em Auth > Email Templates > Reset Password, colar o conteúdo de
  `supabase/templates/recovery.html` (assunto "Seu código do Vynkio"); ele mostra o `{{ .Token }}`, não um link.
  Em Auth > Providers > Email: OTP length 6 e OTP expiration 900 s (iguais ao `supabase/config.toml`).
  O SMTP padrão do Supabase manda poucos e-mails por hora: antes de abrir ao público, ligar um SMTP próprio
  (ex.: Resend, grátis até 3.000 e-mails por mês) em Auth > SMTP Settings.
- **Google (opcional):** Auth > Providers > Google com o client do Google Cloud; depois
  `VITE_AUTH_GOOGLE=true` no front.
- **Custos:** preencher `models.provider_cost_usd` de cada modelo conferido em `fal.ai/models/<endpoint>`
  (SQL Editor). Sem isso a margem estimada fica incompleta.

## 4c. Vynkio AI e Workspace (0009 e 0010)

Marcas, projetos e as ferramentas de texto. Detalhes e custos em `docs/vynkio-ecossistema.md`.

```bash
npx supabase db push                                   # aplica 0009_workspace e 0010_assistant
npx supabase secrets set ANTHROPIC_API_KEY=<chave>
npx supabase functions deploy assistant
npx supabase functions deploy generate                 # de novo: agora grava marca e projeto
```

- O modelo de cada ferramenta é o `endpoint` da linha em `models` (`claude-opus-5-5`) e o esforço vem de
  `defaults.effort`. Trocar modelo, esforço ou preço em créditos é `update`, sem deploy.
- Na primeira semana, conferir no painel da Anthropic o custo por pedido (a function registra os tokens
  no log como `assistant usage`) e preencher `models.provider_cost_usd` das quatro ferramentas de texto.

## 5. Front

`.env.local` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`, `npm run build`, publicar `dist/`
(Netlify ou Vercel com fallback de SPA para `index.html`). Atualizar `APP_URL` nos segredos e o
`site_url` do Auth para o domínio final.

## 6. Teste de ponta a ponta (antes de divulgar)

1. Criar conta, confirmar e-mail, ver 20 créditos.
2. Gerar uma foto (5 créditos). Ver aparecer na galeria sem recarregar.
3. Salvar como persona. Gerar "Foto com persona" e conferir se o rosto se mantém.
4. Animar com Kling. O vídeo leva de 1 a 5 minutos.
5. Forçar uma falha (prompt bloqueado pelo modelo) e ver o estorno no extrato.
6. Comprar o pacote Inicial no sandbox com Pix e ver os 100 créditos entrarem.
7. Assinar o Starter no sandbox (cartão de teste do Asaas) e ver 300 créditos do plano entrarem e o
   plano aparecer em Assinatura. Trocar para o Pro e conferir que o Starter foi cancelado no painel do Asaas.
8. Cancelar a assinatura: o plano segue até a data de renovação.
9. Pedir "Esqueci minha senha", receber o código, digitar na tela de login e trocar a senha.
10. Exportar os dados em Configurações; excluir uma conta de teste e conferir que sumiu do Auth e do Storage.
11. Trocar `ASAAS_ENV=production` e a chave de produção; repetir os passos 6 e 7 com dinheiro real.
