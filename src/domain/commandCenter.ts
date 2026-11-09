import { z } from 'zod'
import { buildAlerts, change, ratio, type Dashboard } from './adminDashboard'
import type { Business } from './business'

// Central de comando do admin. Junta três leituras do banco (`admin_dashboard`, `admin_business` e
// `admin_command_center`, 0026) e define aqui, uma vez, cada número da tela. Regra da casa: sem base,
// o valor é nulo e a tela escreve "Dados insuficientes"; projeção e simulação vêm sempre marcadas.

const num = z.coerce.number()
const list = <T extends z.ZodTypeAny>(item: T) =>
  z
    .array(item)
    .nullable()
    .transform((rows) => rows ?? [])

export const FEATURES = ['image', 'video', 'text', 'character', 'format'] as const
export type Feature = (typeof FEATURES)[number]

export const FEATURE_LABELS: Readonly<Record<Feature, string>> = {
  image: 'Imagens',
  video: 'Vídeos',
  text: 'Textos e assistente',
  character: 'Personagens',
  format: 'Formatos prontos',
}

export const featureLabel = (feature: string) => FEATURE_LABELS[feature as Feature] ?? feature

export const centerSchema = z.object({
  period: z.object({ from: z.string(), to: z.string() }),
  settings: z.object({
    credit_value_brl: num,
    usd_brl: num,
    payment_fee_rate: num.nullable(),
    min_margin_rate: num.nullable(),
  }),
  plans: list(z.object({ slug: z.string(), name: z.string(), price_cents: num, monthly_credits: num, status: z.string() })),
  revenue: z
    .object({
      series: list(z.object({ day: z.string(), gross_cents: num, refunds_cents: num, previous_gross_cents: num })),
      gross_cents: num,
      refunds_cents: num,
      previous_gross_cents: num,
      previous_refunds_cents: num,
      lifetime_gross_cents: num,
      lifetime_refunds_cents: num,
      month_received_cents: num,
      projected_next_month_cents: num,
      at_risk_cents: num,
      mrr_start_cents: num,
      mrr_lost_cents: num,
      churn_30d: z.object({ base: num, lost: num, base_cents: num, lost_cents: num }),
      expenses_90d_cents: num,
      expenses_by_day: list(z.object({ day: z.string(), cents: num })),
      marketing_cents: num,
      new_paying: num,
      paying_ai_cost_brl: num,
    })
    .nullable(),
  ai: z.object({
    cost_today_brl: num,
    cost_month_brl: num,
    cost_brl: num,
    credits: num,
    events: num,
    unknown: num,
    series: list(z.object({ day: z.string(), cost_brl: num, generations: num })),
    by_feature: list(z.object({ feature: z.string(), generations: num, credits: num, cost_brl: num, users: num })),
    by_model: list(z.object({ model_slug: z.string(), name: z.string().nullable(), provider: z.string(), generations: num, credits: num, cost_brl: num })),
    model_series: list(z.object({ day: z.string(), model_slug: z.string(), cost_brl: num })),
    top_users: list(
      z.object({
        user_id: z.string(),
        email: z.string().nullable(),
        plan_name: z.string().nullable(),
        plan_slug: z.string().nullable(),
        generations: num,
        credits: num,
        cost_brl: num,
      }),
    ),
  }),
  users: z.object({
    dau: num,
    wau: num,
    mau: num,
    active_period: num,
    generations_period: num,
    never_used: num,
    used_ai: num,
    near_limit: num,
    exhausted: num,
    active_series: list(z.object({ day: z.string(), users: num })),
    cohorts: list(z.object({ cohort: z.string(), size: num, active: z.array(num.nullable()) })),
  }),
  operations: z.object({
    total: num,
    succeeded: num,
    failed: num,
    open: num,
    stuck: num,
    failed_billed: num,
    failed_billed_cost_brl: num,
    duration: list(z.object({ kind: z.string(), samples: num, avg_seconds: num, p90_seconds: num })),
    providers: list(
      z.object({
        provider: z.string(),
        total_24h: num,
        failed_24h: num,
        last_success_at: z.string().nullable(),
        last_failure_at: z.string().nullable(),
      }),
    ),
    errors: list(
      z.object({
        id: z.string(),
        at: z.string(),
        model_name: z.string(),
        provider: z.string(),
        kind: z.string(),
        error: z.string(),
        email: z.string().nullable(),
      }),
    ),
  }),
})
export type Center = z.infer<typeof centerSchema>

