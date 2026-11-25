# Copiar movimento (0044)

A pessoa escolhe um personagem dela, sobe um vídeo (dança, gesto, fala) e o personagem repete o movimento.
Fica em Personas > Movimento > "Copiar de um vídeo". Modelo: Kling Motion Control v3 Standard, pelo fal.

## Por que existe upload de vídeo aqui

A regra do Vynkio é não aceitar foto de pessoa real (anti-deepfake). Em 25/11/2026 a Lay autorizou esta exceção,
só nesta ferramenta, com estas travas:

- O rosto sempre vem de persona ou imagem gerada no Vynkio. A tela não tem campo de foto; o `generate` recusa
  `uploadId` e formato nos modelos com `video_input`.
- O vídeo só empresta o movimento: `keep_original_sound = false` e `enable_safety_checker = true` nos defaults.
- A pessoa marca que o vídeo é dela ou que tem autorização antes de conseguir enviar (`rights_confirmed_at`).
- O vídeo é apagado quando a geração fecha, dando certo ou falhando (`_shared/motionCleanup.ts`, chamado no
  `settle.ts` e nas falhas do `generate`). Sobra apagada depois de 6 h pela function `motion-reference`.
- Uso único: cada vídeo vira uma geração só (`motion_references.generation_id`).

## Cobrança

Tarifa oficial: US$ 0,126 por segundo (lida em 25/11/2026). Dois níveis no catálogo, pela régua de sempre (`quote_credits`):

| Modelo      | Vídeo de referência | Custo no fal | Créditos (régua v2) |
| ----------- | ------------------- | ------------ | ------------------- |
| `motion-5`  | até 5 s             | US$ 0,63     | 406                 |
| `motion-10` | até 10 s            | US$ 1,26     | 812                 |

- A duração é medida no servidor, lendo o `mvhd` do próprio MP4/MOV (`_shared/mp4Duration.ts`, testado contra o
  ffprobe). O navegador só avisa antes de subir; quem decide o nível é a function `motion-reference`.
- Cobra pelo teto do nível (folga de 0,15 s para arredondamento), nunca menos do que o fal cobra.
- `charges_on_failure = true`: falha devolve o crédito à pessoa, mas entra no custo do admin.
- Mesmos planos do Kling (a partir do Pro). Margem igual à de qualquer modelo, porque segue a mesma régua.
- Nasce com `cost_checked_at` vazio: com a trava de custo ligada, só gera depois de confirmar o preço em
  `/admin/modelos`.
- Ainda não confirmado: se o fal cobra pela duração da referência ou do resultado. Conferir na 1ª geração real.

## Peças

- Banco: `models.video_input` e `models.max_input_seconds`, bucket privado `motion` (só vídeo, 50 MB, upload só na
  própria pasta), tabela `motion_references` (só a function grava), `generations.motion_reference_id`.
- Functions: `motion-reference` (mede, registra, apaga o que não passa), `generate` (confere dono, uso único e nível;
  manda `video_url` ao fal; tira `duration`, que só serve ao custo), `settle.ts` (apaga o vídeo ao fechar).
- Front: `src/domain/motionCopy.ts`, `src/lib/motionApi.ts`, `usePersonaMotion` (fonte `prompt` ou `video`),
  `MotionVideoSource`. Os modelos têm `studio = false`: não aparecem no Studio nem no "Descrever".

## Colocar no ar

1. `npx supabase db query --linked -f supabase/migrations/0044_motion_control.sql` (nunca `db push`).
2. `npx supabase functions deploy motion-reference`, `generate`, `fal-webhook --no-verify-jwt`, `generation-status`.
3. Merge na main (a Netlify publica).
4. Confirmar o preço dos dois modelos em `/admin/modelos`.
5. Teste real: um vídeo de 4 s (nível 5) e conferir no painel do fal quanto foi cobrado.
