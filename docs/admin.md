# Vynkio: sistema administrativo

Diagnóstico e plano de 23/10/2026 para o prompt "Sistema administrativo Vynkio". A operação vive
em `/admin`, com moldura própria e fora do painel do usuário. Regra de tudo: o banco barra, o
front só decide o que mostrar. Nada aqui inventa número: sem registro, a tela fica vazia e diz isso.

---

## 1. Arquitetura encontrada

| Pergunta do prompt | Resposta |
|---|---|
| Framework | React 19 + TypeScript strict + Vite + Tailwind v4 + Framer Motion |
| Autenticação | Supabase Auth (e-mail e senha, Google opcional, recuperação por código) |
| Banco | Postgres do Supabase, RLS em todas as tabelas, dinheiro e crédito só por funções `security definer` |
| Usuários | `auth.users` + `profiles` (suspensão em `profiles.suspended_at`) |
| Planos e assinaturas | `subscription_plans` (versão sobe quando preço ou crédito muda), `subscriptions`, `subscription_payments`; muda só pelo `asaas-webhook` |
| Pagamento | Asaas: assinatura no cartão, pacote avulso por Pix e cartão (`purchases`), eventos em `billing_events` |
| IA | fal.ai (foto e vídeo, fila + webhook HMAC) e Anthropic (texto). Catálogo em `models` com `provider`, `endpoint`, `credits`, `provider_cost_usd`, `allowed_plans`, `options` |
| Gerações | `generations` (image, video, text; queued, running, succeeded, failed) guarda crédito, custo do fornecedor da hora e erro |
| Créditos | Dois baldes em `credit_balances`, reserva em `credit_reservations`, extrato imutável `credit_ledger` com chave idempotente. Já cumpre o livro-razão do item 7 |
| Admin que já existia | `admin_users`, `admin_audit_logs` e funções `admin_*` (busca, ajuste de crédito, suspensão, plano, modelo, preço) com tela em abas |
| Design system | Tokens em `src/index.css` (noite, roxo, azul, dourado), `ui/Button`, `Field`, `Notice`, `EmptyState`, `Spinner` |

## 2. O que já tem dado real e o que não tem

| Módulo do prompt | Dado disponível hoje | Falta para existir de verdade |
|---|---|---|
| Dashboard executivo | Cadastros, gerações, créditos, receita recebida, MRR, assinaturas, cancelamentos, custo de API estimado | Último acesso (o Supabase guarda `last_sign_in_at`, mas login não é uso) |
| Usuários | Perfil, saldo, plano, gerações, extrato, pagamentos | Observações internas, bloqueio por ferramenta, revogar sessão de terceiro |
| Créditos | Extrato imutável completo | Validade configurável, créditos promocionais com campanha |
| Gerações | Status, modelo, crédito, custo, erro | Estados "cancelada" e "na fila" separados, tentativas, latência, histórico de status |
| Ferramentas | `subscription_plans.tools` e `models.active` | Tabela de ferramentas com feature flag conferida no servidor |
| Provedores de IA | `models.provider` | Latência, último erro por provedor, saldo (o fal não expõe saldo por API pública) |
| Planos | Tudo, com versionamento | Preço anual (não existe cobrança anual no Asaas hoje) |
| Assinaturas e pagamentos | Status, períodos, pagamentos confirmados | Reembolso e chargeback do Asaas (o webhook ainda não grava esses eventos) |
| Financeiro | Recebido, MRR, custo de API estimado, taxa estimada | Custos fixos lançados, conciliação com fatura do fal e da Anthropic |
| Analytics e funil | Cadastro, onboarding, primeira geração, pagamento | Visitantes da landing (GA4 desligado até `VITE_GA_MEASUREMENT_ID`), UTMs, retenção D1/D7/D30 precisa de eventos de uso |
| Suporte, cupons, comunicados | Nada | Tabelas novas |

## 3. Etapa 1: fundação (entregue em 23/10, branch `feat/vynkio-admin`)

**Banco, migration `0014_admin_foundation`:**

- Papéis `super_admin`, `admin`, `support`, `finance`, `analyst` em `admin_users.role`. A matriz de
  permissões fica numa função só (`admin_role_permissions`); o painel lê o resultado por `admin_me()`.
- Toda função `admin_*` chama `assert_admin_permission('x')`: sem acesso dá `forbidden`, sem segundo
  fator dá `mfa_required`. O segundo fator vem do claim `aal` do JWT (aal2 = senha + autenticador).