const DAY_MS = 86_400_000
const toCents = (brl: number) => Math.round(brl * 100)

/** Dias do período (no mínimo 1): normaliza custo do período para um mês de 30 dias. */
export function periodDays(center: Center): number {
  return Math.max(1, Math.round((Date.parse(center.period.to) - Date.parse(center.period.from)) / DAY_MS))
}

// -------------------------------------------------------------- financeiro

export interface FinancialSummary {
  readonly grossCents: number
  readonly refundsCents: number
  readonly feesCents: number
  /** Recebido menos reembolsos e taxa de pagamento. */
  readonly netCents: number
  readonly aiCostCents: number
  readonly otherCostsCents: number
  readonly totalCostsCents: number
  /** Líquido menos IA e despesas registradas. Não inclui custo que não foi lançado. */
  readonly profitCents: number
  readonly profitMargin: number | null
  readonly contributionCents: number
  readonly contributionMargin: number | null
  readonly grossChange: number | null
  readonly netChange: number | null
  readonly lifetimeNetCents: number
  readonly monthReceivedCents: number
  readonly projectedNextMonthCents: number
  readonly atRiskCents: number
}

const fees = (netBeforeFees: number, rate: number) => Math.round(Math.max(netBeforeFees, 0) * rate)

export function financialSummary(center: Center, business: Business): FinancialSummary | null {
  const revenue = center.revenue
  const rate = center.settings.payment_fee_rate
  if (!revenue || rate === null || !business.money) return null
  const received = revenue.gross_cents - revenue.refunds_cents
  const feesCents = fees(received, rate)
  const netCents = received - feesCents
  const aiCostCents = toCents(business.ai.cost_brl)
  const otherCostsCents = business.money.expenses_cents
  const contributionCents = netCents - aiCostCents
  const profitCents = contributionCents - otherCostsCents
  const previousReceived = revenue.previous_gross_cents - revenue.previous_refunds_cents
  const previousNet = previousReceived - fees(previousReceived, rate)
  return {
    grossCents: revenue.gross_cents,
    refundsCents: revenue.refunds_cents,
    feesCents,
    netCents,
    aiCostCents,
    otherCostsCents,
    totalCostsCents: feesCents + aiCostCents + otherCostsCents,
    profitCents,
    profitMargin: received > 0 ? profitCents / received : null,
    contributionCents,
    contributionMargin: received > 0 ? contributionCents / received : null,
    grossChange: change(revenue.gross_cents, revenue.previous_gross_cents),
    netChange: change(netCents, previousNet),
    lifetimeNetCents: revenue.lifetime_gross_cents - revenue.lifetime_refunds_cents,
    monthReceivedCents: revenue.month_received_cents,
    projectedNextMonthCents: revenue.projected_next_month_cents,
    atRiskCents: revenue.at_risk_cents,
  }
}

export interface MoneyPoint {
  readonly key: string
  readonly gross: number
  readonly net: number
  readonly previous: number
  readonly ai: number
  readonly fees: number
  readonly other: number
  readonly profit: number
}

export type Granularity = 'day' | 'week' | 'month'

/** Agrupa a série diária: semana começa na segunda; mês vira "2026-10". */
export function bucketKey(day: string, granularity: Granularity): string {
  if (granularity === 'day') return day
  if (granularity === 'month') return day.slice(0, 7)
  const date = new Date(`${day}T00:00:00Z`)
  const monday = new Date(date.getTime() - ((date.getUTCDay() + 6) % 7) * DAY_MS)
  return monday.toISOString().slice(0, 10)
}

