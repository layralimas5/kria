# Kria IA: briefing da landing page

Para o chat que vai construir a landing. O app já existe em `pessoais/kria`
(branch `feat/mvp`); este arquivo diz o que a landing precisa saber dele.

## Onde construir

- Projeto separado em `pessoais/kria-landing` (repositório git próprio), no mesmo
  modelo do `momentumm-landing`. **Não editar `pessoais/kria`**: outro chat está
  trabalhando nele.
- Porta do dev server: **5232**. A 5231 é do app e a 5210 é da Jota Digitais.

## O produto, em uma frase

Crie um influenciador com IA uma vez e gere fotos e vídeos realistas com o mesmo
rosto, pagando só pelo que usar, com Pix.

## O que o app faz (fatos, para não prometer o que não existe)

- **Personas:** descreve a pessoa, gera retratos até gostar, salva. O mesmo rosto
  vai para todas as fotos e vídeos.
- **Foto:** imagem realista a partir de texto, ou com uma persona.
- **Vídeo:** anima uma imagem. Kling (5 s, com áudio) ou Veo 3.1 (8 s, com fala e som).
  Leva de 1 a 5 minutos.
- **Galeria:** baixar, animar, virar persona.
- **Créditos:** 20 grátis ao criar a conta. Pacotes avulsos, sem mensalidade, Pix ou cartão.
  Crédito não expira. Se a geração falhar, o crédito volta sozinho.

| Pacote | Créditos | Preço | Por crédito |
|---|---|---|---|
| Inicial | 100 | R$ 19,90 | R$ 0,20 |
| Criador (destaque) | 300 | R$ 49,90 | R$ 0,17 |
| Estúdio | 800 | R$ 119,90 | R$ 0,15 |

| O que custa | Créditos |
|---|---|
| Foto | 5 |
| Foto com persona | 6 |
| Vídeo Kling 5 s | 40 |
| Vídeo Veo 3.1 8 s | 200 |

Os preços ainda podem mudar antes do lançamento. Na landing, deixar em um único
arquivo de dados para trocar fácil.

## Não pode

- Depoimento, número de usuários ou "R$ X em Y dias" inventados. Sem prova social falsa.
- Prometer upload da própria foto ou "clone de você": o app **não** aceita foto de
  pessoa real (é a trava anti-deepfake). Nada de famosos nos exemplos.
- Dizer que é "sem limites" ou "ilimitado": é por crédito.
- Travessão no texto (regra da Lay).

Obrigatório: aviso de que o conteúdo é gerado por IA e link para termos de uso.

## Identidade visual (igual ao app)

- Fundo escuro: `#09090b` (zinc-950), cards `zinc-900`, bordas `white/8%`
- Destaque: lima `#c6f432` (hover `#d6ff5c`), texto sobre ele `#0b0b0f`
- Fonte: Geist Variable (`@fontsource-variable/geist`)
- Nome escrito **Kria IA**, com "IA" na cor de destaque
- Ícone: `pessoais/kria/public/icon.png` (quadrado lima arredondado com o K)
- Logo em código: `pessoais/kria/src/components/Logo.tsx`
- Visual premium e minimalista (Vercel, Linear), animações sutis

## Telas do app para usar na landing

Rodar o app em modo demo e tirar prints:

```bash
cd pessoais/kria && npm run dev:demo   # http://localhost:5231, já entra logado, com dados de exemplo
```

As imagens do demo são silhuetas ilustrativas, não fotos reais. Para a landing
convencer, o ideal é trocar por resultados reais gerados quando o fal.ai estiver ligado.

## CTA

Um só: **Criar conta grátis** (ganha 20 créditos), apontando para `<url do app>/entrar`.
O domínio ainda não existe; usar uma constante.
