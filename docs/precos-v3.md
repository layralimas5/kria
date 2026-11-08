# Preços v3: precificação, créditos dinâmicos e rentabilidade

Branch `feat/vynkio-pricing-v2`, migration `0019_pricing_v3.sql`. Continua a v2 (`docs/precos-v2.md`): nada da v2 foi
recriado, e nada aqui foi publicado, cobrado ou migrado. Os planos v3 estão em rascunho, e a virada continua dependendo
de aprovação explícita.

## 1. Arquitetura financeira encontrada

- **Carteira (0004):** dois baldes, plano (renova) e comprado (não expira). Crédito só muda por `wallet_move`, o
  extrato é imutável, a geração reserva ao nascer, captura no sucesso e estorna na falha. Idempotência por chave.
- **Guarda de gasto (0016):** limite de consumo por plano (dia e mês), teto de custo da plataforma em US$ e pausa de
  emergência. Custo sem `provider_cost_usd` entra no pior caso.
- **Preços v2 (0018):**
  - Creator e Business em rascunho e cotação `quote_credits` (custo × câmbio × 1,15 ÷ R$ 0,01).
  - Orçamento interno por plano em `plan_cost_budgets` e cota de exportação do Multiplicador.
  - `admin_finance` e a virada `admin_activate_pricing_v2`, com fator de 10,35.
  - A vitrine v2 era um catálogo fixo no front.
- **O que faltava:**
  - Nenhum modelo tinha custo do fornecedor cadastrado.
  - O custo de texto nunca era medido: o uso de tokens ia só para o log.
  - Não havia tarifa por configuração (duração, áudio, resolução).
  - Modelo sem custo continuava gerando.
  - A vitrine não lia o banco.
  - A virada não tinha volta.
  - As boas-vindas não tinham proteção contra conta repetida.

## 2. O que entrou

### Banco (0019, só acrescenta)

- **Tarifa por modelo (`models.pricing`):**
  - Formato na unidade do fornecedor: por imagem (com multiplicador de resolução), por segundo (com e sem áudio) ou por token (entrada, saída e volume por operação).
  - `operation_cost_usd(pricing, defaults)` calcula o custo de uma operação. Quando a conta não fecha, devolve nulo, sem inventar valor.
  - `valid_pricing` recusa tarifa malformada.
- **Tarifas oficiais cadastradas** (lidas em 07/11/2026). A conferência fica em aberto até o admin confirmar no painel.
- **Trava de custo** (`generations_cost_policy`, gatilho antes do insert, na mesma transação do `create_generation`):
  - Com `require_trusted_cost` ligado, modelo sem custo confiável recusa com `model_cost_unverified`. Confiável significa tarifa, custo, conferência dentro do prazo e preço sem mudança no fornecedor.
  - Custo acima de `max_operation_cost_usd` (US$ 5) recusa sempre, com `operation_cost_above_cap`.
  - A reserva é desfeita junto.
  - A trava fica desligada até a virada, e o produto de hoje não muda.
- **Custo efetivo do texto:**
  - `record_text_usage` grava tokens e custo real.
  - O cache de prompt entra com o peso cobrado pela Anthropic: escrita a 1,25×, leitura a 0,1×.
  - O custo real passa a valer na guarda de gasto (`spend_usd`). Os créditos cobrados não mudam: nada é retroativo.
- **Tarifa pelo painel (`admin_set_model_tariff`):**
  - Valida a tarifa, recalcula o custo e confere a data.
  - Depois da virada, recalcula os créditos dos pedidos novos. O que já foi autorizado mantém o custo e os créditos gravados na geração.
  - Fica na auditoria.
- **Checagem no fornecedor (`admin_record_price_check` + function `pricing-check`):**
  - Consulta a API de preço do fal, que só lê e não gera nada.
  - Preço diferente do guardado marca o modelo como não confiável. Com a trava ligada, ele para de gerar até a tarifa ser revista.