/** Receita, custos e lucro por dia, semana ou mês, em reais. Taxa estimada sobre o recebido do dia. */
export function moneySeries(center: Center, business: Business, granularity: Granularity): MoneyPoint[] {
  const revenue = center.revenue
  const rate = center.settings.payment_fee_rate
  if (!revenue || rate === null) return []
  const aiByDay = new Map((business.money?.revenue_series ?? []).map((point) => [point.day, point.ai_cost_brl]))
  const otherByDay = new Map(revenue.expenses_by_day.map((point) => [point.day, point.cents]))
  const buckets = new Map<string, MoneyPoint>()
  for (const day of revenue.series) {
    const received = day.gross_cents - day.refunds_cents
    const fee = fees(received, rate)
    const ai = aiByDay.get(day.day) ?? 0
    const other = (otherByDay.get(day.day) ?? 0) / 100
    const point: MoneyPoint = {
      key: bucketKey(day.day, granularity),
      gross: day.gross_cents / 100,
      net: (received - fee) / 100,
      previous: day.previous_gross_cents / 100,
      ai,
      fees: fee / 100,
      other,
      profit: (received - fee) / 100 - ai - other,
    }
    const current = buckets.get(point.key)
    buckets.set(
      point.key,
      current
        ? {
            key: point.key,
            gross: current.gross + point.gross,
            net: current.net + point.net,
            previous: current.previous + point.previous,
            ai: current.ai + point.ai,
            fees: current.fees + point.fees,
            other: current.other + point.other,
            profit: current.profit + point.profit,
          }
        : point,
    )
  }
  return [...buckets.values()]
}

/** Granularidade que cabe no período: até 45 dias por dia, até 200 por semana, acima disso por mês. */
export function defaultGranularity(days: number): Granularity {
  if (days <= 45) return 'day'
  return days <= 200 ? 'week' : 'month'
}

// ------------------------------------------------------------- assinaturas

export interface SubscriptionMetrics {
  readonly total: number
  readonly paying: number
  readonly free: number
  readonly newSubscriptions: number
  readonly cancellations: number
  readonly churn: number | null
  readonly conversion: number | null
  readonly conversionChange: number | null
  readonly ticketCents: number | null
}

export function subscriptionMetrics(dashboard: Dashboard, business: Business): SubscriptionMetrics {
  const { users, finance } = dashboard
  const conversion = ratio(business.conversion.converted, business.conversion.signups)
  const previous = ratio(business.conversion.converted_previous, business.conversion.signups_previous)
  return {
    total: users.total,
    paying: users.paying,
    free: Math.max(0, users.total - users.paying),
    newSubscriptions: finance?.new_subscriptions ?? 0,
    cancellations: finance?.cancellations ?? 0,
    churn: finance ? ratio(finance.churn_lost, finance.churn_base) : null,
    conversion,
    conversionChange: conversion !== null && previous !== null && previous > 0 ? (conversion - previous) / previous : null,
    ticketCents: finance && users.paying > 0 ? Math.round(finance.mrr_cents / users.paying) : null,
  }
}

// ---------------------------------------------------- inteligência de negócio

export interface UnitEconomics {
  /** MRR ÷ todas as contas. */
  readonly arpuCents: number | null
  /** MRR ÷ assinantes pagantes. */
  readonly arppuCents: number | null
  /** Custo de IA dos pagantes no período, levado a 30 dias, por pagante. */
  readonly costToServeCents: number | null
  /** ARPPU menos taxa e custo de atender, por mês. */
  readonly unitContributionCents: number | null
  readonly unitContributionMargin: number | null
  /** Assinaturas perdidas nos últimos 30 dias ÷ vivas há 30 dias. */
  readonly monthlyChurn: number | null
  /** MRR perdido no período ÷ MRR do início. */
  readonly revenueChurn: number | null
  /** Contribuição mensal por assinante ÷ churn mensal. Nulo sem churn medido. */
  readonly ltvCents: number | null
  /** Marketing registrado ÷ novos pagantes no período. Nulo sem despesa de marketing. */
  readonly cacCents: number | null
  readonly ltvToCac: number | null
  /** Média mensal das despesas registradas nos últimos 90 dias. */
  readonly fixedMonthlyCents: number
  /** Assinantes para a contribuição cobrir as despesas fixas. */
  readonly breakEvenSubscribers: number | null
}

