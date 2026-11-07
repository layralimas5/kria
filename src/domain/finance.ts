import { z } from 'zod'
import { ratio, type AlertSeverity } from './adminDashboard'

// Financeiro e rentabilidade (0018 `admin_finance`). O banco devolve números crus; o demonstrativo,
// os alertas e o simulador são contas puras daqui, para a tela só desenhar e os testes conferirem.
// Faturamento não é lucro: o caminho vai de receita a distribuível, descontando cada camada.

const num = z.coerce.number()

export const financeSettingsSchema = z.object({
  tax_rate: num,
  fixed_costs_cents: num,
  infra_costs_cents: num,
  storage_costs_cents: num,
  render_cost_cents_per_export: num,
  pro_labore_cents: num,
  reserve_rate: num,
  min_margin_rate: num,
})
export type FinanceSettings = z.infer<typeof financeSettingsSchema>

const financePlanSchema = z.object({
  slug: z.string(),
  name: z.string(),
  line: z.enum(['creator', 'business']),
  status: z.enum(['draft', 'live', 'legacy']),
  price_cents: num,
  ai_budget_cents: num.nullable(),
  subscribers: num,
  mrr_cents: num,
  revenue_cents: num,
})

const financeUserSchema = z.object({
  user_id: z.string().uuid(),
  email: z.string().nullable(),
  plan_slug: z.string(),
  ai_budget_cents: num.nullable(),
  credits: num,
  generations: num,
  cost_usd: num,
  revenue_cents: num,
  exports: num,
})
export type FinanceUser = z.infer<typeof financeUserSchema>

const financeModelSchema = z.object({
  slug: z.string(),
  name: z.string(),
  provider: z.string(),
  kind: z.string(),
  current_credits: num,
  provider_cost_usd: num.nullable(),
  cost_checked_at: z.string().nullable(),
  stale: z.boolean(),
  total: num,
  failed: num,
  billed: num,
  credits: num,
  cost_usd: num,
  estimated: num,
  deficit: num,
})
export type FinanceModel = z.infer<typeof financeModelSchema>

export const financeSchema = z.object({
  period: z.object({ from: z.string(), to: z.string(), days: num }),
  usd_brl: num,
  payment_fee_rate: num,
  credit_scale: num,
  settings: financeSettingsSchema,
  revenue_cents: num,
  revenue_previous_cents: num,
  refunds_cents: num,
  mrr_cents: num,
  active_subscriptions: num,
  api_cost_usd: num,
  api_cost_previous_usd: num,
  api_cost_estimated_count: num,
  failed_billed_usd: num,
  exports_done: num,
  export_render_ms: num,
  export_bytes: num,
  by_plan: z.array(financePlanSchema),
  by_user: z.array(financeUserSchema),
  by_model: z.array(financeModelSchema),
})
export type Finance = z.infer<typeof financeSchema>

// ---------------------------------------------------------- demonstrativo

export interface StatementInput {
  readonly revenueCents: number
  readonly refundsCents: number
  readonly apiCostCents: number
  readonly exports: number
  /** Dias do período; custos mensais entram proporcionais (30 dias = 1 mês). */
  readonly days: number
  readonly paymentFeeRate: number
  readonly settings: FinanceSettings
  /** Custos mensais extras do simulador (aquisição, suporte). */
  readonly extraFixedCents?: number
}

export interface Statement {
  readonly netRevenueCents: number
  readonly gatewayCents: number
  readonly taxesCents: number
  readonly apiCostCents: number
  readonly renderCents: number
  readonly variableCents: number
  readonly contributionCents: number
  readonly contributionRate: number | null
  readonly fixedCents: number
  readonly operatingCents: number
  readonly proLaboreCents: number
  readonly afterProLaboreCents: number
  readonly reserveCents: number
  readonly distributableCents: number
}

export function usdToCents(usd: number, usdBrl: number): number {
  return Math.round(usd * usdBrl * 100)
}

export function financeStatement(input: StatementInput): Statement {
  const { settings } = input
  const months = input.days / 30
  const netRevenueCents = input.revenueCents - input.refundsCents
  const gatewayCents = Math.round(Math.max(0, netRevenueCents) * input.paymentFeeRate)
  const taxesCents = Math.round(Math.max(0, netRevenueCents) * settings.tax_rate)
  const renderCents = input.exports * settings.render_cost_cents_per_export
  const variableCents = input.apiCostCents + renderCents + gatewayCents + taxesCents
  const contributionCents = netRevenueCents - variableCents
  const fixedCents = Math.round(
    (settings.fixed_costs_cents + settings.infra_costs_cents + settings.storage_costs_cents + (input.extraFixedCents ?? 0)) * months,
  )
  const operatingCents = contributionCents - fixedCents
  const proLaboreCents = Math.round(settings.pro_labore_cents * months)
  const afterProLaboreCents = operatingCents - proLaboreCents
  const reserveCents = Math.round(Math.max(0, afterProLaboreCents) * settings.reserve_rate)
  return {
    netRevenueCents,
    gatewayCents,
    taxesCents,
    apiCostCents: input.apiCostCents,
    renderCents,
    variableCents,
    contributionCents,
    contributionRate: ratio(contributionCents, netRevenueCents),
    fixedCents,
    operatingCents,
    proLaboreCents,
    afterProLaboreCents,
    reserveCents,
    distributableCents: Math.max(0, afterProLaboreCents - reserveCents),
  }
}

