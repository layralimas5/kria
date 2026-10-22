# Vynkio: do gerador ao ecossistema

Diagnóstico de 21/10/2026, feito sobre o `main` (commit c641317), e o plano para levar o
Vynkio de "gerador de foto e vídeo" para a jornada completa
**ideia → estratégia → planejamento → criação → produção → organização → publicação → análise → otimização**.

A regra que vale para todo o documento: só aparece como pronto o que existe de verdade. O
resto fica fora do menu ou aparece como "Breve", sem link nem botão.

---

## 1. Diagnóstico da plataforma atual

**Stack:** React 19 + TypeScript strict + Vite + Tailwind v4 + Framer Motion no front;
Supabase (Postgres com RLS em tudo, Auth, Storage, Realtime) no back; 9 edge functions em
Deno; fal.ai para imagem e vídeo (fila assíncrona + webhook com HMAC); Asaas para Pix,
cartão e assinatura recorrente.

**O que está pronto e testado** (`npm run check`: tipos, unitários e banco no pglite):

| Área | Estado |
|---|---|
| Conta | E-mail e senha, Google opcional, recuperação por código de 6 dígitos, exportar e excluir conta (LGPD) |
| Studio | Foto por texto (Nano Banana 2), foto com personagem (Nano Banana 2 Edit), vídeo a partir de imagem (Kling 3.0 5s, Veo 3.1 8s) |
| Personagens | Construtor visual por traços, retrato gerado, persona salva só a partir de imagem gerada (anti-deepfake), limite por plano |
| Biblioteca | "Minhas criações" ao vivo (realtime + polling de segurança), baixar, animar, virar persona |
| Créditos | Carteira em dois baldes (plano renova, avulso não vence), reserva → captura → estorno, extrato imutável, idempotência |
| Planos | Grátis, Starter, Pro, Studio em `subscription_plans`; ferramentas, personagens e modelos liberados por plano, sem deploy |
| Landing | Em `/`, com termos, vitrine de planos conferida contra as migrations por teste |
| Modo demo | `npm run dev:demo`: backend falso no navegador, bom para prints e para testar telas sem custo |

**O que não está no ar:** as functions não foram publicadas, `FAL_KEY` e `ASAAS_API_KEY`
estão vazias, faltam pg_cron, webhook do Asaas e SMTP próprio. O Supabase existe (migrations
0001 a 0008 aplicadas em 21/10). Nenhuma geração real rodou ainda.

**Débitos técnicos encontrados:**

1. O FAQ da landing promete GPT Image, Flux, Seedream, Ideogram, Sora 2, Seedance, Hailuo,
   Wan, ElevenLabs, sincronia labial e upscale 4K. O catálogo tem 4 modelos. É promessa falsa:
   corrigido nesta entrega.
2. Copys e roteiros, Estúdio UGC e Meus projetos aparecem como "Breve" no menu e na vitrine.
3. Não existe contexto de marca: cada geração começa do zero, sem público, tom ou oferta.
4. A geração não guarda a qual projeto pertence, então a biblioteca não organiza nada.
5. Veo 3.1 image-to-video tem descontinuação anunciada para 17/11/2026 no fal: trocar o
   `endpoint` na tabela `models` antes disso.

## 2. Diferença entre o que existe e a visão Vynkio

| Módulo | Hoje | Visão |
|---|---|---|
| Studio | Foto, vídeo, personagem | + UGC, criativos de anúncio, adaptação de formato, mais modelos |
| AI | Nada | Copy, legenda, roteiro, gancho, ideia, revisão, tom de voz, sempre com o contexto da marca |
| Content | Nada | Calendário, carrossel, reaproveitamento, fluxo de produção |
| Analytics | Nada | Métricas reais por integração autorizada ou importação; nunca número inventado |
| Growth | Nada | Posicionamento, oferta, funil, CTA, hipóteses, sem promessa de resultado |
| Workspace | Só a conta | Marcas, projetos, arquivos, status de produção, preferências |

O que já existe é a base certa para crescer: a carteira, o catálogo de modelos editável
por `update` e a liberação por plano servem para qualquer módulo novo, não só para imagem.

## 3. Arquitetura recomendada

**Princípio: um motor de geração só, vários módulos em cima.** Toda ação de IA que custa
dinheiro (foto, vídeo, texto) passa pelo mesmo caminho:

