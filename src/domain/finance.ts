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
  payment_fee_fixed_cents: num.default(0),
  storage_cents_per_subscriber: num.default(0),
  transfer_cents_per_subscriber: num.default(0),
  other_variable_cents_per_subscriber: num.default(0),
})
export type FinanceSettings = z.infer<typeof financeSettingsSchema>

const financePlanSchema = z.object({
  slug: z.string(),
  name: z.string(),
  line: z.enum(['creator', 'business']),
  status: z.enum(['draft', 'live', 'legacy']),
  price_cents: num,
  monthly_credits: num,
  max_exports_month: num.nullable(),
  ai_budget_cents: num.nullable(),
  /** Margem de contribuição com o plano usado por inteiro (0019 `plan_full_use_margin`). */
  full_use_margin: num.nullable(),
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
  trusted: z.boolean(),
  total: num,
  failed: num,
  billed: num,
  credits: num,
  cost_usd: num,
  /** Custo previsto na autorização (tarifa × configuração), para comparar com o gasto reconciliado. */
  quoted_cost_usd: num,
  reconciled: num,
  estimated: num,
  deficit: num,
})
export type FinanceModel = z.infer<typeof financeModelSchema>

export const financeSchema = z.object({
  period: z.object({ from: z.string(), to: z.string(), days: num }),
  usd_brl: num,
  payment_fee_rate: num,
  credit_scale: num,
  credit_budget_brl: num,
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
  credits_consumed: num,
  exports_done: num,
  exports_failed: num,
  export_render_ms: num,
  export_bytes: num,
  export_seconds: num,
  export_resolutions: z.record(num),
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
  /** Custos variáveis além de API, render, gateway e tributo (armazenamento, transferência, taxa fixa). */
  readonly extraVariableCents?: number
}

export interface Statement {
  readonly netRevenueCents: number
  readonly gatewayCents: number
  readonly taxesCents: number
  readonly apiCostCents: number
  readonly renderCents: number
  readonly otherVariableCents: number
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
  const otherVariableCents = Math.round(input.extraVariableCents ?? 0)
  const variableCents = input.apiCostCents + renderCents + gatewayCents + taxesCents + otherVariableCents
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
    otherVariableCents,
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

/**
 * Como a base usa o plano. A parcela dos créditos e das exportações vale para os cenários de 25% e 60%;
 * no de 100% todo benefício é usado, qualquer que seja o perfil. "MB por crédito" é o peso médio do
 * arquivo gerado (hipótese: foto ~1,5 MB a 52 créditos, vídeo ~6 MB a 406), para armazenamento e transferência.
 */
export interface ConsumptionProfile {
  readonly id: 'images' | 'videos' | 'multiplier' | 'mixed' | 'premium'
  readonly label: string
  readonly creditShare: number
  readonly exportShare: number
  readonly mbPerCredit: number
}

export const CONSUMPTION_PROFILES: readonly ConsumptionProfile[] = [
  { id: 'images', label: 'Foco em imagens', creditShare: 1, exportShare: 0.2, mbPerCredit: 0.03 },
  { id: 'videos', label: 'Foco em vídeos', creditShare: 1, exportShare: 0.4, mbPerCredit: 0.015 },
  { id: 'multiplier', label: 'Foco no Multiplicador', creditShare: 0.3, exportShare: 1, mbPerCredit: 0.005 },
  { id: 'mixed', label: 'Consumo misto', creditShare: 0.8, exportShare: 0.6, mbPerCredit: 0.02 },
  { id: 'premium', label: 'Modelos premium', creditShare: 1, exportShare: 0.3, mbPerCredit: 0.006 },
]

export interface SimulatorInput {
  readonly plans: readonly SimulatorPlan[]
  readonly profile: ConsumptionProfile
  /** Custo real de IA por crédito usado, em centavos (1,00 conta a reserva de segurança como gasta). */
  readonly aiCostPerCreditCents: number
  readonly editCostCentsPerExport: number
  readonly paymentFeeRate: number
  readonly paymentFeeFixedCents: number
  readonly storageCentsPerGb: number
  readonly transferCentsPerGb: number
  readonly otherVariableCentsPerSubscriber: number
  readonly settings: FinanceSettings
  readonly acquisitionCents: number
  readonly supportCents: number
}

export const UTILIZATIONS = [0.25, 0.6, 1] as const
export type Utilization = (typeof UTILIZATIONS)[number]

export interface Scenario {
  readonly utilization: Utilization
  readonly label: string
  readonly description: string
  readonly subscribers: number
  readonly revenueCents: number
  readonly creditUse: number
  readonly exportUse: number
  readonly statement: Statement
  /** Assinantes (no mesmo mix de planos) para cobrir custos fixos; e com pró-labore. */
  readonly breakEvenSubscribers: number | null
  readonly breakEvenWithProLaboreSubscribers: number | null
}

const MB_PER_GB = 1024

/** Uso de créditos e exportações num cenário: 100% é tudo usado; abaixo disso, a parcela do perfil. */
export function scenarioUsage(utilization: Utilization, profile: ConsumptionProfile): { credits: number; exports: number } {
  if (utilization === 1) return { credits: 1, exports: 1 }
  return { credits: Math.min(1, utilization * profile.creditShare), exports: Math.min(1, utilization * profile.exportShare) }
}

function runScenario(input: SimulatorInput, utilization: Utilization) {
  const usage = scenarioUsage(utilization, input.profile)
  let revenueCents = 0
  let aiCents = 0
  let exports = 0
  let subscribers = 0
  let gigabytes = 0
  for (const plan of input.plans) {
    const count = plan.subscribers
    subscribers += count
    revenueCents += count * plan.priceCents
    const creditsUsed = plan.monthlyCredits * usage.credits
    aiCents += count * Math.min(creditsUsed * input.aiCostPerCreditCents, plan.aiBudgetCents)
    exports += count * plan.exportsPerMonth * usage.exports
    gigabytes += (count * creditsUsed * input.profile.mbPerCredit) / MB_PER_GB
  }
  const paying = input.plans.filter((plan) => plan.priceCents > 0).reduce((sum, plan) => sum + plan.subscribers, 0)
  const extraVariableCents =
    paying * input.paymentFeeFixedCents + subscribers * input.otherVariableCentsPerSubscriber + gigabytes * (input.storageCentsPerGb + input.transferCentsPerGb)
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
    extraVariableCents,
  })
  const perSubscriber = subscribers > 0 ? statement.contributionCents / subscribers : 0
  const breakEven = (costCents: number) => (perSubscriber > 0 ? Math.ceil(costCents / perSubscriber) : null)
  return {
    subscribers,
    revenueCents,
    creditUse: usage.credits,
    exportUse: usage.exports,
    statement,
    breakEvenSubscribers: breakEven(statement.fixedCents),
    breakEvenWithProLaboreSubscribers: breakEven(statement.fixedCents + statement.proLaboreCents),
  }
}

const SCENARIO_TEXT: Record<Utilization, { label: string; description: string }> = {
  0.25: { label: 'Uso de 25%', description: 'Base usando pouco do plano.' },
  0.6: { label: 'Uso de 60%', description: 'Base usando boa parte do plano.' },
  1: { label: 'Uso de 100%', description: 'Todo assinante usa todos os créditos e todas as exportações.' },
}

/** Três cenários de utilização para o mesmo perfil. Uso médio passado não garante o consumo futuro. */
export function simulate(input: SimulatorInput): Scenario[] {
  return UTILIZATIONS.map((utilization) => ({ utilization, ...SCENARIO_TEXT[utilization], ...runScenario(input, utilization) }))
}
