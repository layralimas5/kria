# Admin como central de inteligência (09/11/2026)

Branch `feat/admin-intelligence` (saiu da main 0a7b1e2). Migration **0025** e function **admin-users**. Nada publicado.

## O que mudou

- **Menu de perfil** no topo do admin: avatar (foto do perfil ou iniciais), nome, e-mail, papel, Meu perfil
  (`/admin/conta`), Configurações (`/admin/seguranca`), Alterar senha (`/admin/conta#senha`, Supabase Auth) e Sair.
- **Modelos e custos**: 10 indicadores com dica, alertas, tabela por modelo (provedor, modelo, categoria, tarifa,
  unidade, custo por geração, créditos, margem, usos, custo acumulado, status), filtros (período, provedor,
  categoria, modelo, status), 7 gráficos e gaveta por modelo com meta de margem, tarifa oficial, preço em
  créditos/planos e histórico de vigências. Guarda de gasto e parâmetros de preço ficaram no fim da página.
- **Analytics > Visão executiva** (aba padrão): 15 indicadores com definição, insights por regra, 8 gráficos,
  rentabilidade por plano, despesas registradas e exportação CSV (respeita os filtros). Retenção, Ferramentas e
  Créditos continuam nas outras abas.
- **Usuários**: botão "Adicionar usuário" (convite), busca, 8 filtros combináveis, ordenação (recentes, mais
  ativos, mais créditos, maior custo de IA, acesso recente), paginação e gaveta com Resumo, Gerações, Créditos,
  Plano e assinatura, Ações.

## Banco (0025)

- `ai_usage_events`: uma linha por geração que o fornecedor cobrou (sucesso ou falha cobrada), gravada por
  gatilho em `generations`. Única por geração: webhook repetido, polling e reconciliação caem na mesma linha.
  Guarda unidades, tokens, resolução, duração, créditos, custo na moeda original, câmbio da primeira gravação e
  custo em reais. Base do custo: `metered` (tokens reais × tarifa), `estimated` (tarifa × configuração) ou
  `unknown` (sem tarifa, fica fora dos totais). Nenhum fornecedor devolve hoje o valor cobrado por pedido (o fal
  não devolve custo; a Anthropic devolve tokens). Quando devolver, entra como base acima de `metered`.
  Sem chave estrangeira de propósito: o custo fica no financeiro mesmo se a conta for excluída.
  As gerações antigas entraram na aplicação da migration com o câmbio do dia.
- `model_price_history`: vigência de créditos, tarifa, custo, meta e situação de cada modelo (gatilho em `models`).
- `models.target_margin_rate`: meta por modelo (vazia = `finance_settings.min_margin_rate`).
- `plan_grants` + `effective_plan` novo: **cortesia de plano**. Ordem: assinatura paga, cortesia, Grátis. Não é
  assinatura, não entra em MRR/churn, não dá créditos de plano. É o "alterar plano" do admin: troca de plano pago
  continua só pelo checkout (Asaas).
- `operating_expenses`: despesas reais (anula com motivo, não apaga). Permissão nova `expenses.manage`
  (super_admin e finance).
- `profiles.created_by_admin`.
- Funções: `admin_ai_costs`, `admin_model_price_history`, `admin_set_model_target_margin`, `admin_business`,
  `admin_add_expense`, `admin_void_expense`, `admin_users_list`, `admin_user_profile`, `admin_grant_plan`,
  `admin_revoke_plan_grant`, `admin_check_new_user`, `admin_setup_new_user`; `admin_me` agora devolve e-mail,
  nome e foto. Todas pedem permissão + aal2 e as que alteram gravam auditoria.

## Criar usuário (function `admin-users`)

Confere tudo no banco com o JWT de quem pediu (`admin_check_new_user`), manda `inviteUserByEmail` (a pessoa
define a senha pelo link, que abre `/nova-senha`) e aplica cortesia, créditos extras e status com
`admin_setup_new_user` (só em conta criada há menos de 15 min). Papel de admin só com `admins.manage`.
Template do convite em `supabase/templates/invite.html`.

## Definições

Ficam na tela (dica de cada indicador e "Como cada número é calculado") e em `src/domain/business.ts`.
Lucro estimado = recebido − reembolsos − taxa de pagamento − custo de IA − despesas registradas no período.
Receita estimada da aba de custos = créditos consumidos × `pricing_settings.credit_value_brl` (marcada como
estimada; o recebido de fato está no Analytics).

## Para publicar (precisa da Lay)

1. Rodar `0025_admin_intelligence.sql` no SQL Editor.
2. `npx supabase functions deploy admin-users --use-api` (usa `APP_URL`, já nos secrets).
3. No painel do Auth, colar o template de convite (Email Templates > Invite user) com o assunto
   "Seu convite para o Vynkio" e conferir que `/nova-senha` está nas Redirect URLs.
4. Merge na main (a Netlify publica).

## Testes

`npm run check`: 7 testes novos do banco (consumo idempotente, câmbio fixo, vigências, filtros e permissões de
custos, cortesia, conta criada no admin, lista e perfil, negócio e despesas) e 9 unitários (alertas, métricas,
insights, CSV). Telas conferidas no modo demo, desktop e celular.
