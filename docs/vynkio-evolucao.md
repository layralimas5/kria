# Vynkio: evolução do sistema interno

Diagnóstico de 22/10/2026 sobre o `main` (commit 1e6543e), feito para o prompt "Evolução do
sistema interno Vynkio". Continua o que `docs/vynkio-ecossistema.md` (21/10) começou: nada é
reconstruído, cada etapa evolui o que existe e termina com `npm run check` verde e as telas
conferidas no modo demo.

Regra que vale para tudo: só aparece como pronto o que funciona. O que ainda não existe fica
fora do menu ou aparece como "Breve", sem link e sem botão.

---

## 1. Arquitetura encontrada

```
React 19 + TS strict + Vite + Tailwind v4 + Framer Motion
  src/domain     tipos (zod) e regras puras: planos, ferramentas, formatos
  src/lib/api    única fronteira com o Supabase
  src/hooks      estado de tela e casos de uso
  src/pages, src/components   UI
  src/demo       backend falso no navegador (npm run dev:demo)

Supabase
  Postgres com RLS em todas as tabelas, funções security definer para dinheiro
  10 edge functions (Deno): generate, assistant, generation-status, fal-webhook,
  buy-credits, subscribe, cancel-subscription, asaas-webhook, account
  _shared: regras puras testadas (geração, assistente, cobrança, assinatura de webhook)

Provedores
  fal.ai     imagem e vídeo, fila assíncrona + webhook com HMAC + polling de segurança
  Anthropic  texto (Claude Opus 5.5, saída estruturada, fallback do servidor)
  Asaas      Pix e cartão (avulso), assinatura recorrente no cartão
```

**O motor único.** Toda ação que custa dinheiro passa pelo mesmo caminho:
`create_generation` (valida plano, limite simultâneo, reserva crédito, idempotência) →
provedor → `complete_*` (captura) ou `fail_generation` (estorna uma vez só). Foto, vídeo e
texto vivem na tabela `generations`.

## 2. Módulos que já existem

| Módulo | Estado |
|---|---|
| Conta | E-mail e senha, Google opcional, recuperação por código, exportar e excluir conta |
| Onboarding | Objetivo no primeiro acesso, ordena os atalhos do início |
| Dashboard | "O que vamos criar hoje?", saldo por balde, plano, gerações abertas, 4 atalhos por objetivo, recentes, personagens, modelos |
| Studio | Foto por texto (Nano Banana 2, 4:5 fixo), foto com personagem, vídeo a partir de imagem (Kling 3.0 5s, Veo 3.1 8s) |
| Personagens | Construtor visual, persona só de imagem gerada (sem upload de rosto), limite por plano |
| Vynkio AI | Ideias, roteiro, copy e legenda, roteiro UGC; contexto da marca no servidor; ideia → roteiro → cena no Studio |
| Workspace | Marcas (nicho, público, tom, oferta, evitar, estilo visual), projetos (Studio), Minhas criações |
| Créditos | Dois baldes, reserva, captura, estorno, extrato imutável, idempotência, limite simultâneo por plano |
| Assinatura | Starter, Pro, Studio no cartão; troca, cancelamento, faturas |

Testes: 75 unitários + 42 de banco num Postgres real (pglite).

## 3. Problemas identificados

1. **Menu por módulo técnico** (Studio, Vynkio AI, Workspace, Conta), não pelo que a pessoa
   quer fazer. Não tem lugar para Conteúdo e Resultados quando chegarem.
2. **Dashboard com 4 atalhos.** O prompt pede acesso direto a vídeo, imagem, personagem, UGC,
   copy, roteiro, ideias e projetos.
3. **Não existe marca ativa.** A pessoa escolhe a marca em cada tela; quem tem uma marca só
   repete a escolha toda vez. O perfil da marca não tem descrição, objetivos, plataformas nem
   preferências de comunicação.
4. **Personagem solto.** Não dá para ligar um personagem a uma marca.
5. **Studio sem proporção.** Toda foto sai 4:5, mesmo o Nano Banana 2 aceitando outras.
6. **Parâmetros fixos no catálogo.** `models.defaults` manda tudo; não há lista do que a
   pessoa pode escolher por modelo, então cada opção nova exigiria código.
7. **Vynkio AI estreito.** Quatro ferramentas, sem objetivo, tamanho nem tipo de texto
   (anúncio, descrição de produto, título, gancho, texto de venda, reescrita, análise,
   adaptação). O resultado não vira outra etapa além de ideia → roteiro → Studio.
8. **Sem gestão de conteúdo.** O que sai do assistente e do Studio não vira um item com status,
   data e rede social.
9. **Sem base de resultados.** Nenhuma tabela para métricas, nem importação.
10. **Veo 3.1 image-to-video** tem descontinuação anunciada no fal para 17/11/2026.
11. **Nada rodou com provedor real.** Functions não publicadas, chaves vazias (já registrado
    em `docs/deploy.md`).

