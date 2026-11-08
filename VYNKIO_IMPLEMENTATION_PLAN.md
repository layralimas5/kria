# Vynkio: plano de implementação (Creator, Business e Tools)

**Data:** 06/11/2026 · **Base auditada:** `feat/vynkio-os` (commit ad78189), que já contém tudo de
`feat/vynkio-formatos`, `feat/vynkio-admin` e `feat/vynkio-evolution`.
**Entrega desta etapa:** `feat/vynkio-spend-guard` (Sprint 1, guarda de gasto).

Regra que vale para o documento inteiro: só aparece como pronto o que funciona e foi testado.
Integração externa sem chave configurada e sem chamada real **não** conta como integrada.

---

## 0. Antes de tudo: duas direções em aberto

Em 04/11 ficou registrado em `docs/vynkio-os.md` que o Vynkio deixaria de ser "gerador de imagem e
vídeo" (terreno de Higgsfield, Arcads e CapCut, com margem de 31 a 45% no pior caso) e passaria a
vender **decisão e rotina** ("o Vynkio diz o que postar e monta a semana"). O prompt deste plano
volta a pôr a geração no centro (Multiplicador, vídeo IA, UGC) e acrescenta uma linha Business.

As duas coisas não se excluem, mas competem pelo mesmo tempo. **Recomendação:** a Sprint 1 (guarda de
gasto) serve às duas e já está feita. Antes da Sprint 2, rodar a etapa 1 do `vynkio-os.md`
(validar com 10 criadores "o que trava mais: fazer o conteúdo ou saber o que fazer?"). Se a resposta
for "fazer", o Multiplicador é a aposta certa; se for "saber o que fazer", Minha semana vem antes.

---

## 1. Arquitetura encontrada

| Camada | O que existe |
|---|---|
| Front | React 19 + TypeScript strict + Vite 6 + Tailwind v4 + Framer Motion. `src/domain` (zod e regras puras), `src/lib/api.ts` e `adminApi.ts` (única fronteira com o Supabase), `src/hooks`, `src/components`, `src/pages`, `src/landing` (landing no mesmo app) |
| Modo demo | `src/demo`: backend falso no navegador que imita tabelas, RPCs e functions. Serve para prints e para testar tela sem custo |
| Banco | Supabase Postgres, 16 migrations, RLS em todas as tabelas. Dinheiro e crédito só por funções `security definer` |
| Edge functions (Deno) | `generate`, `generation-status`, `fal-webhook`, `assistant`, `buy-credits`, `subscribe`, `cancel-subscription`, `asaas-webhook`, `account` |
| Regras compartilhadas | `supabase/functions/_shared`: geração, assistente, cobrança, assinatura HMAC, provedores, formatos (com testes) |
| IA | fal.ai (imagem e vídeo, fila assíncrona + webhook HMAC + polling de segurança); Anthropic Claude (texto, saída estruturada) |
| Pagamento | Asaas: pacote avulso Pix e cartão, assinatura recorrente no cartão, webhook com token |
| Storage | Bucket `media` privado, com tamanho e tipo de arquivo limitados; upload de foto só com confirmação de direitos (`uploads`, 0015) |
| Testes | `npm run check`: tipos do front e das functions, 165 unitários (vitest) e 71 de banco num Postgres real (pglite, sem Docker) |

**Motor único.** Toda ação que custa dinheiro passa por `create_generation` (valida plano,
concorrência, saldo e agora limites; reserva o crédito; idempotência por chave) → provedor →
`complete_*` (captura) ou `fail_generation` (estorna uma vez só). Imagem, vídeo e texto vivem na
tabela `generations`. **Qualquer módulo novo pago deve entrar por esse caminho.**

## 2. Funcionalidades que já existem (e funcionam no demo e nos testes)

