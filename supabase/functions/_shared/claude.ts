// Cliente do Claude para as ferramentas de texto. Uma chamada, saída estruturada,
// fallback automático da Anthropic quando o modelo principal recusa.

import Anthropic from 'npm:@anthropic-ai/sdk@0.131.0'
import { ASSISTANT_OUTPUT_JSON_SCHEMA, type Effort } from './assistant.ts'

export class ClaudeError extends Error {
  /** Mensagem que pode ir para a pessoa. */
  readonly publicMessage: string

  constructor(message: string, publicMessage: string) {
    super(message)
    this.name = 'ClaudeError'
    this.publicMessage = publicMessage
  }
}

export interface ClaudeRequest {
  readonly model: string
  readonly effort: Effort
  readonly system: string
  readonly userMessage: string
}

export interface ClaudeUsage {
  readonly inputTokens: number
  readonly outputTokens: number
}

export interface ClaudeResult {
  readonly json: string
  readonly usage: ClaudeUsage
}

// Abaixo do limite de tempo da edge function, com uma nova tentativa automática do SDK.
const TIMEOUT_MS = 90_000
const MAX_OUTPUT_TOKENS = 8_000

export async function generateText(apiKey: string, request: ClaudeRequest): Promise<ClaudeResult> {
  const client = new Anthropic({ apiKey, timeout: TIMEOUT_MS, maxRetries: 1 })
  let response: Anthropic.Beta.BetaMessage
  try {
    response = await client.beta.messages.create({
      model: request.model,
      max_tokens: MAX_OUTPUT_TOKENS,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: request.effort, format: { type: 'json_schema', schema: ASSISTANT_OUTPUT_JSON_SCHEMA } },
      system: [{ type: 'text', text: request.system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: request.userMessage }],
    })
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      throw new ClaudeError('rate limited', 'O assistente está com muitos pedidos agora. Tente de novo em um minuto.')
    }
    if (error instanceof Anthropic.APIError) {
      throw new ClaudeError(`anthropic ${error.status}: ${error.message}`, 'O assistente não respondeu agora.')
    }
    throw error
  }

  if (response.stop_reason === 'refusal') {
    throw new ClaudeError(
      `refusal: ${response.stop_details?.category ?? 'sem categoria'}`,
      'Esse pedido não pode ser atendido. Reescreva o briefing e tente de novo.',
    )
  }
  if (response.stop_reason === 'max_tokens') {
    throw new ClaudeError('max_tokens', 'A resposta ficou longa demais. Peça algo mais curto.')
  }

  const text = response.content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('')
  return { json: text, usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens } }
}