- **Boas-vindas protegidas:**
  - Só com e-mail confirmado: no cadastro para Google, ou no clique do link.
  - Uma vez por e-mail normalizado: Gmail sem pontos e sem `+apelido`. Apagar a conta e voltar não dá crédito de novo.
  - Teto de contas novas por dia (`welcome_daily_cap`, 300).
  - Contas que já existem entram na lista sem receber crédito nenhum.
  - Valor da virada: `next_welcome_credits` = 100.
- **Proposta v3 nos rascunhos:**
  - Creator Start R$ 79,90 / 2.500, Creator Pro R$ 169,90 / 6.000 (destaque), Creator Max R$ 349,90 / 13.000.
  - Orçamento interno = créditos × R$ 0,01.
  - Business sem mudança de preço, só por contato.
  - Os textos da vitrine não repetem números; o Free ganhou texto próprio de vitrine (`storefront_features`), sem mudar o que o app mostra hoje.
- **Vitrine no banco (`storefront_plans`, leitura pública):**
  - Mostra o Free, o Business por contato e, só depois da virada, os Creator à venda. Rascunho de venda direta nunca aparece.
  - Sem orçamento e sem custo.
- **Economia por plano:**
  - `plan_full_use_margin`: margem de contribuição com o plano usado por inteiro, na escala certa (crédito antigo vale R$ 0,09 × 1,15).
  - `admin_plan_economics`: alimenta a calculadora.
  - `admin_update_draft_plan`: só rascunho, com motivo e na auditoria.
- **Checagem da virada (`admin_pricing_v2_preflight`):**
  - Saldos por balde, antes e depois, e boas-vindas já dadas.
  - Reservas abertas e gerações em andamento.
  - Assinaturas por plano, pacotes e impacto por modelo, incluindo o desvio do poder de compra.
  - Margem dos planos novos.
- **Virada com travas novas:**
  - Todo modelo ativo com custo confiável (`unverified_models`).
  - Margem abaixo da meta só com aceite explícito e a permissão `finance.override` (só `super_admin`), registrada na auditoria com os planos afetados.
  - Foto de tudo em `pricing_v2_snapshots`. Liga a trava de custo.
- **Volta da virada (`admin_rollback_pricing_v2`):**
  - Divide os saldos pelo mesmo fator, arredondando a favor da pessoa.
  - Devolve modelos, planos, pacotes, assinaturas e parâmetros à foto.
  - Fica travada se alguém já assinou um plano novo.
- **Premissas novas:** taxa fixa por cobrança, armazenamento, transferência e outros custos variáveis por assinante. A meta de margem passou para 60%.

### Admin, Financeiro

- **Calculadora de planos** (`?aba=calculadora`):
  - Entradas: preço, créditos, exportações, orçamento de IA, custo médio por geração, utilização, taxas, tributos, renderização, armazenamento, transferência, outros custos e a meta.
  - Mostra uso esperado ao lado do uso integral: receita, orçamento máximo de IA, custo variável, valor restante, margem, folga sobre a meta e reserva de segurança.
  - Calcula os créditos máximos e o preço mínimo para a meta, e as gerações por modelo, com a diferença contra o salvo.
  - Só salva rascunho. Salvar abaixo da meta pede confirmação.
- **Resultado:**
  - Créditos consumidos.
  - Destaque dos planos abaixo da meta.
  - Comparativo plano atual × proposta v3 × recomendação calculada.
  - Margem no uso integral por plano.
  - Seção do Multiplicador: concluídas, falhas, montagem média, duração, MB, resoluções e custo estimado.
- **Rentabilidade:** custo por fornecedor e, por modelo, previsto × real e o número de operações reconciliadas.
- **Simulador:**
  - Cenários de 25%, 60% e 100%. No de 100% todo benefício é usado, créditos e exportações, qualquer que seja o perfil.
  - Cinco perfis: imagens, vídeos, Multiplicador, misto e premium.
  - Inclui armazenamento e transferência por GB, taxa fixa, custos fixos, aquisição, suporte e pró-labore.
  - Começa pelos rascunhos do banco.
