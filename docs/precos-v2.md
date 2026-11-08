# Preços v2: Creator, Business, créditos com proteção de custo

> Continuação em `docs/precos-v3.md` (0019): tarifas oficiais, trava de custo, calculadora, vitrine no banco,
> virada com aceite de margem e volta. A virada descrita aqui ganhou novas travas lá; o roteiro que vale é o da v3.

**Data:** 07/11/2026 · **Branch:** `feat/vynkio-pricing-v2` (saiu de `feat/vynkio-notificacoes`, que leva o
Multiplicador e a guarda de gasto) · **Migration:** `0018_pricing_v2.sql`, só aditiva.

**Estado:** pronto e testado no banco (pglite) e no modo demo. **Nada foi publicado, nenhum preço novo
está à venda, nenhuma cobrança real foi criada.** Os planos v2 nascem em rascunho; a troca acontece
de uma vez, pela virada no admin, só depois de aprovar.

---

## 1. O que a auditoria encontrou

| Peça | Como estava |
|---|---|
| Planos | `subscription_plans`: Grátis (implícito, sem checkout), Starter R$ 59,90 / 300, Pro R$ 79,90 / 450, Studio R$ 149,90 / 1.000. Versão sobe quando preço ou crédito muda; a assinatura guarda o que contratou |
| Assinatura | `subscribe` cria a pendente e o checkout recorrente do Asaas, e só vende plano `active` e `public`. `asaas-webhook` (com token) chama `activate_subscription_period`, que é idempotente pelo id do pagamento, encerra o plano anterior (troca) e concede os créditos do mês. Atraso tem 3 dias de carência; o cancelamento vale até o fim do período |
| Carteira | Dois baldes (plano renova e não acumula; comprado não vence). Reserva, captura, estorno, extrato imutável. Os tipos pedidos já existiam: assinatura (`subscription_grant`), promocional (`signup_bonus`), comprado (`purchase`), reservado (`credit_reservations` com status `held`), consumido (`generation`), estornado (`generation_refund`) e expirado (`subscription_expire`) |
| IA | fal.ai (imagem e vídeo) e Anthropic (texto e Multiplicador). `models.provider_cost_usd` **nulo em todos**: o custo real nunca foi cadastrado |
| Guarda de gasto (0016) | Limite de consumo por plano (dia e mês), teto de custo da plataforma, pausa de emergência; custo sem cadastro conta no pior caso |
| Admin | Dashboard por período com MRR, recebido, custo de API e margem de contribuição simples. Sem resultado operacional, pró-labore nem rentabilidade por pessoa |
| Landing | Catálogo fixo em `src/landing/pricing/catalog.ts`, conferido contra as migrations por teste |
| Multiplicador | Pronto (0017), montagem no navegador, sem limite de exportação |
| Assinaturas ativas e legados | Nenhuma em produção: o Supabase está pausado e o checkout nunca rodou com dinheiro real. Mesmo assim, a virada trata quem já assina |

## 2. O que entrou

### Banco (0018)

| Peça | O que faz |
|---|---|
| Catálogo v2 em rascunho | Creator Start, Pro e Max; Business Start, Pro e Scale; Enterprise. `status = 'draft'`, sem checkout. Uma constraint impede plano que não está `live` de ficar público, e plano só por contato de ir ao checkout |
| Linha e situação do plano | `line` (creator, business), `status` (draft, live, legacy), `max_exports_month`, `max_seats`, `contact_only` |
| Orçamento interno de IA | `plan_cost_budgets` (R$ 10, 25, 60, 40, 100, 250), fora da tabela de planos porque ela é pública. Ninguém fora do admin lê |
| Cotação de crédito | `quote_credits`: custo (US$ × câmbio) × fator de segurança ÷ orçamento por crédito, arredondado para cima. Sem custo cadastrado, usa o preço atual × custo médio do crédito atual (R$ 0,09, a premissa da 0006). Parâmetros em `pricing_settings` (`credit_budget_brl` 0,01, `safety_factor` 1,15) |
| Conferência de preço | `models.cost_checked_at` (carimbado quando o custo muda) e `cost_source` (link da página de preço). Passou de `cost_stale_days` (30), vira alerta |
| Exportações do Multiplicador | `multiplier_exports` com começo, fim e falha (`start_` / `finish_` / `fail_multiplier_export`). Cota por plano (Grátis 3, Starter 40, Pro 150, Studio 400, e a régua v2), chave idempotente, trava por conta contra duas abas, limite de exportações simultâneas pelo `max_concurrent` do plano. Começada e largada por 30 min deixa de segurar a cota. Guarda duração, resolução, tempo de render e tamanho |
| Boas-vindas configuráveis | `pricing_settings.welcome_credits` (20 hoje) |
| Financeiro | `admin_finance(período)`: receita, reembolso, MRR, custo de API (com falha cobrada), exportações, por plano, por assinante (50 que mais custam), por modelo (com deficitárias e estimadas). `finance_settings` com tributos, fixos, infraestrutura, armazenamento, custo por exportação, pró-labore, reserva e margem mínima |
| Virada | `admin_activate_pricing_v2(boas-vindas, motivo)`. Ver seção 5 |

