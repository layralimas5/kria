# Kria IA

SaaS de criação com IA: a pessoa cria influenciadores (personas com rosto
consistente) e gera fotos e vídeos com eles, pagando por crédito. Repositório na pasta `pessoais/kria`.

## Stack

- Front: React 19 + TypeScript strict + Vite + Tailwind v4 + Framer Motion (`src/`)
- Banco/Auth/Storage: Supabase (`supabase/migrations`), RLS em tudo
- Edge functions (Deno): `supabase/functions`
- IA: fal.ai (fila assíncrona + webhook). Catálogo de modelos na tabela `models`
- Pagamento: Asaas, checkout avulso Pix + cartão (mesmo padrão do Momentumm)

## Regras do domínio

- Crédito só muda por função SQL `security definer`. Debita ao criar a geração,
  estorna se falhar. Os índices únicos de `credit_ledger` impedem débito/estorno/compra duplicados.
- Persona nasce só de imagem gerada aqui (`create_persona`). Sem upload de foto:
  é o que impede deepfake de pessoa real. Não abrir upload sem moderação de rosto.
- Webhook do fal não confia no corpo: confere a assinatura HMAC do id e consulta o fal.
- Trocar modelo ou preço = `update public.models`. Não precisa de deploy.

## Comandos

- `npm run dev` (porta 5231)
- `npm run dev:demo`: backend falso no navegador (`src/demo`), sessão aberta, gerações que terminam sozinhas. Nada vai ao Supabase
- `npm run demo:assets`: regenera as mídias ilustrativas de `public/demo`
- `npm run check`: tipos do front e das functions, testes unitários e testes do banco (pglite, sem Docker)
- `npm run billing:image`: regenera o ícone e a imagem do checkout

Deploy e primeiros passos: `docs/deploy.md`. Escopo e próximas fases: `docs/escopo.md`.