- **Preços e créditos:**
  - Tabela de cotação com tarifa e situação do custo.
  - Formulário de tarifa com prévia ao vivo do custo e dos créditos.
  - Conferência, checagem no fal, proteções e política de crédito.
  - Checagem da virada, virada e volta.

### Functions

- `assistant` e `multiplier` gravam o uso real (`recordUsage`). Se a gravação falhar, a entrega não cai: o erro vai para o log.
- `pricing-check` é nova. Roda como a pessoa logada, então a permissão é conferida no banco. Precisa de `FAL_KEY`.
- Mensagens novas para `model_cost_unverified` e `operation_cost_above_cap`.

### Landing

- A vitrine com a chave `VITE_PRICING_V2=true` lê `storefront_plans`. Sem preço no front, com estados de carregamento e erro.
- `catalogV2.ts` saiu.
- O aviso de créditos é o texto aprovado: "Cada ferramenta de IA consome uma quantidade de créditos conforme o modelo e as configurações escolhidas. O custo em créditos é informado antes de cada geração."
- O número de boas-vindas dos textos fixos (100) é conferido contra a 0019 em teste.

## 3. Custos confirmados (páginas oficiais, 07/11/2026)

| Modelo (slug) | Identificador | Operação | Tarifa oficial | Unidade | Configuração usada | Custo por operação | Créditos v2 |
|---|---|---|---|---|---|---:|---:|
| foto | fal-ai/nano-banana-2 | texto para imagem | US$ 0,08 (0,5K 0,75×; 2K 1,5×; 4K 2×; busca na web +US$ 0,015) | imagem | 1 imagem, 1K | US$ 0,08 | 52 |
| foto-persona, foto-edicao | fal-ai/nano-banana-2/edit | edição | US$ 0,08 (2K 1,5×; 4K 2×) | imagem | 1 imagem, 1K | US$ 0,08 | 52 |
| video-kling | fal-ai/kling-video/v3/standard/image-to-video | imagem para vídeo | US$ 0,084/s sem áudio; 0,126/s com áudio; 0,154/s com controle de voz | segundo | 5 s, com áudio | US$ 0,63 | 406 |
| video-veo | fal-ai/veo3.1/image-to-video | imagem para vídeo | US$ 0,20/s sem áudio; 0,40/s com áudio (720p e 1080p); 4K 0,40/0,60 | segundo | 8 s, 720p, com áudio | US$ 3,20 | 2.061 |
| copy, roteiro, ideias, ugc-roteiro, planejamento, multiplicador | claude-opus-5-5 | texto | US$ 4 entrada; US$ 20 saída; cache: escrita 1,25×, leitura US$ 0,20 | milhão de tokens | effort low, saída até 8.000 tokens | depende do volume | depende |

Créditos v2 = custo × 5,60 × 1,15 ÷ R$ 0,01, arredondado para cima. Fontes:
- Página de cada modelo em `fal.ai/models/<identificador>`.
- Preços da Anthropic na tabela de 06/10/2026.
- API de preço do fal: `GET https://api.fal.ai/v1/models/pricing`.

## 4. Custos ainda desconhecidos

- **Tokens por operação de texto:** nunca foram medidos. A tarifa está cadastrada, mas o volume não. Por isso o texto fica sem
  custo confiável e trava a virada. A partir do deploy, cada geração grava os tokens. Medir pede gerações reais, que são
  pagas e precisam de autorização (cerca de US$ 0,03 a 0,08 cada). Exemplo de impacto: com 4.000 tokens de entrada e
  3.000 de saída, o copy custa US$ 0,076, ou 49 créditos v2. Hoje ele cobra 3 créditos antigos, o que equivale a cerca de
  31 créditos v2: o texto está barato demais se o volume for esse.
- **Câmbio:** `usd_brl` está em 5,60. Precisa ser atualizado no dia da virada.
- **Asaas:** a taxa configurada é 3,5%. A tarifa real do cartão e uma eventual parte fixa por cobrança não foram conferidas no contrato.
- **Tributos:** 6% é a premissa inicial. Confirmar com a contabilidade.
- **Armazenamento e transferência (Supabase):** sem fatura medida. Os campos existem e estão zerados.
- **Renderização do Multiplicador:** zero de servidor, porque a montagem roda no navegador e o arquivo não sobe. Vira custo só se a montagem for para servidor.
- **Fatura real do fal por pedido:** a API `billing-events` exige uma chave com permissão de faturamento. A reconciliação de foto e vídeo hoje usa a tarifa, sem a fatura.

