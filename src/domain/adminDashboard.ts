import { z } from 'zod'

// Dashboard da operação (0014 `admin_dashboard`). Aqui ficam o contrato com o banco,
// os períodos e as definições de cada indicador, para a tela só desenhar.

const count = z.coerce.number()

export const adminRoleSchema = z.enum(['super_admin', 'admin', 'support', 'finance', 'analyst'])
export type AdminRole = z.infer<typeof adminRoleSchema>

export const ADMIN_ROLE_LABELS: Readonly<Record<AdminRole, string>> = {
  super_admin: 'Super admin',
  admin: 'Admin',
  support: 'Suporte',
  finance: 'Financeiro',
  analyst: 'Analista',
}

export const ADMIN_ROLE_DESCRIPTIONS: Readonly<Record<AdminRole, string>> = {
  super_admin: 'Tudo, inclusive preço, planos e quem administra.',
  admin: 'Operação: usuários, créditos, modelos e auditoria. Sem financeiro.',
  support: 'Consulta usuários, créditos e gerações. Não altera nada.',
  finance: 'Receita, assinaturas, pagamentos e custos. Não altera nada.',
  analyst: 'Indicadores de uso e produto. Sem dados financeiros nem de usuários.',
}

/** O que cada permissão do banco (0014 `admin_role_permissions`) libera, em português. */
export const ADMIN_PERMISSION_LABELS: Readonly<Record<string, string>> = {
  'dashboard.view': 'Ver o dashboard',
  'finance.view': 'Ver receita, pagamentos e custos',
  'users.view': 'Consultar usuários, créditos e gerações',
  'users.manage': 'Suspender e reativar contas',
  'credits.adjust': 'Conceder e remover créditos',
  'plans.view': 'Ver planos',
  'plans.manage': 'Alterar planos',
  'models.view': 'Ver modelos e custos',
  'models.manage': 'Alterar modelos, preço em créditos e planos liberados',
  'pricing.manage': 'Alterar câmbio, markup e valor do crédito',
  'audit.view': 'Ver a auditoria',
  'admins.manage': 'Dar e remover acesso à operação',
  'finance.override': 'Ligar preço abaixo da meta de margem (exceção)',
}

export const adminMeSchema = z.object({
  role: adminRoleSchema,
  permissions: z.array(z.string()),
  aal: z.string(),
})
export type AdminMe = z.infer<typeof adminMeSchema>

const seriesPointSchema = z.object({
  day: z.string(),
  signups: count,
  succeeded: count,
  failed: count,
  credits: count,
  new_subscriptions: count,
  cancellations: count,
  revenue_cents: count.nullable(),
  api_cost_usd: count.nullable(),
})
export type SeriesPoint = z.infer<typeof seriesPointSchema>

const financeSchema = z.object({
  mrr_cents: count,
  past_due: count,
  received_cents: count,
  received_previous_cents: count,
  received_total_cents: count,
  subscription_received_cents: count,
  pack_received_cents: count,
  payments_count: count,
  refunds_cents: count,
  new_subscriptions: count,
  cancellations: count,
  cancellations_previous: count,
  churn_base: count,
  churn_lost: count,
  api_cost_usd: count,
  api_cost_previous_usd: count,
  api_cost_unknown: count,
  usd_brl: count,
  payment_fee_rate: count,
  by_plan: z.array(z.object({ slug: z.string(), name: z.string(), subscribers: count, mrr_cents: count, received_cents: count })),
})
export type DashboardFinance = z.infer<typeof financeSchema>

export const dashboardSchema = z.object({
  period: z.object({ from: z.string(), to: z.string() }),
  users: z.object({
    total: count,
    new_in_period: count,
    new_previous: count,
    new_today: count,
    new_7d: count,
    new_30d: count,
    active_1d: count,
    active_30d: count,
    active_in_period: count,
    paying: count,
    onboarded_in_period: count,
    first_generation_in_period: count,
    converted_in_period: count,
  }),
  generations: z.object({
    total: count,
    succeeded: count,
    failed: count,
    open: count,
    image: count,
    video: count,
    text: count,
    today: count,
    month: count,
    credits_consumed: count,
    previous_total: count,
    previous_failed: count,
  }),
  plan_distribution: z.array(z.object({ slug: z.string(), name: z.string(), users: count })),
  by_model: z.array(
    z.object({
      model_slug: z.string(),
      name: z.string(),
      kind: z.string(),
      provider: z.string(),
      total: count,
      failed: count,
      credits: count,
      cost_usd: count.nullable(),
    }),
  ),
  series: z.array(seriesPointSchema).nullable().transform((series) => series ?? []),
  top_consumers: z.array(z.object({ user_id: z.string(), email: z.string().nullable(), credits: count, generations: count })).nullable(),
  finance: financeSchema.nullable(),
})
export type Dashboard = z.infer<typeof dashboardSchema>

