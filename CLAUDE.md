# Vynkio

SaaS de criação com IA: a pessoa cria influenciadores (personas com rosto
consistente) e gera fotos e vídeos com eles, pagando por crédito. Repositório na pasta `pessoais/kria`.

**Marca (20/10/2026):** o produto se chama **Vynkio** ("o Vynkio"). A paleta é a da Nivora:
fundo noite `#0b0a1a`, roxo `#7c3aed` (botão e selo, texto branco), roxo claro `#a78bfa`
(texto e ícone sobre o escuro), azul `#3b82f6` (gradiente da marca) e dourado `#f5b841`
(selo TOP e destaque). Tokens em `src/index.css`. A pasta e os identificadores internos
(`kria-*` no localStorage, cron, project_id) continuam com o nome antigo.

**Landing (21/10):** vive no mesmo app, em `/` (`src/landing`), com `/termos` e `/assinar/:plan`
(ponte para o checkout; exige login). Os planos da vitrine são um catálogo fixo em
`src/landing/pricing/catalog.ts`: textos e selos ficam lá, mas preço, créditos, limite de
personagens e acesso ao Veo precisam bater com as migrations (`catalog.test.ts` falha se não
baterem). Mudou um plano no banco, muda o catálogo junto. Guia em `docs/landing.md`.

## Stack

- Front: React 19 + TypeScript strict + Vite + Tailwind v4 + Framer Motion (`src/`)
- Banco/Auth/Storage: Supabase (`supabase/migrations`), RLS em tudo
- Edge functions (Deno): `supabase/functions`
- IA: fal.ai (fila assíncrona + webhook). Catálogo de modelos na tabela `models`
- Pagamento: Asaas, checkout avulso Pix + cartão (mesmo padrão do Momentumm)

## Regras do domínio

- Crédito só muda por `wallet_move` (chamada pelas funções SQL `security definer`). Carteira em
  dois baldes: plano (renova, não acumula) e comprado (não expira). A geração reserva ao nascer
  (gasta o plano primeiro), captura no sucesso e devolve aos mesmos baldes na falha. Extrato imutável.
- Plano e crédito de assinatura só mudam pelo `asaas-webhook` (`activate_subscription_period`).
- Este app é só o painel do usuário: nada de tela de admin aqui. O banco mantém as funções `admin_*`
  (conferem `is_admin()` e gravam `admin_audit_logs`) para um painel de operação separado no futuro.
- Ferramenta que ainda não existe aparece como "Breve", sem link nem botão.
- Persona nasce só de imagem gerada aqui (`create_persona`). Sem upload de foto:
  é o que impede deepfake de pessoa real. Não abrir upload sem moderação de rosto.
- Webhook do fal não confia no corpo: confere a assinatura HMAC do id e consulta o fal.
- Trocar modelo ou preço = `update public.models`. Não precisa de deploy.
- O que cada plano libera vem de `subscription_plans` (0005): `max_personas`, `tools` (abas do menu: quem não tem
  não vê a aba) e `models.allowed_plans`. Segue a tabela de planos da landing; mudar = `update`, sem deploy.

## Comandos

- `npm run dev` (porta 5231)
- `npm run dev:demo`: backend falso no navegador (`src/demo`), sessão aberta, gerações que terminam sozinhas. Nada vai ao Supabase
- `npm run demo:assets`: regenera as mídias ilustrativas de `public/demo`
- `npm run check`: tipos do front e das functions, testes unitários e testes do banco (pglite, sem Docker)
- `npm run billing:image`: regenera o ícone e a imagem do checkout

Deploy e primeiros passos: `docs/deploy.md`. Escopo e próximas fases: `docs/escopo.md`.
Relatório da Fase 1 (planos, carteira, admin): `docs/fase-1.md`.
