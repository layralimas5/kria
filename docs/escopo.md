# Kria IA: escopo

## Ideia

Uma ferramenta, vários modelos de IA por trás. A pessoa não precisa saber o que é
Kling, Veo ou Nano Banana: escolhe "foto" ou "vídeo", gasta créditos e recompra
quando acabar. A diferença para Higgsfield e similares é estar em português, aceitar Pix,
cobrar em real e ser pensada para quem vende (afiliado, comércio local, perfil de IA).

## MVP (feito)

| Parte | O que faz |
|---|---|
| Conta | E-mail e senha, 20 créditos de boas-vindas |
| Estúdio | Foto por texto, foto com persona, vídeo a partir de imagem (Kling 5s, Veo 3.1 8s) |
| Personas | Gera retratos a partir da descrição, salva o escolhido, usa como referência |
| Galeria | Tudo que foi gerado, ao vivo, com baixar, animar e virar persona |
| Créditos | Pacotes 100/300/800, checkout Asaas (Pix e cartão), extrato |
| Segurança | RLS, crédito só por função SQL, filtro de prompt, sem upload de rosto, até 3 gerações simultâneas |

## Como a geração funciona

1. `generate` valida, chama `create_generation` (debita na mesma transação) e manda para a fila do fal.
2. O fal chama `fal-webhook?gid=..&t=<hmac>` quando termina.
3. O webhook consulta o resultado no fal, copia o arquivo para o Storage e chama `complete_generation`.
4. Se falhar, `fail_generation` estorna. O app também chama `generation-status` para gerações
   abertas há mais de 20s (rede de segurança) e cancela com estorno depois de 30 min.

## Fase 2 (sugerida, nesta ordem)

1. **Landing page** com exemplos reais gerados e preço por crédito.
2. **Voz e fala:** ElevenLabs + lip sync, para o influenciador falar um roteiro.
3. **LoRA da persona:** treino com 10 a 20 imagens, rosto mais fiel (cobrar 150 a 300 créditos).
4. **Plano mensal** com créditos inclusos (assinatura Asaas, como no Momentumm).
5. **Painel admin:** custo real do fal x receita, ajuste de saldo, estorno manual.
6. **Recuperar senha** e login com Google.
7. **Miniaturas do construtor de persona:** trocar os ícones dos cards (nicho, cabelo etc.) por miniaturas geradas com a própria IA, como o Higgsfield faz. Os dados ficam em `src/domain/personaTraits.ts`.
