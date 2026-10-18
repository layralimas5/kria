# Landing

Rota `/` (`src/landing`). O app saiu de `/` e foi pra `/estudio`. Todo CTA leva pra `/entrar`.

- Textos, exemplos, pacotes e FAQ: `src/landing/content.ts`. Preços e custos espelham
  `credit_packs` e `models`; se mudar no banco, mudar lá também.
- Perfil do TikTok: `VITE_TIKTOK_URL`. Sem ela, a seção mostra "Perfil chega em breve".

## Trocar os vídeos ilustrativos pelos reais

Os vídeos dos celulares hoje são cenas animadas de `npm run landing:assets`. Pra trocar:

1. Gerar no Kria, em 9:16, com os prompts abaixo (ou outros melhores).
2. Salvar em `public/landing/` como `product.mp4`, `influencer.mp4`, `city.mp4`, mais o pôster
   (primeiro quadro em `.jpg`, mesmo nome). Até ~2 MB cada; comprimir com
   `ffmpeg -i in.mp4 -vf scale=540:-2 -crf 28 -an out.mp4`.
3. Em `content.ts`: trocar `src` pra `.mp4`, ajustar prompt/modelo/créditos e pôr
   `ILLUSTRATIVE_MEDIA = false` (some o aviso de "vídeos ilustrativos").

| Arquivo | Prompt sugerido | Modelo |
|---|---|---|
| `product` | Frasco de sérum lilás girando devagar sobre pedestal, luz de estúdio, fundo escuro com brilho neon verde e roxo | Kling |
| `influencer` | Persona do Kria caminhando na praia no fim da tarde, olha pra câmera e sorri, vento no cabelo, luz dourada | Veo 3.1 |
| `city` | Cidade à noite com chuva fina, câmera andando de lado, janelas acesas, reflexo no asfalto | Kling |

O do meio (`influencer`) é o que aparece maior no topo: vale usar o melhor vídeo com persona.
