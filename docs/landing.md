# Landing

Rota `/` (`src/landing`). O app saiu de `/` e foi pra `/estudio`. Todo CTA leva pra `/entrar`.
Visual inspirado na home da Higgsfield: fundo grafite, títulos em Space Grotesk caixa alta,
laranja do Kria (#ff6b2c), botão "com degrau", grade de mídia de ponta a ponta.

- Textos, vídeos, ferramentas, pacotes e FAQ: `src/landing/content.ts`. Preços e custos espelham
  `credit_packs` e `models`; se mudar no banco, mudar lá também.
- Perfil do TikTok: `VITE_TIKTOK_URL`. Sem ela, a faixa mostra "Perfil chega em breve".

## Vídeos de avatar (IA de verdade)

Os avatares ficam em `src/landing/avatars.json` (id, título, prompt da foto, prompt do movimento).
Enquanto não forem gerados, a página mostra um vídeo abstrato provisório (`npm run landing:assets`)
e o aviso "vídeos ilustrativos". Pra gerar os reais:

1. Criar a conta no fal.ai, pôr saldo e gerar a chave em fal.ai/dashboard/keys.
2. No `.env.local`: `FAL_KEY=...` (sem `VITE_`, então nunca vai pro navegador).
3. `npm run landing:avatars`: pra cada avatar, gera a foto no Nano Banana 2 (9:16) e anima 5s no
   Kling. Salva em `public/landing/avatars/` e registra em `avatars.generated.json`.
   A landing troca sozinha, e o aviso some quando todos existirem.
4. Não gostou de um? `npm run landing:avatars -- --force chef` refaz só esse. Pra trocar a pessoa,
   muda o prompt em `avatars.json` antes.

Os vídeos do Kling vêm em mp4 grande; antes de publicar, vale comprimir
(`ffmpeg -i in.mp4 -vf scale=540:-2 -crf 28 -an out.mp4`).