## 5. Créditos recomendados por plano

A meta é 60% de margem de contribuição com o plano usado por inteiro, contando a reserva de segurança como gasta.
Premissas: gateway 3,5%, tributos 6%, R$ 0,01 de orçamento por crédito, render, armazenamento e transferência zerados.

| Plano | Preço | Proposta v3 | Margem integral | Máximo para 60% | Recomendado | Margem integral | Preço mínimo para manter a proposta |
|---|---:|---:|---:|---:|---:|---:|---:|
| Creator Start | R$ 79,90 | 2.500 | 59,2% | 2.436 | **2.400** | 60,5% | R$ 81,97 |
| Creator Pro | R$ 169,90 | 6.000 | 55,2% | 5.181 | **5.100** | 60,5% | R$ 196,73 |
| Creator Max | R$ 349,90 | 13.000 | 53,3% | 10.671 | **10.600** | 60,2% | R$ 426,23 |
| Free | R$ 0 | 100 de boas-vindas, uma vez | | | 100 | | |

Recomendação: manter os preços e usar 2.400, 5.100 e 10.600. Para manter 2.500, 6.000 e 13.000 com a meta, os preços
precisariam ir a R$ 81,97, R$ 196,73 e R$ 426,23. A outra saída é aceitar uma meta menor só no Pro e no Max.

O que os créditos recomendados compram, se a pessoa usar uma ferramenta só (fotos, Kling de 5 s com áudio ou Veo de 8 s com áudio):

| Plano | Fotos | Kling | Veo |
|---|---:|---:|---:|
| Creator Start (2.400) | 46 | 5 | 1 |
| Creator Pro (5.100) | 98 | 12 | 2 |
| Creator Max (10.600) | 203 | 26 | 5 |

Com 100 créditos, o Free gera uma foto (52 créditos) e alguns textos.

## 6. Margem de contribuição por cenário de consumo (proposta v3, por assinante)

| Plano | 25% de uso | 60% de uso | 100% de uso | 100%, com custo igual à tarifa |
|---|---:|---:|---:|---:|
| Creator Start | 82,7% | 71,7% | 59,2% | 63,3% |
| Creator Pro | 81,7% | 69,3% | 55,2% | 59,8% |
| Creator Max | 81,2% | 68,2% | 53,3% | 58,2% |

- "100%, com custo igual à tarifa" é o mesmo uso integral, mas sem gastar a reserva de 15%.
- Margem de contribuição não é lucro: ainda saem custos fixos, aquisição, suporte, manutenção e pró-labore.
- Os planos de hoje, usados por inteiro, ficam abaixo da meta: Starter 38,7%, Pro 32,2%, Studio 21,5%.

## 7. Auditoria do fator de conversão (10,35)

O fator é 0,09 × 1,15 ÷ 0,01. Ele parte da premissa de que um crédito antigo custa R$ 0,09. Com as tarifas oficiais e o
câmbio a 5,60:

| Modelo | Créditos antigos | Custo real | R$ por crédito antigo | Efeito da conversão em quem tem saldo |
|---|---:|---:|---:|---|
| foto | 5 | R$ 0,448 | 0,0896 | ganha 0,4% |
| foto-persona, foto-edicao | 6 | R$ 0,448 | 0,0747 | ganha 20,5% |
| video-kling | 40 | R$ 3,528 | 0,0882 | ganha 2,0% |
| video-veo | 200 | R$ 17,92 | 0,0896 | ganha 0,4% |
| textos | 3 a 8 | depende dos tokens | | perde se custar mais que R$ 0,09 por crédito antigo (R$ 0,27 num texto de 3 créditos) |

