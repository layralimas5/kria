# Landing

Rota `/` (`src/landing`). O app saiu de `/` e foi pra `/estudio`. Todo CTA leva pra `/entrar`.
Visual inspirado na home da Higgsfield: fundo grafite, títulos em Space Grotesk caixa alta,
botão "com degrau", grade de mídia de ponta a ponta. Desde 20/10 a marca é Vynkio, na
paleta da Nivora (fundo noite, roxo, azul e dourado; tokens em `src/index.css`).

- Textos, vídeos, ferramentas, pacotes e FAQ: `src/landing/content.ts`. Preços e custos espelham
  `credit_packs` e `models`; se mudar no banco, mudar lá também.

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

## Depoimentos (formato WhatsApp)

A seção "O que estão criando e falando" lê `src/landing/testimonials.json` e só aparece no
site quando houver pelo menos um depoimento real. No `npm run dev` ela mostra um exemplo
marcado como exemplo, pra ver o layout.

Pra entrar um depoimento:

1. Ter a autorização da pessoa por escrito (pode ser no próprio WhatsApp) e guardar o print original.
2. Copiar o texto como ela mandou. Pode cortar mensagens, não pode mudar o sentido.
3. Mídia (print, vídeo que ela criou) em `public/landing/depoimentos/`.
4. Acrescentar no JSON:

```json
{
  "id": "ana-sp",
  "author": "Ana",
  "consent": true,
  "messages": [
    { "from": "cliente", "time": "19:30", "text": "Fiz minha primeira influencer hoje" },
    { "from": "kria", "time": "19:31", "text": "Manda pra gente ver!" },
    { "from": "cliente", "time": "19:33", "video": "/landing/depoimentos/ana.mp4", "poster": "/landing/depoimentos/ana.jpg" }
  ]
}
```

Item sem `"consent": true` ou com mídia fora dessa pasta é ignorado. Nunca escrever
depoimento inventado: é prova social falsa (Código de Defesa do Consumidor e Conar).
Um jeito rápido de conseguir os primeiros: dar créditos extras pros primeiros usuários
em troca de mandarem o que criaram e um comentário.
