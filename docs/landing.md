# Landing

Rota `/` (`src/landing`). O app saiu de `/` e foi pra `/estudio`. Todo CTA leva pra `/entrar`.
Visual inspirado na home da Higgsfield: fundo grafite, títulos em Space Grotesk caixa alta,
verde-limão do Kria, botão "com degrau", grade de mídia de ponta a ponta.

- Textos, vídeos, ferramentas, pacotes e FAQ: `src/landing/content.ts`. Preços e custos espelham
  `credit_packs` e `models`; se mudar no banco, mudar lá também.
- Perfil do TikTok: `VITE_TIKTOK_URL`. Sem ela, a faixa mostra "Perfil chega em breve".

## Trocar os vídeos ilustrativos pelos reais

Hoje os vídeos são cenas abstratas em shader (`npm run landing:assets`, ou
`npm run landing:assets -- dunes` pra uma só). O visual só chega no nível da Higgsfield
com vídeo real: gente, produto, cenário. Pra trocar:

1. Gerar no Kria, em 9:16, com os prompts abaixo (ou outros melhores).
2. Salvar em `public/landing/<nome>.mp4` mais o pôster `<nome>.jpg` (primeiro quadro).
   Até ~2 MB cada; comprimir com `ffmpeg -i in.mp4 -vf scale=540:-2 -crf 28 -an out.mp4`.
3. Em `content.ts`: trocar a extensão do `src` em `clip()` pra `.mp4`, ajustar prompt, modelo e
   créditos, e pôr `ILLUSTRATIVE_MEDIA = false`.

| Lugar | Nome | Prompt sugerido | Modelo |
|---|---|---|---|
| Topo, celular maior / card de créditos | `dunes` | Persona do Kria caminhando no deserto ao pôr do sol, olha pra câmera e sorri, vento no cabelo | Veo 3.1 |
| Topo / CTA final | `chrome` | Frasco de perfume girando sobre pedestal, luz de estúdio verde e roxa, fundo escuro | Kling |
| Topo | `aurora` | Mulher com casaco de inverno olhando a aurora boreal, câmera subindo devagar | Kling |
| Topo | `planet` | Influenciadora gravando story num rooftop à noite, cidade iluminada atrás | Veo 3.1 |
| Faixa TikTok | `silk` | Close de mãos abrindo uma caixa de produto, luz suave, estilo unboxing | Kling |
| Faixa TikTok | `tunnel` | Tênis girando no ar com luz neon verde, câmera orbitando | Kling |

Vale ter mais de 6 na grade "Feito no Kria": é só acrescentar em `CLIPS` e `GALLERY`.
