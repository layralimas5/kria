# Formatos

Vídeos e fotos prontos para um nicho. A pessoa escolhe o formato, manda a foto,
marca as opções e gera. O prompt é montado no servidor, nunca vem do navegador.
Ideia tirada do vídeo do Felipe Lona ("Do ZERO a $1.000.000"): vender vídeo
feito com IA para imobiliárias.

Branch `feat/vynkio-formatos` (saiu de `feat/vynkio-admin`), migration `0015_formats`.

## Como funciona

- `formats` (0015): uma linha por formato. `fields` são as opções (só escolhas da
  lista, sem texto livre), `prompt_template` usa `{key}` e fica fora do alcance do
  navegador (grant por coluna). Formato novo é um `insert`, sem deploy.
- `flow = 'single'`: foto → resultado. `flow = 'before_after'`: foto → foto editada
  (`edit_model_slug`) → vídeo do antes ao depois (Kling 3.0 com `end_image_url`).
  A pessoa vê o depois antes de pagar o vídeo.
- Foto enviada (`uploads`): sobe direto para `media/<user_id>/uploads/` e é
  registrada por `register_upload`, que exige a confirmação "sem pessoas e com
  direito de uso". Limite de 60 fotos por dia. Toda geração que descende de foto
  enviada fica com `from_upload = true` e **nunca vira persona** (regra anti-deepfake).
- O modelo `foto-edicao` (Nano Banana 2 edit com proporção `auto`) tem `studio = false`:
  serve aos formatos e não aparece no Studio.
- A function `generate` aceita `{ format: { slug, step, fields, note }, uploadId, endGenerationId? }`.
  O detalhe opcional (até 200 caracteres) passa pelo mesmo filtro de prompt.

## Primeiro lote

| Formato | Nicho | Custo |
|---|---|---|
| Tour do cômodo | Imóveis | 40 |
| Antes e depois | Imóveis | 6 + 40 |
| Vista de drone | Imóveis | 40 |
| Produto girando | E-commerce | 40 |
| Produto em cena | E-commerce | 6 |
| Prato que ganha vida | Restaurantes | 40 |

## Para ir ao ar

1. ~~Aplicar as migrations até a 0015.~~ Feito em 27/10 (0009 a 0015 pelo SQL Editor).
2. Deploy da function `generate`.
3. Testar com o fal de verdade um de cada formato e ajustar os prompts na tabela.
   O Kling 3.0 não tem proporção: o vídeo sai no formato da foto.
4. Gerar um exemplo real de cada formato, subir em `media/` e preencher `example_path`
   (até lá o card mostra o ícone do nicho, sem prévia inventada).

## Pendências e decisões a revisar

- O vídeo do antes e depois não leva o aviso "imagem ilustrativa" gravado; a tela
  orienta a avisar no anúncio. Gravar o selo exige montar o vídeo no servidor.
- Tamanho máximo de 10 MB conferido só no navegador; o bucket aceita até 100 MB.
- O "Tour completo" (várias fotos num vídeo com endereço e preço) ficou para depois.

## Retomar em 28/10

Estado em 27/10: banco na 0015, mas nenhuma edge function publicada e nenhum secret no projeto
`dhjnicbfrvmjzfbadcba`. A CLI está logada.

1. Criar conta no fal.ai, pôr saldo (US$ 10 testa tudo) e gerar a chave em Keys.
2. Criar a chave da Anthropic (console.anthropic.com) com limite de gasto mensal.
3. Preencher `FAL_KEY` e acrescentar `ANTHROPIC_API_KEY` em `../kria-integrate/supabase/.env`
   (se `ASAAS_API_KEY` vazia der erro, apagar a linha por enquanto).
4. Na pasta `kria-pricing`:
   ```
   npx supabase secrets set --env-file ..\kria-integrate\supabase\.env --project-ref dhjnicbfrvmjzfbadcba
   npx supabase functions deploy --project-ref dhjnicbfrvmjzfbadcba --use-api
   ```
5. Domínio: publicar o front, trocar `APP_URL` nos secrets e o `site_url` do Auth para o domínio final
   (passo 5 de `docs/deploy.md`).
6. Testar um formato de cada tipo no fal real e ajustar os prompts na tabela `formats`.