```
módulo (Studio, AI, ...) → edge function → create_generation (valida plano, reserva crédito)
                                         → provedor (fal, Anthropic, ...)
                                         → complete_* (captura) ou fail_generation (estorna)
```

Por isso o texto entra na tabela `generations` com `kind = 'text'`, e não numa tabela à
parte: ganha de graça idempotência, limite de gerações simultâneas, estorno, extrato e a
conta de custo por modelo. O provedor é uma coluna (`models.provider`), e o modelo de cada
ferramenta é uma linha editável (`models.endpoint`). Trocar Claude Opus por outro modelo,
ou mudar o preço em créditos, é `update`, sem deploy.

**Contexto é dado, não prompt solto.** A marca (`brands`) guarda nicho, público, tom,
oferta, o que evitar e estilo visual. Toda ferramenta de texto recebe esse contexto no
servidor; o front só manda o `brandId`. Toda geração pode carregar `brand_id` e
`project_id`, e é isso que liga os módulos: a ideia vira roteiro, o roteiro vira cena no
Studio, a cena volta para o projeto.

**Camadas** (a dependência aponta para dentro):

- `src/domain`: tipos validados com zod, regras puras (planos, ferramentas, formatos).
- `src/lib/api.ts`: a única fronteira com o Supabase.
- `src/hooks`: estado e casos de uso de tela.
- `src/components`, `src/pages`: UI burra.
- `supabase/functions/_shared`: regras puras testadas (prompt, saída, assinatura) separadas
  do que fala com rede.

**Segurança e custo:** chave do provedor só nos secrets das functions; preço e permissão só
no banco (`security definer`); o cliente nunca escolhe o modelo de texto nem vê o custo do
fornecedor; o filtro de prompt roda antes de gastar.

## 4. Organização dos módulos

| Módulo | Rotas | Menu | Plano |
|---|---|---|---|
| Studio | `/estudio`, `/personas` | Criar personagem, Gerar imagem, Gerar vídeo, Estúdio UGC | UGC no Pro e Studio |
| Vynkio AI | `/assistente/:ferramenta` | Copys e roteiros, Ideias | Todos |
| Workspace | `/marcas`, `/projetos`, `/galeria` | Marcas, Meus projetos, Minhas criações | Projetos no Studio; marcas 1/1/3/10 |
| Content | (V2) | fora do menu | |
| Analytics | (V2) | fora do menu | |
| Growth | (V3) | fora do menu | |

Content, Analytics e Growth não aparecem no menu até existirem. Mostrar seis abas "Breve"
venderia um produto que ainda não existe.

## 5. Fluxo principal do usuário (MVP)

1. Cria a conta, ganha 20 créditos, escolhe o objetivo no onboarding.
2. Cadastra a **marca**: nicho, público, tom, oferta, o que evitar.
3. Pede **ideias** de conteúdo para a marca (Vynkio AI).
4. Transforma uma ideia em **roteiro** com um clique; o roteiro já vem com cenas e o
   prompt visual de cada uma.
5. Manda a cena para o **Studio**: o prompt chega preenchido, escolhe o personagem, gera a
   foto e depois o vídeo.
6. Escreve a **legenda** e o CTA no assistente de copy, com o mesmo contexto.
7. Tudo fica em **Minhas criações**; no Studio, também no **projeto**.

## 6. Roadmap

**MVP (esta fase):**
foto, vídeo, personagem (pronto); copys, legendas, roteiros e ideias com Claude; roteiro UGC
com cenas para o Studio; marcas como contexto; projetos; ligação ideia → roteiro → Studio;
landing honesta sobre o que existe; planos, créditos e extrato (pronto).

**V2:**
calendário editorial e status de produção (Content); carrossel (texto + imagens por slide);
biblioteca de prompts; Motion Control; voz e fala (ElevenLabs + lip sync) para o UGC falar o
roteiro; LoRA da persona; adaptação de formato (9:16, 1:1, 4:5); importação de métricas por
CSV e um painel simples com dados reais (Analytics).

**Expansões:**
integrações autorizadas (Instagram Graph, TikTok, YouTube Data) para métricas e publicação;
recomendações a partir dos dados; Growth (posicionamento, oferta, funil, hipóteses);
reaproveitamento de vídeo longo em cortes; times e agências (vários membros por workspace);
landing page por prompt.

