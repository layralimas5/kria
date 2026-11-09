import { z } from 'zod'
import { ratio, type Analytics } from './adminAnalytics'

// Negócio (`admin_business`, 0025): MRR mês a mês, custo de IA, créditos, despesas e rentabilidade por
// plano, mais os sinais automáticos e o CSV. A central de comando (`commandCenter.ts`) usa esta leitura.

const num = z.coerce.number()
const list = <T extends z.ZodTypeAny>(item: T) =>
  z
    .array(item)
    .nullable()
    .transform((rows) => rows ?? [])

export const EXPENSE_CATEGORIES = ['infra', 'tools', 'marketing', 'taxes', 'payroll', 'services', 'other'] as const
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export const EXPENSE_LABELS: Readonly<Record<ExpenseCategory, string>> = {
  infra: 'Infraestrutura',
  tools: 'Ferramentas e assinaturas',
  marketing: 'Marketing e anúncios',
  taxes: 'Impostos',
  payroll: 'Pessoas e pró-labore',
  services: 'Serviços contratados',
  other: 'Outros',
}

const expenseSchema = z.object({
  id: z.string(),
  incurred_on: z.string(),
  category: z.enum(EXPENSE_CATEGORIES).catch('other'),
  description: z.string(),
  amount_cents: num,
  created_at: z.string(),
  voided_at: z.string().nullable(),
  void_reason: z.string().nullable(),
})
export type Expense = z.infer<typeof expenseSchema>

const planRowSchema = z.object({
  slug: z.string(),
  name: z.string(),
  price_cents: num,
  users: num,
  received_cents: num,
  ai_cost_brl: num,
  credits: num,
})
export type PlanProfit = z.infer<typeof planRowSchema>

export const businessSchema = z.object({
  period: z.object({ from: z.string(), to: z.string() }),
  ai: z.object({
    cost_brl: num,
    cost_previous_brl: num,
    generations: num,
    generations_previous: num,
    unknown_cost: num,
    estimated_cost: num,
  }),
  credits: z.object({ distributed: num, consumed: num, available: num }),
  credit_series: list(z.object({ day: z.string(), distributed: num, consumed: num })),
  conversion: z.object({ signups: num, converted: num, signups_previous: num, converted_previous: num }),
  unusual_users: z
    .array(z.object({ user_id: z.string(), email: z.string().nullable(), credits: num, generations: num, cost_brl: num.nullable() }))
    .nullable(),
  money: z
    .object({
      payment_fee_rate: num,
      min_margin_rate: num,
      received_cents: num,
      expenses_cents: num,
      expenses: list(expenseSchema),
      mrr_series: list(z.object({ month: z.string(), mrr_cents: num })),
      revenue_series: list(z.object({ day: z.string(), revenue_cents: num, ai_cost_brl: num })),
      plans: list(planRowSchema),
    })
    .nullable(),
})
export type Business = z.infer<typeof businessSchema>

const cents = (brl: number) => Math.round(brl * 100)

/** Margem de contribuição do plano no período: (recebido − custo de IA dos usuários do plano) ÷ recebido. */
export const planMargin = (plan: PlanProfit): number | null =>
  plan.received_cents > 0 ? (plan.received_cents - cents(plan.ai_cost_brl)) / plan.received_cents : null

// --------------------------------------------------------------- insights

export interface Insight {
  readonly id: string
  readonly tone: 'warning' | 'info' | 'good'
  readonly title: string
  readonly detail: string
}

const COST_RISE = 0.15
const CONVERSION_DROP = 0.2
const MIN_SIGNUPS = 5
const USAGE_GROWTH = 0.5
const USAGE_DROP = 0.4
const MIN_USES = 10

