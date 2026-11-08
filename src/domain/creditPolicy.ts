import { z } from 'zod'

// Política de crédito v2 (0018 `admin_model_quotes`): quanto cada operação custa em créditos
// quando o crédito vira orçamento de R$ 0,01. A conta mora no banco (`quote_credits`); aqui fica
// o contrato e o que a tela precisa para comparar o preço atual com o cotado.

const num = z.coerce.number()

// ------------------------------------------------------------- tarifa (0019)

/** Tarifa oficial do fornecedor, na unidade em que ele cobra. Mesmo formato de `models.pricing`. */
export const tariffSchema = z.discriminatedUnion('unit', [
  z.object({ unit: z.literal('image'), usd: z.number().positive(), resolution_multipliers: z.record(z.number().positive()).optional() }),
  z.object({ unit: z.literal('second'), usd: z.number().positive(), usd_audio: z.number().positive().optional() }),
  z.object({
    unit: z.literal('token'),
    input_usd_per_mtok: z.number().positive(),
    output_usd_per_mtok: z.number().positive(),
    est_input_tokens: z.number().int().positive().nullable(),
    est_output_tokens: z.number().int().positive().nullable(),
  }),
])
export type Tariff = z.infer<typeof tariffSchema>

const roundUsd = (value: number) => Math.round(value * 1_000_000) / 1_000_000

function seconds(value: unknown): number | null {
  const digits = String(value ?? '').replace(/[^0-9.]/g, '')
  return digits === '' ? null : Number(digits)
}

/** Mesma conta de `operation_cost_usd` no banco: nulo quando a tarifa não basta (nunca inventa). */
export function tariffCostUsd(tariff: Tariff, params: Readonly<Record<string, unknown>>): number | null {
  if (tariff.unit === 'image') {
    const images = typeof params.num_images === 'number' ? params.num_images : 1
    const resolution = typeof params.resolution === 'string' ? params.resolution : null
    const multiplier = resolution === null ? (tariff.resolution_multipliers?.['1K'] ?? 1) : tariff.resolution_multipliers?.[resolution]
    return multiplier === undefined ? null : roundUsd(tariff.usd * images * multiplier)
  }
  if (tariff.unit === 'second') {
    const duration = seconds(params.duration)
    const rate = params.generate_audio === true ? tariff.usd_audio : tariff.usd
    return duration === null || rate === undefined ? null : roundUsd(rate * duration)
  }
  if (tariff.est_input_tokens === null || tariff.est_output_tokens === null) return null
  return roundUsd((tariff.est_input_tokens * tariff.input_usd_per_mtok + tariff.est_output_tokens * tariff.output_usd_per_mtok) / 1_000_000)
}

/** Créditos v2 de uma operação: custo × câmbio × segurança ÷ orçamento, para cima (mesma conta de `quote_credits`). */
export function quoteCredits(costUsd: number, settings: { readonly usd_brl: number; readonly safety_factor: number; readonly credit_budget_brl: number }): number {
  return Math.max(1, Math.ceil(Number(((costUsd * settings.usd_brl * settings.safety_factor) / settings.credit_budget_brl).toFixed(6))))
}

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
  pricing: tariffSchema.nullable(),
  cost_drift_at: z.string().nullable(),
  cost_drift_note: z.string().nullable(),
  trusted: z.boolean(),
  avg_input_tokens: num.nullable(),
  avg_output_tokens: num.nullable(),
  max_output_tokens: num.nullable(),
  reconciled: num,
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
    next_welcome_credits: num,
    require_trusted_cost: z.boolean(),
    max_operation_cost_usd: num,
    welcome_daily_cap: num,
    price_drift_tolerance: num,
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

// --------------------------------------------------- checagem da virada (0019)

export const ACTIVATION_BLOCKERS = {
  already_activated: 'Os preços v2 já estão ligados.',
  pause_required: 'Pause as gerações na Guarda de gasto.',
  open_generations: 'Ainda há geração em andamento ou crédito reservado. Espere terminar.',
  unverified_models: 'Há modelo ativo sem custo conferido. Cadastre a tarifa ou desligue o modelo.',
} as const

export const ACTIVATION_WARNINGS = {
  margin_below_target: 'Algum plano novo fica abaixo da meta de margem no uso integral. Só liga com aceite explícito e permissão de exceção.',
  operation_above_cap: 'Algum modelo ativo custa mais que o teto por operação e vai ser recusado na geração.',
} as const

const blockerSchema = z.enum(Object.keys(ACTIVATION_BLOCKERS) as [keyof typeof ACTIVATION_BLOCKERS, ...(keyof typeof ACTIVATION_BLOCKERS)[]])
const warningSchema = z.enum(Object.keys(ACTIVATION_WARNINGS) as [keyof typeof ACTIVATION_WARNINGS, ...(keyof typeof ACTIVATION_WARNINGS)[]])

export const preflightSchema = z.object({
  factor: num,
  target_margin: num,
  next_welcome_credits: num,
  blockers: z.array(blockerSchema),
  warnings: z.array(warningSchema),
  wallets: z.object({ accounts: num, subscription_credits: num, purchased_credits: num, subscription_after: num, purchased_after: num }),
  welcome_granted: z.object({ accounts: num, credits: num }),
  held: z.object({ reservations: num, credits: num }),
  open_generations: num,
  subscriptions: z.array(z.object({ plan_slug: z.string(), status: z.string(), count: num, monthly_credits: num, monthly_credits_after: num })),
  packs: z.array(z.object({ slug: z.string(), name: z.string(), price_cents: num, credits: num, credits_after: num })),
  models: z.array(
    z.object({
      slug: z.string(),
      name: z.string(),
      active: z.boolean(),
      trusted: z.boolean(),
      drift: z.string().nullable(),
      credits: num,
      provider_cost_usd: num.nullable(),
      credits_after: num.nullable(),
      legacy_brl_per_credit: num.nullable(),
    }),
  ),
  plans: z.array(z.object({ slug: z.string(), name: z.string(), price_cents: num, monthly_credits: num, full_use_margin: num.nullable() })),
})
export type Preflight = z.infer<typeof preflightSchema>

/**
 * Quanto o poder de compra de um modelo muda na virada: o crédito de hoje compra `legacy_brl_per_credit`
 * de custo nesse modelo; a conversão assume o custo médio (R$ 0,09). Acima de zero, quem tem saldo ganha
 * nesse modelo; abaixo, perde.
 */
export function conversionDeviation(legacyBrlPerCredit: number | null, legacyCostPerCreditBrl: number): number | null {
  if (legacyBrlPerCredit === null || legacyBrlPerCredit <= 0) return null
  return Math.round((legacyCostPerCreditBrl / legacyBrlPerCredit - 1) * 10_000) / 10_000
}