### Front

- **Admin → Financeiro e rentabilidade** (`/admin/financeiro`, permissão `finance.view`), em quatro abas:
  - **Resultado:** receita, custos variáveis, margem de contribuição, despesas fixas, resultado operacional, pró-labore, resultado após pró-labore, reserva e lucro potencialmente distribuível. Mais receita por plano e as premissas, que só quem tem `pricing.manage` edita.
  - **Rentabilidade:** por assinante e por modelo.
  - **Simulador:** três cenários (conservador, esperado, alto consumo) e o ponto de equilíbrio com e sem pró-labore. Tudo no navegador, nada é salvo.
  - **Créditos v2:** a cotação de cada modelo ao lado do preço atual, a conferência de preço com fonte, a política de crédito e a virada.
- **Alertas:** preço não conferido, operação deficitária, modelo que falha demais, assinante acima de 80% do orçamento, margem abaixo do mínimo, custo crescendo rápido e custo estimado.
- **Multiplicador:** reserva a exportação antes de montar e devolve se falhar ou for cancelada. Mostra a cota do mês e trava o botão quando a seleção passa do que resta.
- **Créditos (usuário):** a cota de exportações aparece junto do limite de consumo.
- **Landing:** hero novo com os dois botões, seções Creator e Business (com "Em breve" no que não existe) e FAQ com as 9 perguntas, que respondem pelas regras implementadas. Os preços v2 com abas Creator e Business, o aviso de créditos e o Pro recomendado ficam **atrás de `VITE_PRICING_V2=true`**. Sem a chave, a vitrine segue com os preços atuais. `catalogV2.test.ts` confere preço, créditos, exportações, usuários, lote, personagens, marcas e Veo contra a 0018.
- **Modo demo:** responde todas as funções novas. A virada no demo só mostra a recusa de segurança.

## 3. Decisões tomadas sem perguntar (revisar)

1. **O crédito é o orçamento.** Com R$ 0,01 de custo por crédito, os 1.000 créditos do Start cobrem no máximo R$ 10 de IA por construção, então o orçamento do plano não precisou de uma trava nova. O `ai_budget` serve para monitorar e alertar. A trava de verdade continua sendo saldo, limite de consumo e teto da plataforma.
2. **Escala nova exige converter saldos.** Os modelos passam a custar cerca de 10x mais créditos (foto 5 → 52; Kling 40 → 414; Veo 200 → 2.070; texto 3 → 32; lote do Multiplicador 8 → 83). Por isso a virada multiplica saldos, pacotes e assinaturas pelo mesmo fator (10,35), e ninguém perde poder de compra.
3. **Business fica em rascunho mesmo depois da virada.** Não existe organização com membros. Sem isso, "5 usuários" seria promessa falsa. A vitrine leva para conversa (`mailto` com `VITE_CONTACT_EMAIL`).
4. **Exportação é cota comercial, não custo.** A montagem roda no navegador e custa zero de servidor. O controle é no banco (começo e fim), mas um cliente adulterado poderia montar sem registrar. Hoje isso não custa nada ao Vynkio. Com render no servidor, a trava passa a ser real.
5. **Plano atual ganha cota de exportação já** (3, 40, 150, 400), na mesma régua do v2. O Multiplicador ainda não está publicado, então ninguém perde nada.
6. **Reconciliação de custo:** se o custo real passar do estimado, a pessoa não paga a diferença. A operação aparece como deficitária no painel e gera alerta.
7. **Custo por parâmetro:** cada modelo tem duração e resolução fixas, então um preço por modelo é exato hoje. Quando entrar escolha de duração ou resolução, a cotação passa a considerar isso.