export function statementOf(finance: Finance): Statement {
  return financeStatement({
    revenueCents: finance.revenue_cents,
    refundsCents: finance.refunds_cents,
    apiCostCents: usdToCents(finance.api_cost_usd, finance.usd_brl),
    exports: finance.exports_done,
    days: finance.period.days,
    paymentFeeRate: finance.payment_fee_rate,
    settings: finance.settings,
  })
}

// ------------------------------------------------- rentabilidade por pessoa

export interface UserProfitability {
  readonly user: FinanceUser
  readonly costCents: number
  readonly marginCents: number
  /** Custo ÷ orçamento interno do plano no período; nulo sem orçamento. */
  readonly budgetUse: number | null
}

export function userProfitability(finance: Finance): UserProfitability[] {
  const months = finance.period.days / 30
  return finance.by_user.map((user) => {
    const costCents = usdToCents(user.cost_usd, finance.usd_brl)
    const budget = user.ai_budget_cents === null ? null : user.ai_budget_cents * months
    const fees = Math.round(user.revenue_cents * (finance.payment_fee_rate + finance.settings.tax_rate))
    return {
      user,
      costCents,
      marginCents: user.revenue_cents - fees - costCents - user.exports * finance.settings.render_cost_cents_per_export,
      budgetUse: budget && budget > 0 ? costCents / budget : null,
    }
  })
}

// ---------------------------------------------------------------- alertas

export interface FinanceAlert {
  readonly id: string
  readonly severity: AlertSeverity
  readonly title: string
  readonly detail: string
}

const FAILURE_RATE_ALERT = 0.2
const FAILURE_MIN_SAMPLE = 5
const BUDGET_ALERT = 0.8
const GROWTH_ALERT = 0.5

export function financeAlerts(finance: Finance, statement: Statement = statementOf(finance)): FinanceAlert[] {
  const alerts: FinanceAlert[] = []
  const usedModels = finance.by_model.filter((model) => model.total > 0)

  const stale = finance.by_model.filter((model) => model.stale && model.total > 0)
  if (stale.length > 0) {
    alerts.push({
      id: 'stale-cost',
      severity: 'warning',
      title: `${stale.length} ${stale.length === 1 ? 'modelo usado está' : 'modelos usados estão'} sem preço conferido`,
      detail: `${stale.map((model) => model.name).join(', ')}. O custo entra no pior caso até conferir o preço do fornecedor.`,
    })
  }

  for (const model of usedModels.filter((item) => item.deficit > 0)) {
    alerts.push({
      id: `deficit-${model.slug}`,
      severity: 'critical',
      title: `${model.name} custou mais do que os créditos cobrem`,
      detail: `${model.deficit} de ${model.billed} operações ficaram acima do orçamento. Revise o preço em créditos.`,
    })
  }

  for (const model of usedModels.filter((item) => item.total >= FAILURE_MIN_SAMPLE && item.failed / item.total >= FAILURE_RATE_ALERT)) {
    alerts.push({
      id: `failures-${model.slug}`,
      severity: 'warning',
      title: `${model.name} falha demais`,
      detail: `${model.failed} de ${model.total} gerações falharam no período.`,
    })
  }

  const overBudget = userProfitability(finance).filter((row) => row.budgetUse !== null && row.budgetUse >= BUDGET_ALERT)
  if (overBudget.length > 0) {
    alerts.push({
      id: 'user-budget',
      severity: overBudget.some((row) => (row.budgetUse ?? 0) >= 1) ? 'critical' : 'warning',
      title: `${overBudget.length} ${overBudget.length === 1 ? 'assinante perto' : 'assinantes perto'} do orçamento de IA`,
      detail: 'Custo de IA acima de 80% do orçamento interno do plano no período.',
    })
  }

  if (statement.contributionRate !== null && statement.contributionRate < finance.settings.min_margin_rate) {
    alerts.push({
      id: 'low-margin',
      severity: 'critical',
      title: 'Margem de contribuição abaixo do mínimo',
      detail: `${Math.round(statement.contributionRate * 100)}% no período; o mínimo configurado é ${Math.round(finance.settings.min_margin_rate * 100)}%.`,
    })
  }

  if (finance.api_cost_previous_usd > 0 && (finance.api_cost_usd - finance.api_cost_previous_usd) / finance.api_cost_previous_usd >= GROWTH_ALERT) {
    alerts.push({
      id: 'cost-growth',
      severity: 'warning',
      title: 'Custo de API cresceu rápido',
      detail: `Subiu ${Math.round(((finance.api_cost_usd - finance.api_cost_previous_usd) / finance.api_cost_previous_usd) * 100)}% contra o período anterior.`,
    })
  }

  if (finance.api_cost_estimated_count > 0) {
    alerts.push({
      id: 'estimated-cost',
      severity: 'warning',
      title: 'Parte do custo é estimativa',
      detail: `${finance.api_cost_estimated_count} operações sem custo do fornecedor cadastrado entraram no pior caso.`,
    })
  }

  return alerts.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'critical' ? -1 : 1))
}