O fator é coerente para foto e vídeo. Ninguém perde poder de compra em mídia: na persona e na edição a pessoa ganha,
porque o preço antigo já era generoso. O texto só fecha depois da medição de tokens.

- **Créditos comprados e promocionais:** convertem pelo mesmo fator, e as boas-vindas antigas entram juntas.
- **Saldos reservados:** a virada exige zero reserva aberta.
- **Assinaturas antigas:** mantêm o preço, e os créditos do mês são multiplicados pelo fator. Esse é o mesmo benefício contratado, na régua nova.
- **Volta:** `admin_rollback_pricing_v2`, enquanto ninguém assinar plano novo.

## 8. Riscos financeiros

1. **Veo 3.1 sai do fal em 17/11/2026** (aviso na página do modelo). Precisa de modelo substituto, com tarifa nova, antes
   dessa data, ou o Creator Max perde o recurso que justifica o preço.
2. **Texto sem volume medido:** se a média de tokens for alta, cada texto custa mais que os créditos de hoje cobrem.
3. **Câmbio:** cada R$ 0,10 a mais no dólar encarece cerca de 1,8% o custo de IA. A reserva de 15% cobre uma alta de até
   cerca de R$ 0,84.
4. **Proposta v3 abaixo da meta** no uso integral: 59,2%, 55,2% e 53,3%.
5. **Abuso das boas-vindas:** o pior caso é 300 contas por dia × R$ 1 de orçamento = R$ 300 por dia. O teto é ajustável no painel.
6. **Business sem organização com membros:** continua só por contato.
7. **Planos de hoje abaixo da meta** se forem usados por inteiro (Starter 38,7%, Pro 32,2%, Studio 21,5%).

## 9. O que não fazer antes da aprovação

- Rodar a virada ou ligar `VITE_PRICING_V2=true` em produção.
- Mudar preço ou crédito de plano no ar. Só rascunho muda pelo painel.
- Criar produto ou cobrança no Asaas para os planos novos.
- Gerar texto ou mídia paga para medir tokens sem autorização.
- Ligar a trava de custo antes de cadastrar e conferir as tarifas: isso tiraria todos os modelos do ar.

## 10. O que falta antes do lançamento comercial

1. Restaurar o Supabase e aplicar as migrations 0016 a 0019.
2. Publicar as functions `generate`, `assistant`, `multiplier` e `pricing-check`, com `FAL_KEY` e `ANTHROPIC_API_KEY`.
3. Medir os tokens de texto com algumas gerações autorizadas e salvar a tarifa de texto com o volume medido.
4. Conferir as tarifas do fal no painel (botão "Conferir preços no fal agora" e "Confirmar preço").
5. Escolher o substituto do Veo 3.1 e cadastrar a tarifa.
6. Atualizar o câmbio, a taxa real do Asaas e os tributos.
7. Decidir os créditos: a recomendação está na seção 5. Salvar na calculadora.
8. Pausar as gerações, rodar a checagem, fazer a virada e publicar o front com `VITE_PRICING_V2=true`.
9. Fazer uma compra de teste. Definir `VITE_CONTACT_EMAIL` para o Business.

## Testes

- **Banco (pglite):** 90 testes. Os 7 novos cobrem:
  - O motor de tarifa, incluindo a configuração que não fecha.
  - A tarifa pelo painel, sem efeito retroativo e com auditoria.
  - A trava (sem custo confiável, acima do teto e preço mudado no fornecedor).
  - A reconciliação de texto, idempotente.
  - As boas-vindas (confirmação, e-mail repetido e teto do dia).
  - A vitrine igual ao checkout.
  - O rascunho pelo painel, com a margem na escala certa.
  - A virada com aceite e foto, e a volta com trava por assinante novo.
- **Unitários:** 225, com os novos de `planEconomics`, do simulador, da tarifa, da cotação, da vitrine e da API de preço do fal.
- **Telas (Playwright, Edge, computador e celular):** calculadora, resultado, rentabilidade, simulador, preços e créditos,
  e landing nas abas Creator e Business. Sem erro no console e sem rolagem lateral.