| Área | Estado |
|---|---|
| Conta | E-mail e senha, Google opcional, recuperação por código, exportar e excluir conta (LGPD) |
| Studio | Foto por texto (Nano Banana 2, 4 proporções), foto com personagem, edição de foto, vídeo a partir de imagem (Kling 3.0, Veo 3.1), quadro inicial e final |
| Personagens | Construtor visual, persona só de imagem gerada aqui (anti-deepfake), limite por plano, ligada à marca |
| Formatos | Vídeos prontos por nicho a partir de foto enviada (tour de imóvel, antes e depois, drone, produto girando, produto em cena, prato) |
| Inteligência (Claude) | Ideias, roteiro, 9 tipos de copy, roteiro UGC, planejamento editorial; contexto da marca no servidor; não inventa número nem depoimento |
| Workspace | Marcas com perfil completo e marca ativa, projetos, Minhas criações |
| Conteúdo | Itens com status, quadro e calendário, anexos de imagem, vídeo e texto |
| Resultados | Importação de métricas por CSV, tudo ou nada, com origem e data |
| Créditos | Dois baldes (plano renova, comprado não vence), reserva, captura, estorno, extrato imutável |
| Planos | Grátis, Starter (R$ 59,90 / 300), Pro (R$ 79,90 / 450), Studio (R$ 149,90 / 1.000); ferramentas, modelos e limites por plano, editáveis sem deploy, com versão |
| Admin `/admin` | Papéis com MFA obrigatório, dashboard por período (receita, MRR, custo de API, margem), usuários, planos, modelos e custos, auditoria imutável, administradores |
| Política de preço | `pricing_settings`: custo US$ × câmbio × (1 + folga) × markup ÷ valor do crédito = créditos sugeridos (é a "política configurável" da Fase 4) |

## 3. Problemas e riscos encontrados

1. **Nada rodou com provedor real.** Functions não publicadas em produção, `FAL_KEY`,
   `ANTHROPIC_API_KEY` e `ASAAS_API_KEY` sem teste real. Migrations até 0015 aplicadas.
2. **Custo do fornecedor nunca cadastrado.** `models.provider_cost_usd` está nulo em todos os modelos,
   então o dashboard mostra custo de API zero e a margem fica sem base. *(Mitigado nesta entrega: a
   guarda usa o pior caso quando o custo falta.)*
3. **Não havia teto de gasto.** O único freio era saldo e concorrência. Um preço mal configurado ou um
   abuso consumiria sem limite. *(Resolvido nesta entrega.)*
4. **Falha cobrada pelo fornecedor sumia da conta.** A Anthropic cobra os tokens mesmo quando o pedido
   falha; o dashboard só somava sucesso. *(Resolvido para a guarda; o dashboard antigo ainda soma só sucesso.)*
5. **Veo 3.1 image-to-video** tem descontinuação anunciada no fal para **17/11/2026**: trocar o
   `endpoint` na linha do modelo antes da data (é `update`, sem deploy).
6. **Sem organizações.** Isolamento é por `user_id`. Business com equipes exige `organizations`,
   `memberships` e RLS por membro: muda a chave de isolamento de várias tabelas.
7. **Sem processamento de vídeo próprio.** Não há FFmpeg nem Remotion no projeto. O Multiplicador
   (cortes, legendas, montagem, ZIP) precisa de um worker de render fora das edge functions, que têm
   limite de tempo e de memória.
8. **Rate limiting** só existe como cooldown no front e concorrência por plano no banco; não há limite
   por IP nas functions públicas (webhooks são autenticados por HMAC e token).
9. **Retenção de arquivos** não definida: o Storage cresce sem política de expurgo.

## 4. O que está ausente, por fase do prompt