## 4. O que depende de validação financeira antes de publicar

**a. Os planos v2 entregam menos geração por real que os atuais.** Pelo orçamento do prompt (R$ 10, 25, 60):

| | Preço | Fotos | Kling | Veo | Custo de IA no pior caso |
|---|---:|---:|---:|---:|---:|
| Starter (atual) | R$ 59,90 | 60 | 7 | 1 | 45% |
| Pro (atual) | R$ 79,90 | 90 | 11 | 2 | 51% |
| Creator Start | R$ 69,90 | 19 | 0 (sem vídeo) | 0 | 14% |
| Creator Pro | R$ 149,90 | 48 | 6 | 0 | 17% |
| Creator Max | R$ 299,90 | 115 | 14 | 2 | 20% |

A margem fica ótima, mas o Creator Pro custa quase o dobro do Pro atual e gera metade. O valor passa a
vir das exportações do Multiplicador, que custam zero. **Recomendação:** manter os preços e subir os
créditos para algo perto de 2.500 / 6.000 / 13.000. Isso levaria o pior caso a uns 36% a 43%; com uso
médio de 30% a 50%, o custo real fica bem abaixo disso. A decisão é sua. O simulador do admin já
deixa testar.

**b. A Free com 10 créditos não gera nada.** A operação mais barata custa 32 créditos (texto) e uma
foto custa 52. O painel avisa isso na hora da virada. **Recomendação:** 100 créditos (R$ 1 de
orçamento: 1 foto e 1 roteiro).

**c. O custo de cada modelo nunca foi conferido.** Toda cotação hoje é estimativa pela base de R$ 0,09.
Antes da virada:
1. Cadastre `provider_cost_usd` em Modelos e custos, conferindo `fal.ai/models/<endpoint>` e o preço da Anthropic.
2. Confirme a fonte na aba Créditos v2.

**d. Os limites de exportação não foram testados com carga real.** A landing não diz que são validados.

**e. O fator 1,15 é reserva de custo, não margem de lucro.** A rentabilidade depende da mensalidade, do
uso e dos custos fixos. Ela aparece no Resultado e no Simulador.

## 5. Roteiro da virada (só com aprovação)

Pré-requisitos: Supabase restaurado, 0016 a 0018 aplicadas, functions publicadas e custos conferidos (4c).

1. Admin → Modelos e custos → Guarda de gasto: **pausar as gerações**, com o motivo.
2. Esperar terminar o que está em andamento. Se ainda houver geração aberta, a virada recusa (`open_generations`).
3. Admin → Financeiro → Créditos v2: escolher as boas-vindas (o padrão do prompt é 10; recomendo 100), escrever o motivo e confirmar.
   - Modelos assumem a cotação.
   - Saldos, pacotes, assinaturas e planos atuais são multiplicados pelo fator, com linha no extrato e na auditoria.
   - Starter, Pro e Studio saem da vitrine, mas continuam valendo para quem assina.
   - Creator Start, Pro e Max entram à venda.
   - O pior caso da guarda passa a ser o crédito mais barato vendido.
4. Publicar o front com `VITE_PRICING_V2=true`. Se as boas-vindas não forem 10, ajustar antes `WELCOME_CREDITS_V2` em `src/landing/pricing/catalogV2.ts`.
5. Despausar as gerações.
6. Comprar um Creator Start de teste no Asaas e conferir: créditos concedidos, exportação contando, extrato.

**Não tem volta pelo painel.** Desfazer exige migration revisada. Por isso a virada pede pausa, motivo e confirmação.

## 6. O que não fazer antes da aprovação

- Publicar o front com `VITE_PRICING_V2=true`.
- Rodar `admin_activate_pricing_v2`.
- Criar produto ou plano no Asaas para os planos novos (o checkout cria a cobrança na hora, a partir do plano).
- Abrir o Business para venda antes de existir organização com membros.

## 7. Ainda não existe

- Organizações e membros (Business).
- Estimativa de custo pela API do fornecedor (hoje é tabela com data de conferência).
- Custo real pela fatura do fal e da Anthropic.
- Cota por plano de duração, resolução e tamanho de upload (os limites atuais são globais: 3 min, 500 MB, 1080p).
- Retenção de arquivos (os takes nunca sobem).
- Render no servidor.
- Alerta fora do painel (e-mail).