export function unitEconomics(center: Center, dashboard: Dashboard): UnitEconomics | null {
  const revenue = center.revenue
  const finance = dashboard.finance
  const rate = center.settings.payment_fee_rate
  if (!revenue || !finance || rate === null) return null
  const paying = dashboard.users.paying
  const arppu = paying > 0 ? finance.mrr_cents / paying : null
  const costToServe = paying > 0 ? (toCents(revenue.paying_ai_cost_brl) / paying) * (30 / periodDays(center)) : null
  const contribution = arppu !== null && costToServe !== null ? arppu * (1 - rate) - costToServe : null
  const monthlyChurn = ratio(revenue.churn_30d.lost, revenue.churn_30d.base)
  const ltv = contribution !== null && monthlyChurn !== null && monthlyChurn > 0 ? contribution / monthlyChurn : null
  const cac = revenue.marketing_cents > 0 && revenue.new_paying > 0 ? revenue.marketing_cents / revenue.new_paying : null
  const fixedMonthly = Math.round(revenue.expenses_90d_cents / 3)
  return {
    arpuCents: dashboard.users.total > 0 ? Math.round(finance.mrr_cents / dashboard.users.total) : null,
    arppuCents: arppu === null ? null : Math.round(arppu),
    costToServeCents: costToServe === null ? null : Math.round(costToServe),
    unitContributionCents: contribution === null ? null : Math.round(contribution),
    unitContributionMargin: contribution !== null && arppu ? contribution / arppu : null,
    monthlyChurn,
    revenueChurn: ratio(revenue.mrr_lost_cents, revenue.mrr_start_cents),
    ltvCents: ltv === null ? null : Math.round(ltv),
    cacCents: cac === null ? null : Math.round(cac),
    ltvToCac: ltv !== null && cac !== null && cac > 0 ? ltv / cac : null,
    fixedMonthlyCents: fixedMonthly,
    breakEvenSubscribers: contribution !== null && contribution > 0 && fixedMonthly > 0 ? Math.ceil(fixedMonthly / contribution) : null,
  }
}

export interface PlanMargin {
  readonly slug: string
  readonly name: string
  readonly users: number
  readonly receivedCents: number
  readonly aiCostCents: number
  readonly feesCents: number
  readonly marginCents: number
  readonly margin: number | null
  readonly credits: number
}

/** Rentabilidade por plano no período: recebido − taxa − custo de IA de quem está no plano. */
export function planMargins(business: Business, feeRate: number): PlanMargin[] {
  return (business.money?.plans ?? []).map((plan) => {
    const feesCents = fees(plan.received_cents, feeRate)
    const aiCostCents = toCents(plan.ai_cost_brl)
    const marginCents = plan.received_cents - feesCents - aiCostCents
    return {
      slug: plan.slug,
      name: plan.name,
      users: plan.users,
      receivedCents: plan.received_cents,
      aiCostCents,
      feesCents,
      marginCents,
      margin: plan.received_cents > 0 ? marginCents / plan.received_cents : null,
      credits: plan.credits,
    }
  })
}

export interface FeatureMargin {
  readonly feature: string
  readonly label: string
  readonly generations: number
  readonly users: number
  readonly credits: number
  readonly costBrl: number
  /** Créditos consumidos × valor de referência do crédito. Estimativa, não recebimento. */
  readonly revenueBrl: number
  readonly margin: number | null
  readonly costPerGenerationBrl: number | null
}

