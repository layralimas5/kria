import { z } from 'zod'
import { ratio } from './adminAnalytics'

// Modelos e custos (0025 `admin_ai_costs`): contrato com o banco, alertas e rótulos.
// O banco soma; aqui só se deriva o que a tela mostra (médias, margens, alertas).

const num = z.coerce.number()
const nullableNum = z.coerce.number().nullable()

export const COST_UNITS = ['image', 'second', 'token'] as const
export type CostUnit = (typeof COST_UNITS)[number]

export const UNIT_LABELS: Readonly<Record<CostUnit, string>> = {
  image: 'por imagem',
  second: 'por segundo de vídeo',
  token: 'por milhão de tokens',
}

export const PROVIDER_LABELS: Readonly<Record<string, string>> = { fal: 'fal.ai', anthropic: 'Anthropic' }
export const providerLabel = (provider: string) => PROVIDER_LABELS[provider] ?? provider

const costModelSchema = z.object({
  slug: z.string(),
  name: z.string(),
  provider: z.string(),
  endpoint: z.string(),
  kind: z.enum(['image', 'video', 'text']),
  active: z.boolean(),
  credits: num,
  pricing: z.record(z.unknown()).nullable(),
  provider_cost_usd: nullableNum,
  target_margin_rate: nullableNum,
  cost_checked_at: z.string().nullable(),
  cost_source: z.string().nullable(),
  unit: z.enum(COST_UNITS).catch('image'),
  unit_margin: nullableNum,
  uses_period: num,
  uses_previous: num,
  uses_total: num,
  uses_7d: num,
  uses_prev_7d: num,
  credits_period: num,
  cost_period_brl: num,
  cost_total_brl: num,
  metered: num,
  unknown: num,
})
export type CostModel = z.infer<typeof costModelSchema>

const breakdownSchema = z.object({ generations: num, cost_brl: num, credits: num })

export const aiCostsSchema = z.object({
  period: z.object({ from: z.string(), to: z.string() }),
  usd_brl: num,
  credit_value_brl: num,
  min_margin_rate: num,
  max_operation_cost_usd: num,
  kpis: z.object({
    cost_today_brl: num,
    cost_7d_brl: num,
    cost_month_brl: num,
    cost_total_brl: num,
    cost_period_brl: num,
    cost_previous_brl: num,
    generations: num,
    generations_previous: num,
    failed_billed: num,
    credits: num,
    credits_previous: num,
    active_users: num,
    metered: num,
    estimated: num,
    unknown: num,
    revenue_estimated_brl: nullableNum,
  }),
  models: z.array(costModelSchema),
  series: z.array(z.object({ day: z.string(), cost_brl: num, credits: num, generations: num })).nullable().transform((rows) => rows ?? []),
  trend_30d: z.array(z.object({ day: z.string(), cost_brl: num })).nullable().transform((rows) => rows ?? []),
  by_provider: z.array(breakdownSchema.extend({ provider: z.string() })),
  by_kind: z.array(breakdownSchema.extend({ kind: z.string() })),
  providers: z.array(z.string()),
})
export type AiCosts = z.infer<typeof aiCostsSchema>

export const priceHistorySchema = z.array(
  z.object({
    id: num,
    credits: num,
    pricing: z.record(z.unknown()).nullable(),
    provider_cost_usd: nullableNum,
    target_margin_rate: nullableNum,
    active: z.boolean(),
    effective_from: z.string(),
    effective_to: z.string().nullable(),
    changed_by_email: z.string().nullable(),
  }),
)
export type PriceHistory = z.infer<typeof priceHistorySchema>

export interface CostSummary {
  readonly avgPerGeneration: number | null
  readonly avgPerActiveUser: number | null
  readonly grossMargin: number | null
  readonly trustedShare: number | null
}

export function summarizeCosts(data: AiCosts): CostSummary {
  const { kpis } = data
  const revenue = kpis.revenue_estimated_brl
  return {
    avgPerGeneration: ratio(kpis.cost_period_brl, kpis.generations),
    avgPerActiveUser: ratio(kpis.cost_period_brl, kpis.active_users),
    grossMargin: revenue === null || revenue <= 0 ? null : (revenue - kpis.cost_period_brl) / revenue,
    trustedShare: ratio(kpis.metered + kpis.estimated, kpis.generations),
  }
}

/** Custo por unidade tarifável na moeda do fornecedor, a partir da tarifa cadastrada. */
export function unitPriceUsd(model: Pick<CostModel, 'pricing' | 'unit'>): { readonly label: string; readonly value: number | null } {
  const pricing = model.pricing ?? {}
  const read = (key: string) => (typeof pricing[key] === 'number' ? (pricing[key] as number) : null)
  if (model.unit === 'token') {
    const input = read('input_usd_per_mtok')
    const output = read('output_usd_per_mtok')
    return { label: input === null || output === null ? 'sem tarifa' : `US$ ${input} entrada · US$ ${output} saída`, value: input }
  }
  const usd = read('usd')
  return { label: usd === null ? 'sem tarifa' : `US$ ${usd.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}`, value: usd }
}

export type CostAlertKind = 'margin' | 'cost' | 'spike' | 'unknown'

export interface CostAlert {
  readonly kind: CostAlertKind
  readonly model: string
  readonly slug: string
  readonly message: string
}

/** Uso da semana acima do dobro da anterior e com volume que importa. */
const SPIKE_FACTOR = 2
const SPIKE_MIN_USES = 10
/** Custo por operação acima de 80% do teto por operação da plataforma. */
const HIGH_COST_SHARE = 0.8

export function costAlerts(data: AiCosts): CostAlert[] {
  const alerts: CostAlert[] = []
  for (const model of data.models) {
    if (!model.active) continue
    const target = model.target_margin_rate ?? data.min_margin_rate
    if (model.unit_margin !== null && model.unit_margin < target) {
      alerts.push({
        kind: 'margin',
        model: model.name,
        slug: model.slug,
        message: `Margem de ${Math.round(model.unit_margin * 100)}% por geração, abaixo da meta de ${Math.round(target * 100)}%.`,
      })
    }
    if (model.provider_cost_usd !== null && model.provider_cost_usd >= data.max_operation_cost_usd * HIGH_COST_SHARE) {
      alerts.push({
        kind: 'cost',
        model: model.name,
        slug: model.slug,
        message: `Custo de US$ ${model.provider_cost_usd.toFixed(2)} por geração, perto do teto de US$ ${data.max_operation_cost_usd.toFixed(2)}.`,
      })
    }
    if (model.uses_7d >= SPIKE_MIN_USES && model.uses_7d > model.uses_prev_7d * SPIKE_FACTOR) {
      alerts.push({
        kind: 'spike',
        model: model.name,
        slug: model.slug,
        message: `${model.uses_7d} usos nos últimos 7 dias contra ${model.uses_prev_7d} na semana anterior.`,
      })
    }
    if (model.unknown > 0) {
      alerts.push({
        kind: 'unknown',
        model: model.name,
        slug: model.slug,
        message: `${model.unknown} geração(ões) no período sem tarifa cadastrada: o custo não entra nos totais.`,
      })
    }
  }
  return alerts
}

export interface CostFilters {
  readonly provider: string | null
  readonly kind: string | null
  readonly model: string | null
  readonly active: boolean | null
}

export const NO_COST_FILTERS: CostFilters = { provider: null, kind: null, model: null, active: null }
