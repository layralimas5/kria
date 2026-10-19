# Fase 1: núcleo do SaaS (relatório)

Branch `feat/saas-core`, saiu de `feat/mvp`. Nada do que já funcionava foi trocado: o mesmo
Supabase, o mesmo Asaas, o mesmo fal.ai e o mesmo modo demo.

> **19/10:** o painel `/admin` saiu do app, que é só o painel do usuário. As funções `admin_*` e a
> auditoria continuam no banco (testadas) para um painel de operação separado.

## 1. Funcionalidades implementadas

| Área | O que entrou |
|---|---|
| Auth | Recuperar senha (`/recuperar-senha` e `/nova-senha`), login com Google atrás de `VITE_AUTH_GOOGLE`, exportar dados e excluir conta. O cadastro, a verificação de e-mail e a proteção de rotas já existiam |
| Onboarding | Pergunta do objetivo no primeiro acesso (`/boas-vindas`); a resposta ordena os atalhos do início e pode ser trocada em Configurações |
| Dashboard | `/inicio` com "O que vamos criar hoje?": saldo (separado em plano e comprado), plano atual, gerações em andamento, criação rápida, criações recentes, personagens, modelos (com cadeado quando o plano não libera), os mais usados e novidades |
| Sidebar | Menu completo do prompt. Motion Control, UGC, Copys, Prompts e Projetos aparecem como "Breve", sem link e sem botão |
| Planos | Starter R$ 59,90 / 300, Pro R$ 79,90 / 700, Studio R$ 149,90 / 1.500 e o Grátis implícito. Preço, créditos, limite de gerações simultâneas e "ativo" editáveis no admin, com versão |
| Assinatura | Checkout recorrente no cartão pelo Asaas, troca de plano, cancelamento (vale até o fim do período), estados pendente/ativa/em atraso/cancelada/encerrada, histórico de pagamentos com link da fatura |
| Carteira | Balde do plano (renova e não acumula) e balde comprado (não expira). A geração gasta o do plano primeiro |
| Créditos | Reserva atômica na criação da geração, captura no sucesso e devolução aos mesmos baldes na falha; chave idempotente por pedido; extrato imutável com saldo depois de cada movimento |
| Admin | `/admin` com visão geral (usuários, MRR, receita por plano, assinaturas e cancelamentos, gerações, erros por modelo, custo de API, taxas e margem estimadas, alerta de prejuízo), usuários (busca, histórico, ajuste de crédito com motivo, suspensão), planos, modelos e preços (custo real, preço sugerido, margem, planos liberados) e auditoria |
| Segurança | Conta suspensa não gera, não compra e não assina; custo do fornecedor fora do alcance do cliente; toda função de admin confere `is_admin()` no banco e grava auditoria |

## 2. Arquivos alterados

- Banco: `supabase/migrations/0003_ledger_reasons.sql`, `0004_saas_core.sql`; testes em `supabase/tests/credits.mjs`
- Functions novas: `subscribe`, `cancel-subscription`, `account`. Alteradas: `generate` (idempotência), `buy-credits` (suspensão), `asaas-webhook` (assinatura). Compartilhado: `_shared/billing.ts` (+ teste), `_shared/asaas.ts`, `_shared/http.ts`
- Front, páginas: `HomePage`, `OnboardingPage`, `SubscriptionPage`, `AdminPage`, `ForgotPasswordPage`, `ResetPasswordPage`; alteradas `LoginPage`, `CreditsPage`, `AccountSettingsPage`, `PersonasPage`
- Front, componentes: `home/*`, `billing/*`, `admin/*`, `auth/AuthCard`, `account/GoalSelect`, `account/PrivacyActions`, `OnboardingGate`, `layout/*`
- Front, domínio e dados: `domain/plans.ts`, `domain/pricing.ts`, `domain/goals.ts` (+ testes), `lib/adminApi.ts`, `hooks/useAccount.tsx`, `hooks/useIdempotencyKey.ts`, `hooks/useBalance.tsx`
- Demo: `src/demo/*` responde às tabelas, RPCs e functions novas

## 3. Tabelas e migrations

