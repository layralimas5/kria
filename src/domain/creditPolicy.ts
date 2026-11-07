import { z } from 'zod'

// Política de crédito v2 (0018 `admin_model_quotes`): quanto cada operação custa em créditos
// quando o crédito vira orçamento de R$ 0,01. A conta mora no banco (`quote_credits`); aqui fica
// o contrato e o que a tela precisa para comparar o preço atual com o cotado.

const num = z.coerce.number()

export const modelQuoteSchema = z.object({
  slug: z.string(),
  name: z.string(),
  kind: z.enum(['image', 'video', 'text']),
  provider: z.string(),
  endpoint: z.string(),
  defaults: z.record(z.unknown()),
  active: z.boolean(),
  credits: num,
  provider_cost_usd: num.nullable(),
  cost_checked_at: z.string().nullable(),
  cost_source: z.string().nullable(),
  basis: z.enum(['provider_cost', 'legacy_estimate']),
  estimated_brl: num,
  protected_brl: num,
  quoted_credits: num,
  stale: z.boolean(),
})
export type ModelQuote = z.infer<typeof modelQuoteSchema>

export const modelQuotesSchema = z.object({
  settings: z.object({
    usd_brl: num,
    safety_factor: num,
    credit_budget_brl: num,
    legacy_cost_per_credit_brl: num,
    cost_stale_days: num,
    credit_scale: num,
    scale_activated_at: z.string().nullable(),
    welcome_credits: num,
  }),
  models: z.array(modelQuoteSchema),
})
export type ModelQuotes = z.infer<typeof modelQuotesSchema>

/** Fator da virada: cada crédito de hoje vira esse tanto de créditos v2 (mesmo poder de compra). */
export function scaleFactor(settings: ModelQuotes['settings']): number {
  return (settings.legacy_cost_per_credit_brl * settings.safety_factor) / settings.credit_budget_brl
}

/** Parâmetros que definem o custo da operação: duração, resolução e áudio, quando o modelo tem. */
export function operationSpecs(defaults: Readonly<Record<string, unknown>>): string {
  const parts: string[] = []
  if (typeof defaults.duration === 'string') parts.push(`${defaults.duration.replace(/s$/, '')} s`)
  if (typeof defaults.resolution === 'string') parts.push(defaults.resolution)
  if (defaults.generate_audio === true) parts.push('com áudio')
  return parts.join(' · ')
}

/** O que a Free compra com as boas-vindas: a operação mais barata que cabe. */
export function welcomeCovers(welcomeCredits: number, quotes: readonly ModelQuote[]): ModelQuote | null {
  const affordable = quotes.filter((quote) => quote.active && quote.quoted_credits <= welcomeCredits)
  return affordable.sort((a, b) => a.quoted_credits - b.quoted_credits)[0] ?? null
}
