# Vynkio

SaaS de criação com IA: a pessoa cria influenciadores (personas com rosto
consistente) e gera fotos e vídeos com eles, pagando por crédito. Repositório na pasta `pessoais/kria`.

**Marca (20/10/2026):** o produto se chama **Vynkio** ("o Vynkio"). A paleta é a da Nivora:
fundo noite `#0b0a1a`, roxo `#7c3aed` (botão e selo, texto branco), roxo claro `#a78bfa`
(texto e ícone sobre o escuro), azul `#3b82f6` (gradiente da marca) e dourado `#f5b841`
(selo TOP e destaque). Tokens em `src/index.css`. A pasta e os identificadores internos
(`kria-*` no localStorage, cron, project_id) continuam com o nome antigo.

## Stack

- Front: React 19 + TypeScript strict + Vite + Tailwind v4 + Framer Motion (`src/`)
- Banco/Auth/Storage: Supabase (`supabase/migrations`), RLS em tudo
- Edge functions (Deno): `supabase/functions`
- IA: fal.ai (fila assíncrona + webhook). Catálogo de modelos na tabela `models`
- Pagamento: Asaas. Assinatura mensal no cartão (checkout recorrente) + créditos avulsos Pix/cartão. Ver `docs/assinaturas.md`

## Regras do domínio

- Crédito só muda por função SQL `security definer`. Debita ao criar a geração,
  estorna se falhar. Os índices únicos de `credit_ledger` impedem débito/estorno/compra duplicados.
- Persona nasce só de imagem gerada aqui (`create_persona`). Sem upload de foto:
  é o que impede deepfake de pessoa real. Não abrir upload sem moderação de rosto.
- Webhook do fal não confia no corpo: confere a assinatura HMAC do id e consulta o fal.
- Trocar modelo ou preço = `update public.models`. Não precisa de deploy.
- Plano, preço, créditos do mês e limites = `update public.subscription_plans`. Benefício só entra pelo webhook (`grant_subscription_payment`), nunca pela volta do navegador.

## Comandos

- `npm run dev` (porta 5231)
- `npm run dev:demo`: backend falso no navegador (`src/demo`), sessão aberta, gerações que terminam sozinhas. Nada vai ao Supabase
- `npm run demo:assets`: regenera as mídias ilustrativas de `public/demo`
- `npm run check`: tipos do front e das functions, testes unitários e testes do banco (pglite, sem Docker)
- `npm run billing:image`: regenera o ícone e a imagem do checkout

Deploy e primeiros passos: `docs/deploy.md`. Escopo e próximas fases: `docs/escopo.md`.