Novas: `pricing_settings`, `subscription_plans`, `subscriptions`, `subscription_payments`,
`credit_reservations`, `user_preferences`, `admin_users`, `admin_audit_logs`.
Alteradas: `credit_balances` (baldes), `credit_ledger` (baldes, saldo depois, chave idempotente,
quem ajustou; imutável), `generations` (chave idempotente, custo do fornecedor), `models`
(fornecedor, custo, planos liberados), `profiles` (suspensão).

Nomes do prompt que já existiam com outro nome e foram mantidos: `credit_packages` = `credit_packs`,
`credit_purchases` = `purchases`, `payment_events` = `billing_events`, `ai_models` + `model_pricing`
= `models` + `pricing_settings`, `credit_wallets` = `credit_balances`.

## 4. Integrações funcionais

- **Asaas:** pacote avulso (já existia) e assinatura recorrente no cartão (nova). Código pronto e
  com teste da lógica do webhook, **ainda sem teste no sandbox**: a conta não foi criada.
- **fal.ai:** a mesma integração de antes, agora com idempotência. **Sem teste real**: falta a `FAL_KEY`.
- **Supabase Auth:** recuperar senha usa o fluxo nativo. Google depende de configurar o provedor.

## 5. Variáveis de ambiente

Nenhum segredo novo nas functions (as mesmas: `FAL_KEY`, `WEBHOOK_SECRET`, `ASAAS_API_KEY`,
`ASAAS_ENV`, `ASAAS_WEBHOOK_TOKEN`, `APP_URL`). No front, opcional: `VITE_AUTH_GOOGLE=true`.

## 6. Testes realizados

- `npm run db:test`: 32 testes num Postgres real (pglite) cobrindo:
  - baldes e reserva
  - idempotência
  - extrato imutável
  - renovação sem acúmulo
  - troca de plano
  - expiração e cancelamento
  - atraso
  - plano exigido por modelo
  - suspensão
  - funções de admin barradas para quem não é admin
  - ajuste auditado e sem saldo negativo
  - RLS
  - o cliente não chama função de crédito nem lê custo
- `npx vitest run`: 49 testes, entre eles a decisão do webhook do Asaas, a regra do plano em vigor, o preço sugerido e a margem.
- Typecheck do front e das functions, `npm run build`.
- Navegador (Playwright, modo demo, 1440px e 390px): todas as telas novas sem erro de console e sem rolagem horizontal. Fluxos clicados de ponta a ponta:
  - onboarding personaliza os atalhos
  - trocar para o Studio credita 1.500 do plano
  - cancelar mantém o plano até o fim do período
  - o ajuste no admin bloqueia saldo negativo, aplica e aparece na auditoria

## 7. Pendências

1. **Criar Supabase, fal.ai e Asaas** (`docs/deploy.md`). Sem isso nenhum critério de "API real" fecha.
2. **Conferir o custo real de cada modelo** no fal e lançar no admin. Atenção à margem com o
   crédito mais barato (Studio, R$ 0,10): um vídeo caro cobrado em créditos fixos pode dar prejuízo
   nesse plano. O admin mostra a margem assim que o custo é preenchido.
3. Assinatura só no **cartão** (o checkout recorrente do Asaas não aceita Pix). Pix recorrente pede
   CPF e um fluxo próprio, como no Momentumm.
4. Reembolso de mensalidade não tira crédito sozinho: fica marcado para revisão manual.
5. Rate limit é por regra de negócio (checkouts por hora, gerações simultâneas por plano). Limite por
   IP fica para quando houver um gateway na frente.
6. Política de privacidade e termos do app (a landing tem um rascunho em `/termos`).
7. Veo 3.1 image-to-video tem descontinuação anunciada para 17/11/2026: trocar o endpoint antes.

## 8. Próxima fase recomendada

Fase 2, nesta ordem:
1. Subir a infraestrutura e testar a Fase 1 no sandbox.
2. Custo dinâmico por parâmetro (duração, resolução).
3. Proporção e quantidade no estúdio de imagem.
4. Copy com Claude.
5. Projetos e pastas.