export function featureMargins(center: Center): FeatureMargin[] {
  const value = center.settings.credit_value_brl
  return center.ai.by_feature.map((row) => {
    const revenueBrl = row.credits * value
    return {
      feature: row.feature,
      label: featureLabel(row.feature),
      generations: row.generations,
      users: row.users,
      credits: row.credits,
      costBrl: row.cost_brl,
      revenueBrl,
      margin: revenueBrl > 0 ? 1 - row.cost_brl / revenueBrl : null,
      costPerGenerationBrl: row.generations > 0 ? row.cost_brl / row.generations : null,
    }
  })
}

/** Série diária de custo dos cinco modelos mais caros, no formato dos gráficos de linha. */
export function modelCostSeries(center: Center): { key: string; values: Record<string, number> }[] {
  const days = new Map<string, Record<string, number>>()
  for (const day of center.ai.series) days.set(day.day, {})
  for (const row of center.ai.model_series) {
    const values = days.get(row.day) ?? {}
    values[row.model_slug] = (values[row.model_slug] ?? 0) + row.cost_brl
    days.set(row.day, values)
  }
  return [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, values]) => ({ key, values }))
}

// --------------------------------------------------------------- operação

export type ProviderHealth = 'ok' | 'degraded' | 'unstable' | 'idle'

export const PROVIDER_HEALTH_LABELS: Readonly<Record<ProviderHealth, string>> = {
  ok: 'Operando',
  degraded: 'Degradado',
  unstable: 'Instável',
  idle: 'Sem uso em 24 h',
}

/** Saúde pelas gerações das últimas 24 h: 10% de falha é degradado, 30% instável. Sem consulta externa. */
export function providerHealth(total: number, failed: number): ProviderHealth {
  if (total === 0) return 'idle'
  const rate = failed / total
  if (rate >= 0.3) return 'unstable'
  return rate >= 0.1 ? 'degraded' : 'ok'
}

// ------------------------------------------------------------------ alertas

export interface CenterAlert {
  readonly id: string
  readonly severity: 'critical' | 'warning'
  readonly title: string
  readonly detail: string
  /** Seção da central onde o problema aparece. */
  readonly section: SectionId
}

