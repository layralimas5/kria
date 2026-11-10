# Vynkio

SaaS de criação com IA: a pessoa cria influenciadores (personas com rosto
consistente) e gera fotos e vídeos com eles, pagando por crédito. Repositório na pasta `pessoais/kria`.

**Ecossistema (21/10/2026):** o Vynkio cresce em módulos: Studio (foto, vídeo, personagem, UGC),
Vynkio AI (ideias, copys, roteiros com Claude), Workspace (marcas, projetos, criações). Content,
Analytics e Growth são V2 e não aparecem no menu até existirem. Visão, roadmap e custos em
`docs/vynkio-ecossistema.md`.

**Marca (20/10/2026):** o produto se chama **Vynkio** ("o Vynkio"). A paleta é a da Nivora:
fundo noite `#0b0a1a`, roxo `#7c3aed` (botão e selo, texto branco), roxo claro `#a78bfa`
(texto e ícone sobre o escuro), azul `#3b82f6` (gradiente da marca) e dourado `#f5b841`
(selo TOP e destaque). Tokens em `src/index.css`. A pasta e os identificadores internos
(`kria-*` no localStorage, cron, project_id) continuam com o nome antigo.

**Landing (21/10):** vive no mesmo app, em `/` (`src/landing`), com `/termos` e `/assinar/:plan`
(ponte para o checkout; exige login). Os planos da vitrine são um catálogo fixo em
`src/landing/pricing/catalog.ts`: textos e selos ficam lá, mas preço, créditos, limite de
personagens e acesso ao Veo precisam bater com as migrations (`catalog.test.ts` falha se não
baterem). Mudou um plano no banco, muda o catálogo junto. Guia em `docs/landing.md`.
Custo por geração na vitrine: `src/landing/pricing/costs.ts` (testado contra `models`). Prints de produto
são telas reais do modo demo (`npm run landing:screens`).

## Stack

- Front: React 19 + TypeScript strict + Vite + Tailwind v4 + Framer Motion (`src/`)
- Banco/Auth/Storage: Supabase (`supabase/migrations`), RLS em tudo
- Edge functions (Deno): `supabase/functions`
- IA: fal.ai para foto e vídeo (fila assíncrona + webhook); Anthropic (Claude, SDK `@anthropic-ai/sdk` fixo
  em 0.131.0) para texto, na function `assistant`. Catálogo de modelos na tabela `models` (`kind` image, video, text)
- Pagamento: Asaas, checkout avulso Pix + cartão (mesmo padrão do Momentumm)

## Regras do domínio

- Crédito só muda por `wallet_move` (chamada pelas funções SQL `security definer`). Carteira em
  dois baldes: plano (renova, não acumula) e comprado (não expira). A geração reserva ao nascer
  (gasta o plano primeiro), captura no sucesso e devolve aos mesmos baldes na falha. Extrato imutável.
- Plano e crédito de assinatura só mudam pelo `asaas-webhook` (`activate_subscription_period`).
- Guarda de gasto (0016) dentro de `create_generation`: limite de consumo por plano (dia e mês, em créditos),
  teto de custo da plataforma (US$, dia e mês) e pausa de emergência. Custo sem `provider_cost_usd` conta no
  pior caso (todo o crédito vira custo); falha de modelo com `charges_on_failure` continua no custo. A pessoa
  vê só créditos (`my_usage`); custo fica no admin. Plano e estado em `VYNKIO_IMPLEMENTATION_PLAN.md`.
- Multiplicador (0017, `docs/multiplicador.md`): arquivos dos takes nunca sobem (ficam na aba); o lote de roteiros
  passa por `start_multiplier_batch` (plano: `max_variations`) e `complete_multiplier_batch`; variação nasce só pela
  function `multiplier`. A montagem é no navegador, quadro a quadro com WebCodecs (`src/lib/render`, `mediabunny`
  fixo em 1.61.6). Não voltar para MediaRecorder: ele perde quadro e embaralha o tempo.
- Preços v2 (0018, `docs/precos-v2.md`): Creator e Business nascem em rascunho (`status = 'draft'`, nunca `public`);
  só entram no ar por `admin_activate_pricing_v2`, que converte saldos, pacotes, assinaturas e modelos pelo mesmo fator.
  Créditos v2 = custo × câmbio × `safety_factor` ÷ `credit_budget_brl` (`quote_credits`). Orçamento de IA por plano fica em
  `plan_cost_budgets` (admin), nunca na tabela pública de planos. Exportação do Multiplicador conta por `start_`/`finish_`/
  `fail_multiplier_export` (`max_exports_month`). A vitrine v2 só aparece com `VITE_PRICING_V2=true`, junto com a virada.
  Financeiro e simulador em `/admin/financeiro`; as contas ficam em `src/domain/finance.ts`.