- Pagamentos no detalhe do usuário e o bloco financeiro do dashboard só voltam para quem tem `finance.view`.
- Administradores: `admin_list_admins`, `admin_set_role` (por e-mail), `admin_remove_admin`. Só super
  admin, nunca na própria conta, sempre sobra um super admin, tudo com motivo e auditoria. O cliente
  continua sem permissão de escrita em `admin_users`.
- Auditoria imutável (trigger), com `entity` (derivada da ação) e `result`. A única mudança aceita é o
  autor virar nulo quando a conta dele é excluída.
- `admin_dashboard(from, to)`: números do período em dias de Brasília, comparação com o período anterior
  e série diária. `admin_overview` saiu (substituído); `admin_pricing` alimenta a tela de modelos.
- `pricing_settings.payment_fee_rate` (3,5%): taxa estimada do gateway até conciliar com o Asaas.

**Front:**

- `/admin` com sidebar por grupo (Visão geral, Operação, Comercial, Relacionamento, Sistema). Item sem
  tela aparece como "Breve", sem link. Item sem permissão some.
- Porta (`AdminRoot`): confere `admin_me`, pede cadastro do autenticador (QR code) ou o código, e só
  então abre. Sessão cai depois de 30 minutos parada. "Sair de todos os dispositivos" em Segurança.
- Dashboard com filtro (hoje, ontem, 7, 30, 90 dias, personalizado até um ano), alertas, indicadores de
  usuários, receita e IA, seis gráficos com tooltip por mouse e teclado e tabela, ativação, uso por
  modelo, receita por plano e maiores consumidores. Definições de cada número no rodapé da página.
- Usuários, Planos, Modelos e custos e Auditoria viraram páginas. Ação só aparece para quem pode e
  passa por confirmação. Avisos de sucesso em toast.

**Testes:** 12 unitários (`src/domain/adminDashboard.test.ts`: períodos, indicadores, alertas) e 5 de
banco novos (matriz de papéis, aal1 barrado, papel e auditoria, auditoria imutável, números do
dashboard conferidos contra o banco). `DB_TEST_ONLY="admin|dashboard" npm run db:test` roda só esses.

### Para ligar no Supabase de verdade

1. Aplicar as migrations 0011 a 0014 (`npx supabase db push`, depois do `npx supabase login`).
2. Conferir em Authentication, Multi-Factor que o TOTP está ligado (já vem ligado; o `config.toml` repete).
3. Virar admin: no SQL Editor, `insert into admin_users (user_id, role) values ('<seu user id>', 'super_admin');`
4. Abrir `/admin`, escanear o QR code e confirmar o código. Daqui em diante, mais gente entra por Administradores.
5. Perdeu o autenticador: apagar o fator em Authentication, Users, a conta, MFA. O próximo acesso cadastra outro.

## 4. Próximas etapas

Cada uma termina com `npm run check` verde e as telas conferidas no demo, como a etapa 1.

| Etapa | Entrega | Banco |
|---|---|---|
| 2. Operação | Usuários em tabela paginada com filtros, perfil individual completo (receita, custo e margem por conta), observações internas, revogar sessões de terceiro, Gerações com detalhe e reprocesso seguro, Ferramentas com feature flag no servidor, Provedores com erro e latência, Créditos | `admin_notes`, `tools` (flag lida por `create_generation`), `generation_events` (histórico de status e tentativas), latência em `generations` |
| 3. Comercial | Planos com criar e desativar, Assinaturas por status e renovação, Pagamentos com reembolso e chargeback vindos do webhook, Financeiro com custos lançados e margem por plano | `operating_costs`, eventos de reembolso no `asaas-webhook` |
| 4. Produto | Analytics, funil com visitantes da landing, retenção D1/D7/D30, métricas por ferramenta, alertas configuráveis | `product_events` (cadastro, primeira geração, abandono), `alert_rules` |
| 5. Crescimento | Suporte com tickets, cupons sincronizados com o Asaas, campanhas de crédito, comunicados no app, relatórios CSV, configurações gerais | `support_tickets`, `coupons`, `announcements`, `platform_settings` |

## 5. Decisões tomadas sem perguntar (revisar)

- MFA obrigatório para todo papel, não opcional. Sem ele o painel não responde.
- O papel Admin não vê financeiro e não mexe em plano nem em preço; Financeiro e Analista não alteram nada.
- "Ativo" é quem gerou alguma coisa na janela. Login sem uso não conta.
- MRR inclui assinatura em atraso (ainda na carência) e exclui a cancelada que segue valendo até o fim do período.
- Tentativa negada não fica na auditoria: a recusa desfaz a transação inteira. Para registrar tentativa
  negada é preciso uma edge function que grave fora da transação (etapa 2).