const brl = (cents: number) => `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const pct = (value: number) => `${(value * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

/** Regras fixas, sem IA: custo fora da curva, falhas, margem negativa, fila travada e custo sem tarifa. */
export function centerAlerts(center: Center, summary: FinancialSummary | null, plans: readonly PlanMargin[]): CenterAlert[] {
  const alerts: CenterAlert[] = []
  const days = periodDays(center)
  const dailyAverage = center.ai.cost_brl / days
  if (days > 1 && dailyAverage > 0 && center.ai.cost_today_brl > dailyAverage * 2 && center.ai.cost_today_brl >= 5) {
    alerts.push({
      id: 'ai-spike',
      severity: 'warning',
      title: 'Custo de IA de hoje fora da curva',
      detail: `${brl(toCents(center.ai.cost_today_brl))} hoje contra média de ${brl(toCents(dailyAverage))} por dia no período.`,
      section: 'ia',
    })
  }
  const operations = center.operations
  const failRate = ratio(operations.failed, operations.total)
  if (failRate !== null && operations.total >= 10 && failRate >= 0.1) {
    alerts.push({
      id: 'failures',
      severity: failRate >= 0.25 ? 'critical' : 'warning',
      title: 'Muitas gerações com falha',
      detail: `${pct(failRate)} das ${operations.total.toLocaleString('pt-BR')} gerações do período falharam.`,
      section: 'operacional',
    })
  }
  if (operations.stuck > 0) {
    alerts.push({
      id: 'stuck',
      severity: 'warning',
      title: 'Gerações paradas na fila',
      detail: `${operations.stuck} abertas há mais de 15 minutos.`,
      section: 'operacional',
    })
  }
  for (const provider of operations.providers) {
    if (providerHealth(provider.total_24h, provider.failed_24h) === 'unstable') {
      alerts.push({
        id: `provider-${provider.provider}`,
        severity: 'critical',
        title: `Fornecedor instável: ${provider.provider}`,
        detail: `${provider.failed_24h} de ${provider.total_24h} gerações falharam nas últimas 24 h.`,
        section: 'operacional',
      })
    }
  }
  if (summary && summary.grossCents > 0 && summary.contributionCents < 0) {
    alerts.push({
      id: 'negative-contribution',
      severity: 'critical',
      title: 'Margem de contribuição negativa',
      detail: `Taxas e IA custaram ${brl(summary.feesCents + summary.aiCostCents)} contra ${brl(summary.grossCents - summary.refundsCents)} recebidos.`,
      section: 'financeiro',
    })
  }
  const minMargin = center.settings.min_margin_rate
  for (const plan of plans) {
    if (plan.margin !== null && (plan.margin < 0 || (minMargin !== null && plan.margin < minMargin))) {
      alerts.push({
        id: `plan-${plan.slug}`,
        severity: plan.margin < 0 ? 'critical' : 'warning',
        title: `Plano ${plan.name} com margem ${plan.margin < 0 ? 'negativa' : 'abaixo da mínima'}`,
        detail: `Margem de ${pct(plan.margin)} no período${minMargin === null ? '' : ` (mínima ${pct(minMargin)})`}.`,
        section: 'negocio',
      })
    }
  }
  if (center.ai.unknown > 0) {
    alerts.push({
      id: 'unknown-cost',
      severity: 'warning',
      title: 'Gerações sem tarifa cadastrada',
      detail: `${center.ai.unknown} gerações ficaram fora do custo de IA. Cadastre a tarifa em Modelos e custos.`,
      section: 'ia',
    })
  }
  return alerts.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'critical' ? -1 : 1))
}

// ------------------------------------------------------------------- seções

export const SECTIONS = [
  { id: 'visao-geral', label: 'Visão geral' },
  { id: 'financeiro', label: 'Financeiro' },
  { id: 'ia', label: 'Inteligências artificiais' },
  { id: 'assinaturas', label: 'Assinaturas' },
  { id: 'usuarios', label: 'Usuários' },
  { id: 'negocio', label: 'Inteligência de negócio' },
  { id: 'operacional', label: 'Operacional' },
] as const
export type SectionId = (typeof SECTIONS)[number]['id']

// ----------------------------------------------------------------- simulação

export interface ScenarioAssumptions {
  /** Parcela de cada plano pago na base (soma 1). */
  readonly mix: Readonly<Record<string, number>>
  /** Parcela dos créditos do plano que a base usa no mês. */
  readonly utilization: number
  readonly costPerCreditBrl: number
  readonly feeRate: number
  readonly fixedMonthlyCents: number
}

export interface ScenarioRow {
  readonly subscribers: number
  readonly revenueCents: number
  readonly feesCents: number
  readonly aiCostCents: number
  readonly fixedCents: number
  readonly profitCents: number
  readonly margin: number | null
}

export const SCENARIO_SIZES = [30, 100, 300, 500, 1000] as const

/** Projeção mensal com os preços reais dos planos e premissas editáveis. Não é previsão. */
export function simulateScenarios(
  plans: readonly { slug: string; price_cents: number; monthly_credits: number }[],
  assumptions: ScenarioAssumptions,
  sizes: readonly number[] = SCENARIO_SIZES,
): ScenarioRow[] {
  const paid = plans.filter((plan) => plan.price_cents > 0)
  const shareTotal = paid.reduce((sum, plan) => sum + Math.max(0, assumptions.mix[plan.slug] ?? 0), 0)
  return sizes.map((subscribers) => {
    let revenue = 0
    let ai = 0
    for (const plan of paid) {
      const share = shareTotal > 0 ? Math.max(0, assumptions.mix[plan.slug] ?? 0) / shareTotal : 0
      const count = subscribers * share
      revenue += count * plan.price_cents
      ai += count * plan.monthly_credits * assumptions.utilization * assumptions.costPerCreditBrl * 100
    }
    const feesCents = Math.round(revenue * assumptions.feeRate)
    const profit = revenue - feesCents - ai - assumptions.fixedMonthlyCents
    return {
      subscribers,
      revenueCents: Math.round(revenue),
      feesCents,
      aiCostCents: Math.round(ai),
      fixedCents: assumptions.fixedMonthlyCents,
      profitCents: Math.round(profit),
      margin: revenue > 0 ? profit / revenue : null,
    }
  })
}

