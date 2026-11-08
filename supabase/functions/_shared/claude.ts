// Cliente do Claude para as ferramentas de texto. Uma chamada, saída estruturada,
// fallback automático da Anthropic quando o modelo principal recusa.

import Anthropic from 'npm:@anthropic-ai/sdk@0.131.0'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { ASSISTANT_OUTPUT_JSON_SCHEMA, type Effort } from './assistant.ts'
import { PROVIDERS } from './providers.ts'

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
  /** Formato da resposta; sem ele, o das ferramentas de texto (título + itens). */
  readonly schema?: Record<string, unknown>
}

export interface ClaudeUsage {
  readonly inputTokens: number
  readonly outputTokens: number
  readonly cacheWriteTokens: number
  readonly cacheReadTokens: number
}

// Preço do cache de prompt da Anthropic em relação à entrada: escrita 1,25×, leitura 0,1×.
const CACHE_WRITE_WEIGHT = 1.25
const CACHE_READ_WEIGHT = 0.1

/** Tokens de entrada equivalentes ao preço cheio, para a tarifa por token do banco. */
export function billableInputTokens(usage: ClaudeUsage): number {
  return Math.ceil(usage.inputTokens + usage.cacheWriteTokens * CACHE_WRITE_WEIGHT + usage.cacheReadTokens * CACHE_READ_WEIGHT)
}

/**
 * Grava tokens e custo real da geração (`record_text_usage`). Falhar aqui não derruba a entrega para a
 * pessoa: o custo estimado continua valendo e o erro vai para o log da function.
 */
export async function recordUsage(admin: SupabaseClient, generationId: string, usage: ClaudeUsage): Promise<void> {
  const { error } = await admin.rpc('record_text_usage', {
    p_id: generationId,
    p_input_tokens: billableInputTokens(usage),
    p_output_tokens: usage.outputTokens,
  })
  if (error) console.error('record_text_usage failed', generationId, error.message)
}

export interface ClaudeResult {
  readonly json: string
  readonly usage: ClaudeUsage
}

const MAX_OUTPUT_TOKENS = 8_000

export async function generateText(apiKey: string, request: ClaudeRequest): Promise<ClaudeResult> {
  const client = new Anthropic({ apiKey, timeout: PROVIDERS.anthropic.timeoutMs, maxRetries: 1 })
  let response: Anthropic.Beta.BetaMessage
  try {
    response = await client.beta.messages.create({
      model: request.model,
      max_tokens: MAX_OUTPUT_TOKENS,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: request.effort, format: { type: 'json_schema', schema: request.schema ?? ASSISTANT_OUTPUT_JSON_SCHEMA } },
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
  return {
    json: text,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    },
  }
}
