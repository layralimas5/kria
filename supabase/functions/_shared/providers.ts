// O que é do fornecedor e não muda por modelo. O que muda por modelo (endpoint,
// créditos, custo, opções aceitas, planos, ativo) fica na tabela `models`.
// Fornecedor novo entra aqui com um cliente próprio em `_shared/` e linhas em `models`.
// Só integração oficial, documentada e permitida em contrato.

export type Modality = 'image' | 'video' | 'text'

export interface ProviderInfo {
  readonly id: string
  readonly modalities: readonly Modality[]
  /** Assíncrono: a geração fica aberta e o resultado chega por webhook ou polling. */
  readonly async: boolean
  /** Depois disso a geração é dada como perdida e os créditos voltam. */
  readonly timeoutMs: number
  readonly docs: string
}

export const PROVIDERS = {
  fal: {
    id: 'fal',
    modalities: ['image', 'video'],
    async: true,
    timeoutMs: 30 * 60 * 1000,
    docs: 'https://fal.ai/docs/model-apis/model-endpoints/queue',
  },
  anthropic: {
    id: 'anthropic',
    modalities: ['text'],
    async: false,
    // Abaixo do limite de tempo da edge function, com uma nova tentativa automática do SDK.
    timeoutMs: 90_000,
    docs: 'https://docs.claude.com/en/api/messages',
  },
} as const satisfies Record<string, ProviderInfo>

export type ProviderId = keyof typeof PROVIDERS

/**
 * Confere a linha do catálogo antes de gastar: fornecedor desconhecido ou
 * modalidade que ele não faz é erro de configuração, não do usuário.
 */
export function providerFor(id: string, kind: Modality): ProviderInfo {
  const provider = (PROVIDERS as Record<string, ProviderInfo | undefined>)[id]
  if (!provider) throw new Error(`fornecedor desconhecido no catálogo: ${id}`)
  if (!provider.modalities.includes(kind)) throw new Error(`${id} não gera ${kind}`)
  return provider
}