// ------------------------------------------------------------- períodos

export const PERIOD_PRESETS = ['today', 'yesterday', '7d', '30d', '90d', 'custom'] as const
export type PeriodPreset = (typeof PERIOD_PRESETS)[number]

export const PERIOD_LABELS: Readonly<Record<PeriodPreset, string>> = {
  today: 'Hoje',
  yesterday: 'Ontem',
  '7d': '7 dias',
  '30d': '30 dias',
  '90d': '90 dias',
  custom: 'Personalizado',
}

export interface Period {
  readonly from: Date
  readonly to: Date
}

/** Maior intervalo aceito pelo banco (400 dias); a tela limita a um ano. */
export const MAX_PERIOD_DAYS = 366
const DAY_MS = 24 * 60 * 60 * 1000
// Brasília não tem horário de verão desde 2019: o dia começa sempre às 03:00 UTC.
const BRT_OFFSET = '-03:00'
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

/** "2026-10-23" no fuso de Brasília. */
export function brtDay(at: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(at)
}

function startOfBrtDay(day: string): Date {
  return new Date(`${day}T00:00:00${BRT_OFFSET}`)
}

/** Período [from, to) em dias inteiros de Brasília. `custom` usa as datas inclusivas `start` e `end`. */
export function resolvePeriod(preset: PeriodPreset, now: Date, custom?: { start: string; end: string }): Period | null {
  const today = startOfBrtDay(brtDay(now))
  const tomorrow = new Date(today.getTime() + DAY_MS)
  const lastDays = (days: number): Period => ({ from: new Date(tomorrow.getTime() - days * DAY_MS), to: tomorrow })

  switch (preset) {
    case 'today':
      return { from: today, to: tomorrow }
    case 'yesterday':
      return { from: new Date(today.getTime() - DAY_MS), to: today }
    case '7d':
      return lastDays(7)
    case '30d':
      return lastDays(30)
    case '90d':
      return lastDays(90)
    case 'custom': {
      if (!custom || !ISO_DAY.test(custom.start) || !ISO_DAY.test(custom.end)) return null
      const from = startOfBrtDay(custom.start)
      const to = new Date(startOfBrtDay(custom.end).getTime() + DAY_MS)
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) return null
      if (to.getTime() - from.getTime() > MAX_PERIOD_DAYS * DAY_MS) return null
      return { from, to }
    }
  }
}

// ----------------------------------------------------------- indicadores

/** Parte sobre o todo; nulo quando não há base (nunca "0%" inventado). */
export function ratio(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null
}

/** Variação contra o período anterior de mesmo tamanho; nula sem base anterior. */
export function change(current: number, previous: number): number | null {
  return previous > 0 ? (current - previous) / previous : null
}

export interface Contribution {
  readonly receivedCents: number
  readonly feesCents: number
  readonly apiCostCents: number
  /** Recebido menos taxa de pagamento e custo de API. Não é lucro: faltam custos fixos e impostos. */
  readonly marginCents: number
  readonly marginRate: number | null
}

/** Margem de contribuição estimada do período: taxa e custo de API são estimativas. */
export function contribution(finance: DashboardFinance): Contribution {
  const receivedCents = finance.received_cents
  const feesCents = Math.round(receivedCents * finance.payment_fee_rate)
  const apiCostCents = Math.round(finance.api_cost_usd * finance.usd_brl * 100)
  const marginCents = receivedCents - feesCents - apiCostCents
  return { receivedCents, feesCents, apiCostCents, marginCents, marginRate: ratio(marginCents, receivedCents) }
}

/** Ticket médio: recebido ÷ número de pagamentos do período. */
export function averageTicket(finance: DashboardFinance): number | null {
  return finance.payments_count > 0 ? Math.round(finance.received_cents / finance.payments_count) : null
}

// ---------------------------------------------------------------- alertas

export type AlertSeverity = 'critical' | 'warning'

export interface DashboardAlert {
  readonly id: string
  readonly severity: AlertSeverity
  readonly title: string
  readonly detail: string
}

/** Limites dos alertas. Mínimos de volume evitam alarme com 1 ou 2 gerações. */
export const ALERT_RULES = {
  modelFailureRate: 0.2,
  modelMinGenerations: 5,
  overallFailureRate: 0.1,
  overallMinGenerations: 10,
  costGrowth: 0.5,
  costMinUsd: 5,
  cancellationGrowth: 0.5,
  cancellationMin: 2,
  consumerShare: 0.4,
  consumerMinCredits: 200,
} as const

const percent = (value: number) => `${Math.round(value * 100)}%`