const pct = (value: number) => `${Math.round(value * 100)}%`
const brl = (valueCents: number) => (valueCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * Regras fixas sobre os números reais do período (sem chamar IA). Cada regra só dispara com volume
 * mínimo, para não transformar um caso isolado em tendência.
 */
export function buildInsights(business: Business, tools: Analytics['tools'] | null, minMargin: number): Insight[] {
  const insights: Insight[] = []
  const { ai, conversion } = business

  const avg = ratio(ai.cost_brl, ai.generations)
  const previousAvg = ratio(ai.cost_previous_brl, ai.generations_previous)
  if (avg !== null && previousAvg !== null && previousAvg > 0 && ai.generations >= MIN_USES) {
    const delta = (avg - previousAvg) / previousAvg
    if (delta >= COST_RISE) {
      insights.push({
        id: 'cost-per-generation',
        tone: 'warning',
        title: `Custo médio por geração subiu ${pct(delta)}`,
        detail: `De ${brl(cents(previousAvg))} para ${brl(cents(avg))} por geração. Confira se o uso migrou para modelos mais caros.`,
      })
    }
  }

  const rate = ratio(conversion.converted, conversion.signups)
  const previousRate = ratio(conversion.converted_previous, conversion.signups_previous)
  if (rate !== null && previousRate !== null && previousRate > 0 && conversion.signups >= MIN_SIGNUPS) {
    const delta = (rate - previousRate) / previousRate
    if (delta <= -CONVERSION_DROP) {
      insights.push({
        id: 'conversion',
        tone: 'warning',
        title: 'Conversão para plano pago caiu',
        detail: `${pct(rate)} dos cadastros pagaram, contra ${pct(previousRate)} no período anterior.`,
      })
    }
  }

  for (const tool of tools?.by_tool ?? []) {
    if (tool.previous_total >= MIN_USES && tool.total >= tool.previous_total * (1 + USAGE_GROWTH)) {
      insights.push({
        id: `growth-${tool.model_slug}`,
        tone: 'info',
        title: `${tool.name} cresceu ${pct((tool.total - tool.previous_total) / tool.previous_total)}`,
        detail: `${tool.total} usos contra ${tool.previous_total} no período anterior. Acompanhe o custo desse modelo.`,
      })
    } else if (tool.previous_total >= MIN_USES && tool.total <= tool.previous_total * (1 - USAGE_DROP)) {
      insights.push({
        id: `drop-${tool.model_slug}`,
        tone: 'warning',
        title: `Uso de ${tool.name} caiu`,
        detail: `${tool.total} usos contra ${tool.previous_total} no período anterior.`,
      })
    }
  }

  const unusual = business.unusual_users ?? []
  if (unusual.length > 0) {
    const top = unusual[0]
    insights.push({
      id: 'unusual-users',
      tone: 'info',
      title: `${unusual.length} conta(s) com consumo fora da curva`,
      detail: `Consumo pelo menos 3× acima da mediana. A maior: ${top?.email ?? 'conta sem e-mail'}, ${top?.credits ?? 0} créditos.`,
    })
  }

  for (const plan of business.money?.plans ?? []) {
    const margin = planMargin(plan)
    if (margin !== null && margin < minMargin) {
      insights.push({
        id: `plan-${plan.slug}`,
        tone: 'warning',
        title: `Plano ${plan.name} com margem reduzida`,
        detail: `${pct(margin)} de margem de contribuição no período (meta ${pct(minMargin)}).`,
      })
    } else if (plan.received_cents === 0 && plan.ai_cost_brl > 0) {
      insights.push({
        id: `plan-cost-${plan.slug}`,
        tone: 'info',
        title: `${plan.name} custou ${brl(cents(plan.ai_cost_brl))} em IA`,
        detail: 'Custo de quem está nesse plano sem receita no período (grátis ou cortesia).',
      })
    }
  }

  return insights
}

// --------------------------------------------------------------- relatório

export type CsvValue = string | number | null

/** CSV para Excel em português: ponto e vírgula, decimal com vírgula e BOM. */
export function toCsv(header: readonly string[], rows: readonly (readonly CsvValue[])[]): string {
  const cell = (value: CsvValue) => {
    if (value === null) return ''
    const text = typeof value === 'number' ? String(Number(value.toFixed(4))).replace('.', ',') : value
    return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  return `﻿${[header, ...rows].map((row) => row.map(cell).join(';')).join('\r\n')}`
}

export function downloadCsv(filename: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