- Preços v3 (0019, `docs/precos-v3.md`): custo de cada modelo sai da tarifa oficial em `models.pricing` (imagem, segundo
  ou token) × `defaults` (`operation_cost_usd`); sem tarifa ou volume, o custo fica nulo, nunca inventado. Tarifa muda por
  `admin_set_model_tariff` (confere a data e, depois da virada, recalcula créditos só dos pedidos novos). Com
  `require_trusted_cost` (ligado na virada), modelo sem custo confiável não gera (gatilho `generations_cost_policy`).
  Texto grava tokens reais por `record_text_usage`. Boas-vindas só com e-mail confirmado, uma vez por e-mail normalizado
  (`welcome_grants`). A vitrine lê `storefront_plans`: nenhum preço mora no front. Margem por plano = `plan_full_use_margin`
  (mesma conta de `src/domain/planEconomics.ts`); calculadora em `/admin/financeiro?aba=calculadora` só salva rascunho.
  Virada abaixo da meta exige `finance.override`; `admin_rollback_pricing_v2` desfaz enquanto ninguém assinar plano novo.
- O painel do usuário não tem nada de admin (nem link no menu). A operação fica em `/admin`, com moldura
  própria, fora do `AppShell`; só abre para quem está em `admin_users`. Cada função `admin_*` chama
  `assert_admin_permission('x')` (papel + sessão aal2, 0014) e grava `admin_audit_logs`, que é imutável.
  Permissão nova entra em `admin_role_permissions`, nunca só no front. Diagnóstico e etapas em `docs/admin.md`.
- Central de inteligência (0025, `docs/admin-inteligencia.md`): custo de IA vem de `ai_usage_events` (uma linha por
  geração cobrada, por gatilho; base `metered`/`estimated`/`unknown`, câmbio da primeira gravação). Nunca somar custo
  direto de `generations` em tela nova. Preço de modelo tem vigência em `model_price_history`. "Alterar plano" no admin
  é cortesia (`plan_grants`, lida por `effective_plan` depois da assinatura paga): não mexe em assinatura, MRR nem
  créditos. Conta nova pelo admin só por convite (function `admin-users`), nunca com senha definida pelo admin.
  Lucro estimado só desconta despesas lançadas em `operating_expenses`.
- Central de comando (`/admin`, 0026, `docs/central-de-comando.md`): toda definição de número fica em
  `src/domain/commandCenter.ts`; a tela só desenha. Sem base, o valor é nulo e aparece "Dados insuficientes";
  projeção e simulação levam selo. Indicador novo entra numa das sete seções da central, não em página nova.
- Central financeira (Financeiro > Central financeira, 0029, `docs/central-financeira.md`): toda movimentação
  sai de `finance_movements`; filtro novo entra em `finance_row_passes` e vale ao mesmo tempo para indicador,
  gráfico e tabela. Receita só de pagamento confirmado; lucro fica "Provisório" enquanto faltar custo registrado.
- Ferramenta que ainda não existe aparece como "Breve", sem link nem botão.
- Persona nasce só de imagem gerada aqui (`create_persona`). Sem upload de foto:
  é o que impede deepfake de pessoa real. Não abrir upload sem moderação de rosto.
- Webhook do fal não confia no corpo: confere a assinatura HMAC do id e consulta o fal.
- Trocar modelo ou preço = `update public.models`. Não precisa de deploy.
- Texto passa pelo mesmo motor: `create_generation` reserva, `complete_text_generation` captura, `fail_generation`
  estorna. O resultado é JSON (título + itens) em `generations.output_text`. Galeria e Studio leem só `MEDIA_KINDS`.
- Marca (`brands`) é o contexto das ferramentas de texto; geração e projeto só apontam para marca do mesmo dono
  (triggers da 0009). Limite de marcas = `subscription_plans.max_brands`; projetos = ferramenta `projects` (Studio).
- Ligação entre módulos é pela URL: `?marca=`, `?projeto=`, `?briefing=` (assistente) e `?prompt=` (Studio).
- O Vynkio AI não promete resultado, não inventa depoimento nem número (regras no `SYSTEM_PROMPT`).
- O que cada plano libera vem de `subscription_plans` (0005): `max_personas`, `tools` (abas do menu: quem não tem
  não vê a aba) e `models.allowed_plans`. Segue a tabela de planos da landing; mudar = `update`, sem deploy.

## Comandos

- `npm run dev` (porta 5231)
- `npm run dev:demo`: backend falso no navegador (`src/demo`), sessão aberta, gerações que terminam sozinhas. Nada vai ao Supabase
- `npm run demo:assets`: regenera as mídias ilustrativas de `public/demo`
- `npm run check`: tipos do front e das functions, testes unitários e testes do banco (pglite, sem Docker)
- `npm run billing:image`: regenera o ícone e a imagem do checkout

Deploy e primeiros passos: `docs/deploy.md`. Escopo e próximas fases: `docs/escopo.md`.
Relatório da Fase 1 (planos, carteira, admin): `docs/fase-1.md`.