**Auditoria de créditos (item 9 do prompt):** o sistema atual já cumpre os requisitos. Custo
em créditos visível antes de gerar, reserva atômica, captura e estorno idempotentes, chave
idempotente por pedido, limite simultâneo e de recursos por plano, extrato imutável, preço e
permissão só no banco (o cliente não chama função de crédito nem lê custo do fornecedor), custo
do fornecedor separado do crédito comercial (`models.provider_cost_usd`). Nada a trocar; os
módulos novos que custarem dinheiro entram por `create_generation`.

## 4. Arquitetura recomendada

Manter o motor único e crescer por **dados**, não por código:

- **Catálogo como abstração de provedor.** Cada linha de `models` já tem provedor, endpoint,
  modalidade, custo em créditos, custo do fornecedor, planos e ativo. Entra `options`: os
  parâmetros que a pessoa pode escolher e os valores aceitos. O servidor recusa qualquer valor
  fora da lista antes de reservar crédito. Em `_shared/providers.ts` fica o que é do provedor e
  não muda por modelo: modalidades, se é assíncrono, tempo limite e como ler o erro.
- **Marca é o contexto.** `brands` ganha os campos de perfil (é a `brand_profiles` do prompt,
  sem tabela a mais). A marca ativa fica em `user_preferences.active_brand_id` e vale para o
  assistente, o Studio e o Conteúdo.
- **Conteúdo é a costura entre módulos.** `content_items` aponta para marca, projeto e para as
  gerações (roteiro, copy, imagens, vídeos). O calendário é uma visão de `content_items` por
  data; não precisa de `content_calendars`.
- **Resultados só com dado real.** `analytics_snapshots` guarda métrica com origem e data da
  coleta. Primeiro a importação manual por CSV; integração OAuth depois, por rede.

### Equivalência com as entidades do prompt

| Prompt | No Vynkio | Ação |
|---|---|---|
| users | `auth.users` + `profiles` | Mantém |
| organizations | não existe | **Aguarda** times (ver seção 7) |
| subscriptions, plans | `subscriptions`, `subscription_plans` | Mantém |
| credit_wallets, credit_transactions | `credit_balances`, `credit_ledger`, `credit_reservations` | Mantém |
| projects | `projects` | Mantém |
| brands, brand_profiles | `brands` | Evolui com os campos de perfil |
| ai_providers, ai_models | `models` + `_shared/providers.ts` | Evolui com `options` |
| generation_jobs, generated_assets | `generations` (+ Storage `media`) | Mantém |
| characters | `personas` | Evolui com `brand_id` |
| content_items | não existe | **Cria** |
| content_calendars | visão de `content_items` | Não cria tabela |
| social_connections | não existe | **Aguarda** a primeira integração OAuth |
| analytics_snapshots | não existe | **Cria** (importação manual) |
| ai_conversations | `generations` de texto | Mantém (assistente é pedido único) |
| usage_events | `generations` + `credit_ledger` | Mantém |
| audit_logs | `admin_audit_logs` | Mantém |

## 5. Plano de migração

Uma migration por etapa, só `add column` com default e `create table`: nada existente muda de
significado, então o app no ar continua funcionando entre uma migration e outra.

| Etapa | Migration | Entrega |
|---|---|---|
| 1 | | Este diagnóstico |
| 2 | | Menu em seis áreas, dashboard com as oito ações, marca ativa no topo |
| 3 | `0011_brand_context` | `models.options`, proporção da foto no Studio, personagem ligado à marca |
| 4 | (mesma) | Vynkio AI com tipo de texto, objetivo, tamanho e planejamento editorial; resultado vira roteiro, copy, cena ou conteúdo |
| 5 | (mesma) | Perfil completo da marca e marca ativa |
| 6 | `0012_content` | Conteúdos com status, quadro por status e agenda por data |
| 7 | `0013_analytics` | Importação de métricas por CSV com origem e data; painel só com dado real |
| 8 | | Aguarda dados (seção 7) |

## 6. MVP para lançar primeiro

Etapas 2 a 6: criar (foto, vídeo, personagem, UGC), escrever com o contexto da marca e organizar
em conteúdos com status e data. É o fluxo que fecha sozinho, sem depender de integração com
rede social: **ideia → roteiro → cena → foto → vídeo → legenda → conteúdo pronto**.

## 7. O que deve aguardar

| Item | Por quê |
|---|---|
| Organizações e times | Muda a chave de isolamento de todas as tabelas (de `user_id` para membro da organização). Hoje cada conta tem um dono e as marcas já separam os clientes de quem atende vários. Entra quando houver o produto "times", com `organizations`, `memberships` e RLS por `is_member()` |
| Texto para vídeo | O Studio anima imagem. Antes de oferecer, conferir na documentação do fal o endpoint de texto para vídeo de cada modelo e o preço |
| Duração e qualidade de vídeo | Mudam o custo. Pede custo em créditos por parâmetro em `create_generation`, ainda não implementado |
| Imagem de referência enviada pela pessoa | Upload abre brecha para rosto de pessoa real. Só com moderação de imagem antes de aceitar |
| Integrações OAuth (Instagram, TikTok, YouTube) | Cada uma pede app aprovado na plataforma, revisão de permissões e tokens guardados no Vault do Supabase. `social_connections` nasce com a primeira |
| Publicação automática | Depende das mesmas aprovações; é funcionalidade separada |
| Recomendações (etapa 8) | Sem histórico de métricas, qualquer recomendação seria palpite. Entra quando houver dados importados suficientes, separando fato, inferência e hipótese |
| Motion Control, biblioteca de prompts | Continuam "Breve" |