| Fase | Ausente | Depende de |
|---|---|---|
| 1. Ecossistema | Separar Creator, Business e Tools no menu e no plano | Decisão da seção 0 |
| 2. Multiplicador | Feito em 07/11 (ver Sprint 2). Faltam transcrição, detecção de cena, locução e legenda palavra por palavra | Provedor de transcrição e de voz com preço conferido |
| 3. IA avançada | Texto para vídeo, duração e resolução com custo por parâmetro, voz, imagem para imagem com referência enviada | Conferir preço e endpoint no fal; custo por parâmetro em `create_generation`; moderação de rosto antes de aceitar referência |
| 3. Camada de provedores | `listAvailableModels` (já é a tabela `models`), `estimateGenerationCost` (créditos já aparecem antes de gerar), `cancelGeneration` (falta), `getGenerationStatus` (existe em `generation-status`) | Interface única em `_shared/providers.ts` |
| 4. Financeiro | Custo real por operação (hoje é estimativa), receita por usuário, custo de render, armazenamento e transferência | Fatura do fal e da Anthropic; render próprio |
| 5. Planos | Linha Business e preços novos do prompt | Validação comercial; **não ativar** sem decisão |
| 6. Business | CRM, prospecção, propostas, landing por prompt, equipes | Organizações (risco 6) |
| 7. Telegram | Bot inteiro | Vinculação de conta segura; mesmas RPCs do site |
| 8. Admin | Gerações com reprocesso, provedores com latência, financeiro com custos lançados, filas | Etapas 2 e 3 de `docs/admin.md` |
| 10. Segurança | Rate limit por IP, retenção de arquivos, cancelamento de geração | Itens desta tabela |

## 5. Estratégia por sprint

Cada sprint termina com `npm run check` verde, telas conferidas no modo demo (desktop e celular,
sem erro de console) e documento atualizado. Migrations só aditivas; nenhuma destrutiva sem aprovação.

### Sprint 1: fundação financeira (**esta entrega, pronta**)

Guarda de gasto (`0016_spend_guard`), detalhe na seção 6. Faltam deste sprint, em ordem:

1. Cadastrar `provider_cost_usd` de cada modelo conferindo `fal.ai/models/<endpoint>` e o preço da
   Anthropic (tela Modelos e custos). Sem isso a guarda trabalha no pior caso.
2. Dashboard: somar a falha cobrada (`billed_on_failure`) no custo de API e na margem.
3. Custo real do texto: a function `assistant` já recebe os tokens; gravar o custo real na geração.
4. Alerta fora do painel (e-mail para a Lay quando passar da fração de alerta).

### Sprint 2: Multiplicador MVP (**pronto em 07/11, branch `feat/vynkio-multiplicador`**)

Upload local (nada sobe), projetos, leitura do material, lotes de roteiro pelo motor de crédito com
limite por plano, edição de cada roteiro, montagem quadro a quadro no navegador (WebCodecs) em quatro
formatos e três estilos, fila com progresso, cancelamento e nova tentativa, MP4 e ZIP com legendas.
Detalhes, decisões e custo em `docs/multiplicador.md`. Sem servidor de render: custo de montagem zero.

### Preços v2 e financeiro (**pronto em 07/11, branch `feat/vynkio-pricing-v2`, sem publicar**)

Planos Creator e Business em rascunho, cotação de crédito por custo (R$ 0,01 de orçamento por crédito, fator 1,15),
cota de exportação do Multiplicador, Financeiro e rentabilidade no admin (resultado, por assinante, por modelo,
alertas, simulador) e a virada travada atrás de pausa, motivo e confirmação. Landing com hero, Creator, Business
e FAQ novos; preços v2 atrás de `VITE_PRICING_V2`. Decisões, riscos financeiros e roteiro em `docs/precos-v2.md`.

### Preços v3: créditos dinâmicos e rentabilidade (**pronto em 07/11, mesma branch, sem publicar**)

Tarifa oficial por modelo (fal e Anthropic) com custo por configuração, trava de modelo sem custo confiável, custo
real do texto por token, boas-vindas de 100 com proteção contra conta repetida, proposta v3 nos rascunhos (R$ 79,90,
169,90 e 349,90), vitrine lendo o banco, calculadora de planos, simulador de 25/60/100% por perfil, checagem da virada
e volta. Recomendação: 2.400, 5.100 e 10.600 créditos para 60% de margem no uso integral. Tudo em `docs/precos-v3.md`.

### Sprint 3: Vynkio AI

Custo por parâmetro (duração, resolução) em `create_generation`; texto para vídeo; cancelamento;
`_shared/providers.ts` como interface única com timeout, retry e registro de custo. Higgsfield,
Kling direto e Veo direto só com documentação oficial e contrato comercial conferidos.