/** Custo real de IA por crédito consumido no período; nulo sem consumo. */
export function costPerCredit(center: Center): number | null {
  return center.ai.credits > 0 ? center.ai.cost_brl / center.ai.credits : null
}

// ----------------------------------------------------------- composição

export interface CenterData {
  readonly dashboard: Dashboard
  readonly business: Business
  readonly center: Center
  /** Nulo para quem não tem `finance.view`. */
  readonly summary: FinancialSummary | null
  readonly unit: UnitEconomics | null
  readonly plans: readonly PlanMargin[]
  readonly features: readonly FeatureMargin[]
  readonly alerts: readonly CenterAlert[]
}

// Alertas do `buildAlerts` (0024) que a central já cobre com regra própria, em reais.
const COVERED_DASHBOARD_ALERTS = new Set(['overall-failure', 'negative-margin', 'cost-unknown', 'cost-growth'])

function dashboardAlertSection(id: string): SectionId {
  if (id.startsWith('model-failure')) return 'operacional'
  if (id === 'past-due' || id === 'cancellations') return 'assinaturas'
  return 'ia'
}

const bySeverity = (a: CenterAlert, b: CenterAlert) => (a.severity === b.severity ? 0 : a.severity === 'critical' ? -1 : 1)

export function composeCenter(dashboard: Dashboard, business: Business, center: Center): CenterData {
  const summary = financialSummary(center, business)
  const feeRate = center.settings.payment_fee_rate
  const plans = feeRate === null ? [] : planMargins(business, feeRate)
  const inherited = buildAlerts(dashboard)
    .filter((alert) => !COVERED_DASHBOARD_ALERTS.has(alert.id))
    .map((alert) => ({ ...alert, section: dashboardAlertSection(alert.id) }))
  return {
    dashboard,
    business,
    center,
    summary,
    unit: unitEconomics(center, dashboard),
    plans,
    features: featureMargins(center),
    alerts: [...centerAlerts(center, summary, plans), ...inherited].sort(bySeverity),
  }
}

// ------------------------------------------------------------------ CSV

type CsvRow = readonly [string, string, string | number | null]

const reais = (cents: number | null) => (cents === null ? null : cents / 100)