function generationAlerts(dashboard: Dashboard): DashboardAlert[] {
  const alerts: DashboardAlert[] = []
  for (const model of dashboard.by_model) {
    const rate = ratio(model.failed, model.total)
    if (rate !== null && model.total >= ALERT_RULES.modelMinGenerations && rate >= ALERT_RULES.modelFailureRate) {
      alerts.push({
        id: `model-failure:${model.model_slug}`,
        severity: rate >= 0.5 ? 'critical' : 'warning',
        title: `${model.name} com ${percent(rate)} de falhas`,
        detail: `${model.failed} de ${model.total} gerações falharam no período (${model.provider}). Os créditos voltaram, mas a pessoa ficou sem o resultado.`,
      })
    }
  }
  const overall = ratio(dashboard.generations.failed, dashboard.generations.total)
  if (overall !== null && dashboard.generations.total >= ALERT_RULES.overallMinGenerations && overall >= ALERT_RULES.overallFailureRate) {
    alerts.push({
      id: 'overall-failure',
      severity: 'warning',
      title: `Taxa geral de falha em ${percent(overall)}`,
      detail: `${dashboard.generations.failed} de ${dashboard.generations.total} gerações falharam no período.`,
    })
  }
  return alerts
}

function financeAlerts(finance: DashboardFinance): DashboardAlert[] {
  const alerts: DashboardAlert[] = []
  const costGrowth = change(finance.api_cost_usd, finance.api_cost_previous_usd)
  if (costGrowth !== null && finance.api_cost_usd >= ALERT_RULES.costMinUsd && costGrowth >= ALERT_RULES.costGrowth) {
    alerts.push({
      id: 'cost-growth',
      severity: 'warning',
      title: `Custo de API subiu ${percent(costGrowth)}`,
      detail: `US$ ${finance.api_cost_usd.toFixed(2)} no período contra US$ ${finance.api_cost_previous_usd.toFixed(2)} no anterior.`,
    })
  }
  if (finance.api_cost_unknown > 0) {
    alerts.push({
      id: 'cost-unknown',
      severity: 'warning',
      title: `${finance.api_cost_unknown} gerações sem custo cadastrado`,
      detail: 'O modelo não tinha custo do fornecedor quando a geração nasceu. Custo e margem ficam subestimados até cadastrar em Modelos e custos.',
    })
  }
  if (finance.past_due > 0) {
    alerts.push({
      id: 'past-due',
      severity: 'warning',
      title: `${finance.past_due} ${finance.past_due === 1 ? 'assinatura' : 'assinaturas'} com cobrança em atraso`,
      detail: 'O cartão foi recusado no Asaas. O acesso segue por 3 dias de carência e depois o plano expira.',
    })
  }
  const cancellations = change(finance.cancellations, finance.cancellations_previous)
  if (finance.cancellations >= ALERT_RULES.cancellationMin && (cancellations === null || cancellations >= ALERT_RULES.cancellationGrowth)) {
    alerts.push({
      id: 'cancellations',
      severity: 'warning',
      title: `${finance.cancellations} cancelamentos no período`,
      detail:
        finance.cancellations_previous > 0
          ? `Eram ${finance.cancellations_previous} no período anterior.`
          : 'Nenhum no período anterior de mesmo tamanho.',
    })
  }
  const margin = contribution(finance)
  if (margin.receivedCents > 0 && margin.marginCents < 0) {
    alerts.push({
      id: 'negative-margin',
      severity: 'critical',
      title: 'Custo variável maior que a receita',
      detail: 'A margem de contribuição estimada do período ficou negativa. Revise os créditos cobrados por modelo.',
    })
  }
  return alerts
}

function consumerAlerts(dashboard: Dashboard): DashboardAlert[] {
  const top = dashboard.top_consumers?.[0]
  const total = dashboard.generations.credits_consumed
  const share = top ? ratio(top.credits, total) : null
  if (!top || share === null || top.credits < ALERT_RULES.consumerMinCredits || share < ALERT_RULES.consumerShare) return []
  return [
    {
      id: `consumer:${top.user_id}`,
      severity: 'warning',
      title: `Uma conta usou ${percent(share)} dos créditos`,
      detail: `${top.email ?? top.user_id} consumiu ${top.credits.toLocaleString('pt-BR')} créditos em ${top.generations} gerações no período.`,
    },
  ]
}

/** Alertas a partir dos dados do período. Críticos primeiro. */
export function buildAlerts(dashboard: Dashboard): DashboardAlert[] {
  const alerts = [...generationAlerts(dashboard), ...(dashboard.finance ? financeAlerts(dashboard.finance) : []), ...consumerAlerts(dashboard)]
  return alerts.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'critical' ? -1 : 1))
}