// --------------------------------------------------------------- simulador

export interface SimulatorPlan {
  readonly name: string
  readonly priceCents: number
  readonly subscribers: number
  readonly monthlyCredits: number
  readonly exportsPerMonth: number
  /** Teto de custo de IA por assinante no mês (orçamento interno). */
  readonly aiBudgetCents: number
}

export interface SimulatorInput {
  readonly plans: readonly SimulatorPlan[]
  /** Fração média dos créditos e exportações usada (0 a 1). */
  readonly usageRate: number
  /** Custo real de IA por crédito usado, em centavos (R$ 0,01 ÷ 1,15 ≈ 0,87). */
  readonly aiCostPerCreditCents: number
  readonly editCostCentsPerExport: number
  readonly paymentFeeRate: number
  readonly settings: FinanceSettings
  readonly acquisitionCents: number
  readonly supportCents: number
}

export interface Scenario {
  readonly id: 'conservative' | 'expected' | 'heavy'
  readonly label: string
  readonly description: string
  readonly subscribers: number
  readonly revenueCents: number
  readonly statement: Statement
  /** Assinantes (no mesmo mix de planos) para cobrir custos fixos; e com pró-labore. */
  readonly breakEvenSubscribers: number | null
  readonly breakEvenWithProLaboreSubscribers: number | null
}

function runScenario(input: SimulatorInput, subscriberFactor: number, usageRate: number) {
  const usage = Math.min(1, Math.max(0, usageRate))
  let revenueCents = 0
  let aiCents = 0
  let exports = 0
  let subscribers = 0
  for (const plan of input.plans) {
    const count = Math.round(plan.subscribers * subscriberFactor)
    subscribers += count
    revenueCents += count * plan.priceCents
    aiCents += count * Math.min(plan.monthlyCredits * usage * input.aiCostPerCreditCents, plan.aiBudgetCents)
    exports += count * plan.exportsPerMonth * usage
  }
  const settings = { ...input.settings, render_cost_cents_per_export: input.editCostCentsPerExport }
  const statement = financeStatement({
    revenueCents,
    refundsCents: 0,
    apiCostCents: Math.round(aiCents),
    exports: Math.round(exports),
    days: 30,
    paymentFeeRate: input.paymentFeeRate,
    settings,
    extraFixedCents: input.acquisitionCents + input.supportCents,
  })
  const perSubscriber = subscribers > 0 ? statement.contributionCents / subscribers : 0
  const breakEven = (costCents: number) => (perSubscriber > 0 ? Math.ceil(costCents / perSubscriber) : null)
  return {
    subscribers,
    revenueCents,
    statement,
    breakEvenSubscribers: breakEven(statement.fixedCents),
    breakEvenWithProLaboreSubscribers: breakEven(statement.fixedCents + statement.proLaboreCents),
  }
}

const CONSERVATIVE_SUBSCRIBERS = 0.7
const CONSERVATIVE_EXTRA_USAGE = 0.2

/** Três cenários: todos são estimativas até haver dados reais de uso e fatura. */
export function simulate(input: SimulatorInput): Scenario[] {
  return [
    {
      id: 'conservative',
      label: 'Conservador',
      description: '30% menos assinantes e uso 20 pontos acima do esperado.',
      ...runScenario(input, CONSERVATIVE_SUBSCRIBERS, input.usageRate + CONSERVATIVE_EXTRA_USAGE),
    },
    { id: 'expected', label: 'Esperado', description: 'Assinantes e uso como preenchidos.', ...runScenario(input, 1, input.usageRate) },
    { id: 'heavy', label: 'Alto consumo', description: 'Todo assinante usa 100% dos créditos e exportações.', ...runScenario(input, 1, 1) },
  ]
}