## 7. O que já existe e é reaproveitado

- `create_generation`, `fail_generation`, `wallet_move`, `credit_reservations`: o motor de
  cobrança de qualquer ferramenta nova.
- `models` com `provider`, `endpoint`, `credits`, `allowed_plans`: catálogo de qualquer IA.
- `subscription_plans.tools` + `navGroupsFor`: liberar módulo por plano sem deploy.
- `checkPrompt`: filtro de conteúdo antes de gastar.
- `useIdempotencyKey`, `useBalance`, `useQuery`: estado de tela.
- `PageHeader`, `EmptyState`, `Notice`, `Button`, `Field`, `Badge`, `Popover`: kit de UI.
- Modo demo (`src/demo`): cada módulo novo ganha resposta falsa e pode ser mostrado sem custo.

## 8. Alterações na landing

Feitas nesta entrega:
- FAQ "Quais ferramentas" passa a listar só o que o app gera.
- "Copy com IA" deixa de ser "Breve".
- Vitrine e comparação: Copys e roteiros, Estúdio UGC e Meus projetos viram incluídos.

Próximas (quando houver o material):
- Uma seção da jornada ideia → roteiro → vídeo, com tela real do app.
- Exemplos reais gerados no fal no lugar dos shaders ilustrativos.
- Posicionar como "ecossistema de criação" só quando Content existir; até lá, "crie,
  escreva e organize" descreve o produto sem exagero.

## 9. Alterações no sistema interno

Feitas nesta entrega:
- Migration `0009_workspace`: `brands`, `projects`, `max_brands` por plano, `brand_id` e
  `project_id` nas gerações, RLS e travas de dono.
- Migration `0010_assistant`: gerações de texto, `output_text`, `complete_text_generation`,
  quatro ferramentas no catálogo (`copy`, `roteiro`, `ideias`, `ugc-roteiro`).
- Edge function `assistant` (Claude, saída estruturada, estorno na falha).
- `generate` aceita `brandId` e `projectId`.
- Telas: Marcas, Meus projetos, Assistente (copy, roteiro, ideias, UGC); Studio recebe o
  prompt e o projeto pela URL; menu reorganizado por módulo.
- Modo demo cobre tudo isso.

## 10. Dependências, custos e riscos

| Item | Situação | Custo |
|---|---|---|
| Anthropic API (`ANTHROPIC_API_KEY`) | Falta criar a chave e por nos secrets | Claude Opus 5.5: US$ 4 / 1M tokens de entrada, US$ 20 / 1M de saída. Um pedido típico (~1,5 mil de entrada, ~1,5 mil de saída com raciocínio em esforço baixo) sai perto de US$ 0,04, uns R$ 0,20 |
| Preço em créditos do texto | 3 créditos por pedido | A R$ 0,15 a R$ 0,20 por crédito vendido, 3 créditos pagam ~R$ 0,45 a R$ 0,60. Conferir o custo real no painel da Anthropic na primeira semana e ajustar `models.credits` |
| fal.ai | Igual a antes | ~R$ 0,09 por crédito |
| Supabase free | Edge function tem limite de tempo por pedido; o texto leva de 10 a 40 s | Plano Pro do Supabase (US$ 25) quando houver tráfego |

**Riscos:**
- **Recusa do modelo:** o Claude pode recusar um pedido (ex.: tema sensível). A function
  usa o fallback automático da Anthropic e, se ainda assim recusar, estorna os créditos.
- **Promessa de resultado:** os prompts proíbem prometer viralização ou ganho financeiro.
- **Pessoa real:** o filtro de prompt e o "sem upload de rosto" continuam valendo para o UGC.
- **Custo descontrolado:** cada pedido de texto é cobrado antes, conta no limite de gerações
  simultâneas e tem teto de saída.
- **Escopo:** Analytics sem integração real vira número inventado. Por isso fica para V2,
  começando por importação de CSV.

## Ordem para publicar

1. Aplicar `0009` e `0010` no Supabase (`npx supabase db push`).
2. `npx supabase secrets set ANTHROPIC_API_KEY=...`
3. Publicar a function nova e a `generate` atualizada (`npx supabase functions deploy assistant generate`).
4. Fazer um pedido de cada ferramenta com uma conta de teste e conferir extrato e custo.