Plataformas como Higgsfield e Google Flow não entram: não há API pública documentada que cubra
o que elas fazem na interface. Só integração oficial, documentada e permitida em contrato.

## 8. Riscos de custo e integração

| Risco | Mitigação |
|---|---|
| Vídeo caro cobrado em crédito fixo | `provider_cost_usd` por modelo e margem conferida (pior caso 45/40/31%). Opção nova que mude custo só entra com custo por parâmetro |
| Texto com contexto maior (perfil da marca completo) | Cada campo tem teto de tamanho; o prompt de sistema é fixo e vai em cache. Conferir o custo real na primeira semana e ajustar `models.credits` |
| Veo 3.1 i2v descontinuado em 17/11 | Trocar `endpoint` na linha do modelo antes da data (é `update`, sem deploy) |
| Recusa do modelo ou falha do provedor | Estorno automático, já testado |
| Importação de métricas com dado errado | Validação de colunas, tipos e datas antes de gravar; origem e arquivo registrados em cada linha |
| Edge function com limite de tempo | Texto leva de 10 a 40 s; imagem e vídeo são assíncronos por webhook |

---

## 9. O que foi entregue (22/10, branch `feat/vynkio-evolution`)

| Etapa | Estado | O que entrou |
|---|---|---|
| 1 | Pronta | Este diagnóstico |
| 2 | Pronta | Menu em seis áreas (Início, Criar, Inteligência, Conteúdo, Resultados, Gerenciamento); dashboard com as oito ações, ordenadas pelo objetivo do onboarding e com cadeado no que o plano não inclui; botão Menu no celular com todas as áreas |
| 3 | Pronta | `models.options` conferido na `generate` antes de reservar crédito; proporção da foto (4:5, 1:1, 9:16, 16:9) e do Veo (9:16, 16:9) no Studio; `_shared/providers.ts`; UGC deixou de pedir depoimento de cliente: apresenta e demonstra, e lembra de identificar publicidade e IA |
| 4 | Pronta | Copy com nove tipos de texto (legenda, anúncio, descrição de produto, títulos, ganchos, texto de vendas, adaptação, reescrita, análise), objetivo, tamanho e tom por pedido; LinkedIn e Facebook; planejamento editorial; resultado editável que vira roteiro, legenda, cena no Studio ou conteúdo |
| 5 | Pronta | Perfil completo da marca (descrição, objetivos, plataformas, comunicação, referências autorizadas); marca ativa no topo, usada pelo assistente, Studio, Conteúdos e Resultados; personagem ligado à marca |
| 6 | Pronta | Conteúdos com status (ideia a publicado), quadro por status, calendário do mês (agenda no celular), anexos de imagem e vídeo; planejamento vai inteiro para o calendário |
| 7 | Pronta (importação manual) | Resultados por CSV exportado da rede, com validação por linha, gravação tudo ou nada, origem, arquivo e data de cada importação; período 7/30/90 dias com comparação; "Sem dado" quando a métrica não veio. OAuth por rede continua aguardando (seção 7) |
| 8 | Aguarda dados | Ver seção 7 |

Testes: 111 unitários e 54 de banco; fluxos clicados no modo demo (planejamento para o calendário, ideia para roteiro, mover card, proporção, marca ativa, importação de CSV bom e ruim), desktop e celular sem erro de console nem rolagem lateral.

### Ordem para publicar

1. `npx supabase db push` (aplica 0009 a 0013).
2. `npx supabase secrets set ANTHROPIC_API_KEY=...` (se ainda não estiver).
3. `npx supabase functions deploy generate assistant` (opções do modelo, tipos de texto, planejamento, UGC novo).
4. Conferir com uma conta de teste: uma foto 9:16, uma copy do tipo análise, um planejamento salvo no calendário e um CSV importado.

## 10. Operação (23/10)

O admin voltou como área separada em `/admin`: moldura própria, sem o menu do usuário e sem link em lugar nenhum do app. Abre só para quem está em `admin_users`; o banco confere `is_admin()` em cada função e grava a auditoria. Abas: visão geral (usuários, MRR, receita, taxas, custo de API, margem), usuários (busca, ajuste de crédito com motivo, suspensão), planos, modelos e custos (inclui os modelos de texto) e auditoria.

Para entrar no ar como admin: `insert into admin_users (user_id) values ('<seu id>')` no SQL do Supabase, depois de criar sua conta.