/** Relatório da central: indicadores (seção, indicador, valor) e, depois, a série diária. Valores em reais. */
export function centerCsvRows(data: CenterData): { indicators: CsvRow[]; daily: (string | number | null)[][] } {
  const { summary, unit, center, dashboard } = data
  const subs = subscriptionMetrics(dashboard, data.business)
  const indicators: CsvRow[] = [
    ['Período', 'Início', center.period.from],
    ['Período', 'Fim (exclusivo)', center.period.to],
  ]
  if (summary) {
    indicators.push(
      ['Financeiro', 'Receita bruta (R$)', reais(summary.grossCents)],
      ['Financeiro', 'Reembolsos (R$)', reais(summary.refundsCents)],
      ['Financeiro', 'Taxas de pagamento estimadas (R$)', reais(summary.feesCents)],
      ['Financeiro', 'Receita líquida (R$)', reais(summary.netCents)],
      ['Financeiro', 'Custo de IA (R$)', reais(summary.aiCostCents)],
      ['Financeiro', 'Despesas registradas (R$)', reais(summary.otherCostsCents)],
      ['Financeiro', 'Lucro operacional estimado (R$)', reais(summary.profitCents)],
      ['Financeiro', 'Margem de lucro', summary.profitMargin],
      ['Financeiro', 'Receita acumulada (R$)', reais(summary.lifetimeNetCents)],
      ['Financeiro', 'Receita prevista próximo mês (R$, projeção)', reais(summary.projectedNextMonthCents)],
    )
  }
  if (dashboard.finance) {
    indicators.push(['Assinaturas', 'MRR (R$)', reais(dashboard.finance.mrr_cents)], ['Assinaturas', 'ARR (R$)', reais(dashboard.finance.mrr_cents * 12)])
  }
  indicators.push(
    ['Assinaturas', 'Assinantes ativos', subs.paying],
    ['Assinaturas', 'Usuários gratuitos', subs.free],
    ['Assinaturas', 'Novas assinaturas', subs.newSubscriptions],
    ['Assinaturas', 'Cancelamentos', subs.cancellations],
    ['Assinaturas', 'Churn', subs.churn],
    ['Assinaturas', 'Conversão grátis → pago', subs.conversion],
    ['IA', 'Custo no período (R$)', center.ai.cost_brl],
    ['IA', 'Gerações cobradas', center.ai.events],
    ['IA', 'Créditos consumidos', center.ai.credits],
    ['IA', 'Créditos não usados nas carteiras', data.business.credits.available],
    ...data.features.map((feature): CsvRow => ['IA por funcionalidade', `${feature.label}: custo (R$)`, feature.costBrl]),
    ['Usuários', 'Cadastrados', dashboard.users.total],
    ['Usuários', 'DAU', center.users.dau],
    ['Usuários', 'MAU', center.users.mau],
    ['Usuários', 'Nunca usaram', center.users.never_used],
    ['Usuários', 'Perto do limite', center.users.near_limit],
    ['Usuários', 'Créditos esgotados', center.users.exhausted],
    ['Operacional', 'Requisições', center.operations.total],
    ['Operacional', 'Falhas', center.operations.failed],
    ['Operacional', 'Custo das falhas cobradas (R$)', center.operations.failed_billed_cost_brl],
  )
  if (unit) {
    indicators.push(
      ['Negócio', 'ARPU (R$)', reais(unit.arpuCents)],
      ['Negócio', 'ARPPU (R$)', reais(unit.arppuCents)],
      ['Negócio', 'LTV estimado (R$)', reais(unit.ltvCents)],
      ['Negócio', 'CAC (R$)', reais(unit.cacCents)],
      ['Negócio', 'Churn de receita', unit.revenueChurn],
      ['Negócio', 'Custo para atender um assinante (R$/mês)', reais(unit.costToServeCents)],
      ['Negócio', 'Ponto de equilíbrio (assinantes)', unit.breakEvenSubscribers],
    )
  }
  const aiByDay = new Map(center.ai.series.map((day) => [day.day, day]))
  const revenueByDay = new Map((center.revenue?.series ?? []).map((day) => [day.day, day]))
  const activeByDay = new Map(center.users.active_series.map((day) => [day.day, day.users]))
  const daily = dashboard.series.map((day) => [
    day.day,
    day.signups,
    activeByDay.get(day.day) ?? 0,
    day.succeeded,
    day.failed,
    aiByDay.get(day.day)?.cost_brl ?? 0,
    revenueByDay.has(day.day) ? (revenueByDay.get(day.day)?.gross_cents ?? 0) / 100 : null,
    revenueByDay.has(day.day) ? (revenueByDay.get(day.day)?.refunds_cents ?? 0) / 100 : null,
  ])
  return { indicators, daily }
}

export const DAILY_CSV_HEADER = ['Dia', 'Cadastros', 'Ativos', 'Concluídas', 'Falhas', 'Custo de IA (R$)', 'Receita bruta (R$)', 'Reembolsos (R$)'] as const
