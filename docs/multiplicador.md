# Vynkio Multiplicador

**Criado em:** 07/11/2026 · **Branch:** `feat/vynkio-multiplicador` (saiu de `feat/vynkio-spend-guard`)
**Estado:** pronto e testado no modo demo; falta publicar (migration 0017 e function `multiplier`).

Um vídeo gravado vira várias versões com roteiro e montagem diferentes, prontas para postar.

## Como funciona

| Etapa | O que acontece | Onde |
|---|---|---|
| 1. Materiais | A pessoa envia até 12 vídeos (MP4, MOV, WEBM, até 3 min) e fotos, descreve cada take numa linha, diz o produto, o público, a rede, o objetivo e o formato, e confirma o direito de uso | `MaterialsStep`, `TakesManager` |
| 2. Roteiros | Um lote (1 a N variações, N pelo plano) custa 8 créditos. O Claude escreve ângulo, gancho, cenas (take, início, duração, texto), CTA e legenda, e uma leitura do material (benefícios citados, o que falta, o que explorar). Cada roteiro é editável | function `multiplier`, `ScriptsStep`, `VariationEditor` |
| 3. Montagem | O navegador monta cada variação quadro a quadro: cortes, ordem das cenas, texto em 3 estilos, transição, foto com zoom, formato 9:16, 1:1, 4:5 ou 16:9, som dos takes e trilha. Fila com progresso, cancelamento, nova tentativa, prévia, MP4 e ZIP com `legendas.txt` | `RenderStep`, `useRenderQueue`, `src/lib/render` |

## Decisões

- **Os arquivos não sobem.** Ficam na memória da aba. Custo de armazenamento e transferência zero, e
  privacidade de verdade. Ao recarregar a página, a pessoa escolhe os arquivos de novo (o projeto casa
  pelo nome do arquivo). Próximo passo possível: guardar no próprio aparelho (OPFS) para não reenviar.
- **Montagem no navegador, sem servidor de render.** Custo por vídeo zero para o Vynkio. O crédito
  cobra só a IA (o lote de roteiros), pelo motor de sempre: reserva, estorno na falha e guarda de gasto.
- **Quadro a quadro, não gravação em tempo real.** WebCodecs (H.264 + AAC) com a biblioteca
  `mediabunny` (fixada em 1.61.6). A primeira versão usava MediaRecorder e foi trocada: ele perde
  quadro quando a máquina engasga e embaralha o tempo ao pausar (medido: 6,5 s planejados saíam com
  4,9 s de vídeo e sem o cartão final). Agora a duração bate com o roteiro (6,5 s = 195 quadros) e a
  aba não precisa ficar visível.
- **MP4 comum, índice no começo** (`fastStart`): abre certo em player, WhatsApp e upload de rede social.
- **O Claude não vê o vídeo.** Sabe só o que a pessoa descreveu. O prompt proíbe inventar benefício,
  resultado, certificação ou número, e proíbe "variação" por velocidade, filtro ou metadado para driblar
  detecção de duplicado. Transcrição automática ainda não existe (campo opcional para colar a fala).

## Limites

| Plano | Variações por lote |
|---|---|
| Grátis | 3 |
| Starter | 5 |
| Pro | 10 |
| Studio | 10 |

`subscription_plans.max_variations`, conferido no servidor (`start_multiplier_batch`). Preço do lote:
`models.credits` da linha `multiplicador` (8). Mudar = `update`, sem deploy.

**Custo estimado do lote (a conferir no painel da Anthropic na primeira semana):** um lote de 10 sai em
torno de 4 a 5 mil tokens de saída no Claude Opus 5.5, perto de US$ 0,10 (R$ 0,60). Com 8 créditos a
R$ 0,15 o crédito, entra R$ 1,20. Lote menor dá mais margem.

## Navegador

Chrome e Edge atualizados no computador: completo. Safari recente: deve funcionar (WebCodecs com H.264),
não testado. Firefox e celular: a tela avisa quando o navegador não tem o codificador. Testado no Edge
(com e sem GPU).

## Para publicar

1. `npx supabase db push` (aplica a 0016 e a 0017; as duas só acrescentam).
2. `npx supabase functions deploy multiplier` (e `generate assistant` pelas mensagens novas de erro).
3. Publicar o front.
4. Com uma conta de teste: criar projeto, gerar um lote de 3, editar um roteiro, montar e baixar o ZIP.
   Conferir o extrato (8 créditos) e o custo real no painel da Anthropic.

## O que ainda não faz

Transcrição automática, detecção de cena, legenda palavra por palavra, locução por IA, trilha da
biblioteca do Vynkio e agendamento de publicação. Cada um depende de provedor com preço conferido.