### Sprint 4: Business MVP

Organizações e membros primeiro (RLS por `is_member()`), depois CRM (contatos, oportunidades, etapas),
propostas com PDF. O Vynkio OS (marcas, conteúdo, resultados) já cobre parte do "marketing".

### Sprint 5: aquisição

Tools públicas que rodam 100% no navegador e custam zero de servidor primeiro (QR Code, conversor,
redimensionador e compressor de imagem, limpador de CSV), cada uma com página própria e SEO.
Telegram depois, chamando as mesmas RPCs (sem regra duplicada).

## 6. O que entrou nesta entrega (Sprint 1)

| Peça | O que faz |
|---|---|
| Limite por plano | `daily_credit_limit` e `monthly_credit_limit` em `subscription_plans` (Grátis 100/500, Starter 300/1.500, Pro 450/2.250, Studio 1.000/5.000; nulo = sem limite). Conta reserva e captura; estorno libera o espaço |
| Teto da plataforma | `daily_cost_cap_usd` (US$ 25) e `monthly_cost_cap_usd` (US$ 300) em `pricing_settings`. Bateu, nenhuma conta gera, sem cobrar crédito |
| Pior caso | Custo sem cadastro = créditos × valor do crédito ÷ dólar (todo o crédito vira custo). Gravado em `generations.spend_usd` no nascimento |
| Falha cobrada | `models.charges_on_failure` (ligado para Anthropic); a geração guarda `billed_on_failure` e continua no custo mesmo com o crédito devolvido |
| Pausa de emergência | `generation_paused` com motivo obrigatório, auditada |
| Para a pessoa | `my_usage()` e o bloco "Limite de consumo do plano" em Créditos. Só créditos, nunca custo |
| Para o admin | Painel "Guarda de gasto" em Modelos e custos (`finance.view`): custo do dia e do mês, alertas, quem mais gastou, tetos e pausa (`pricing.manage`). Limites por plano na tela Planos (`plans.manage`) |
| Erros | `daily_limit_reached`, `monthly_limit_reached` (429), `generation_paused` e `platform_spend_cap` (503) com mensagem clara nas functions e no demo |

**Decisões tomadas sem perguntar (revisar):**
- Os valores dos limites e tetos são hipóteses de partida, baixos de propósito enquanto nada rodou com dinheiro real.
- Mudar limite de consumo **não** cria versão nova do plano: não é preço nem crédito contratado.
- O teto global não serializa entre contas (seria uma trava global em toda geração). Pode passar do
  teto no máximo pelas gerações que nascem no mesmo instante.
- O fal foi marcado como "não cobra falha". Conferir na primeira fatura.
- Dia e mês contam no horário de Brasília, igual ao dashboard.

## 7. Dependências e custos a confirmar

| Item | Situação | Ação |
|---|---|---|
| fal.ai | Chave sem teste real; custos por modelo não cadastrados | Conferir preço por endpoint e preencher `provider_cost_usd` |
| Anthropic | Chave a configurar nos secrets | Pôr limite de gasto mensal no console antes de abrir ao público |
| Asaas | Código pronto, sandbox nunca testado | Rodar o roteiro de `docs/deploy.md` seção 6 |
| Supabase | Free pausa após 7 dias parado; edge function tem limite de tempo | Pro (US$ 25/mês) quando houver tráfego |
| Render de vídeo (Sprint 2) | Não existe | Orçar Remotion Lambda ou container antes de prometer o Multiplicador |
| Transcrição e voz | Não existe | Escolher fornecedor só com preço e contrato conferidos |
| Higgsfield, Kling, Veo direto | Não há API pública conferida para o que a interface deles faz | Não integrar sem documentação oficial e contrato |

## 8. Para publicar a Sprint 1

1. `npx supabase login` e `npx supabase db push` (aplica só a 0016; é aditiva).
2. `npx supabase functions deploy generate assistant` (mensagens novas de erro em `_shared/http.ts`).
3. Publicar o front.
4. No `/admin/modelos`, conferir o painel e ajustar os tetos; em `/admin/planos`, os limites.
