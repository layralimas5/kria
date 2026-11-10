import { z } from 'zod'
import { PERIOD_PRESETS, type Period, type PeriodPreset } from './adminDashboard'
import { FEATURE_LABELS, FEATURES, type Feature, type Granularity } from './commandCenter'

// Central financeira (Financeiro > Central financeira): filtros, contrato de `admin_finance_explorer`
// (0029) e as contas que a tela faz em cima dele.

export const MOVEMENT_TYPES = ['revenue', 'expense', 'refund', 'adjustment'] as const
export type MovementType = (typeof MOVEMENT_TYPES)[number]
export const TYPE_LABELS: Readonly<Record<MovementType, string>> = {
  revenue: 'Receita',
  expense: 'Despesa',
  refund: 'Reembolso',
  adjustment: 'Ajuste',
}

export const PAYMENT_STATUSES = ['paid', 'pending', 'overdue', 'canceled', 'refunded'] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]
export const STATUS_LABELS: Readonly<Record<PaymentStatus, string>> = {
  paid: 'Pago',
  pending: 'Pendente',
  overdue: 'Vencido',
  canceled: 'Cancelado',
  refunded: 'Reembolsado',
}

export const REVENUE_SOURCES = ['subscription_new', 'renewal', 'upgrade', 'plan_change', 'credit_pack'] as const
export type RevenueSource = (typeof REVENUE_SOURCES)[number]
export const SOURCE_LABELS: Readonly<Record<RevenueSource, string>> = {
  subscription_new: 'Assinatura nova',
  renewal: 'Renovação',
  upgrade: 'Upgrade',
  plan_change: 'Troca de plano',
  credit_pack: 'Compra de créditos',
}

export const EXPENSE_CATEGORIES = ['ai', 'payment_fees', 'infra', 'tools', 'services', 'marketing', 'taxes', 'payroll', 'other'] as const
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]
export const CATEGORY_LABELS: Readonly<Record<ExpenseCategory, string>> = {
  ai: 'APIs de IA',
  payment_fees: 'Taxas de pagamento',
  infra: 'Infraestrutura',
  tools: 'Ferramentas',
  services: 'Serviços',
  marketing: 'Marketing',
  taxes: 'Impostos',
  payroll: 'Equipe',
  other: 'Outros custos',
}

export const PAYMENT_METHODS = ['pix', 'card', 'boleto', 'other', 'unknown'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]
export const METHOD_LABELS: Readonly<Record<PaymentMethod, string>> = {
  pix: 'Pix',
  card: 'Cartão',
  boleto: 'Boleto',
  other: 'Outro',
  unknown: 'Não informado',
}

export const COST_BASIS_LABELS: Readonly<Record<string, string>> = {
  metered: 'Medido',
  estimated: 'Estimado',
  unknown: 'Sem custo cadastrado',
  registered: 'Lançado',
}

const label = <K extends string>(labels: Readonly<Record<K, string>>, key: string | null | undefined): string =>
  key ? ((labels as Readonly<Record<string, string>>)[key] ?? key) : '–'
export const typeLabel = (key: string | null) => label(TYPE_LABELS, key)
export const statusLabel = (key: string | null) => label(STATUS_LABELS, key)
export const sourceLabel = (key: string | null) => label(SOURCE_LABELS, key)
export const categoryLabel = (key: string | null) => label(CATEGORY_LABELS, key)
export const methodLabel = (key: string | null) => label(METHOD_LABELS, key)
export const featureName = (key: string | null) => label(FEATURE_LABELS, key)

// ------------------------------------------------------------------------- filtros

export type CompareMode = 'previous' | 'year'

export interface ExplorerFilters {
  readonly preset: PeriodPreset
  /** Datas inclusivas do período personalizado ("2026-11-01"). */
  readonly start: string
  readonly end: string
  readonly compare: CompareMode
  readonly granularity: Granularity
  readonly types: readonly MovementType[]
  readonly statuses: readonly PaymentStatus[]
  readonly plans: readonly string[]
  readonly sources: readonly RevenueSource[]
  readonly categories: readonly ExpenseCategory[]
  readonly aiProviders: readonly string[]
  readonly aiModels: readonly string[]
  readonly aiFeatures: readonly Feature[]
  readonly methods: readonly PaymentMethod[]
  /** Parte do e-mail do cliente. */
  readonly user: string
  /** Em reais, como digitado; vazio = sem limite. */
  readonly minBrl: string
  readonly maxBrl: string
}

export type ListKey = 'types' | 'statuses' | 'plans' | 'sources' | 'categories' | 'aiProviders' | 'aiModels' | 'aiFeatures' | 'methods'

export const DEFAULT_FILTERS: ExplorerFilters = {
  preset: '30d',
  start: '',
  end: '',
  compare: 'previous',
  granularity: 'day',
  types: [],
  statuses: [],
  plans: [],
  sources: [],
  categories: [],
  aiProviders: [],
  aiModels: [],
  aiFeatures: [],
  methods: [],
  user: '',
  minBrl: '',
  maxBrl: '',
}

/** Nome curto de cada filtro na URL (`?tipo=revenue,refund&forma=pix`). */
const LIST_PARAMS: Readonly<Record<ListKey, string>> = {
  types: 'tipo',
  statuses: 'status',
  plans: 'plano',
  sources: 'origem',
  categories: 'categoria',
  aiProviders: 'provedor',
  aiModels: 'modelo',
  aiFeatures: 'funcao',
  methods: 'forma',
}

const LIST_ALLOWED: Readonly<Record<ListKey, readonly string[] | null>> = {
  types: MOVEMENT_TYPES,
  statuses: PAYMENT_STATUSES,
  plans: null,
  sources: REVENUE_SOURCES,
  categories: EXPENSE_CATEGORIES,
  aiProviders: null,
  aiModels: null,
  aiFeatures: FEATURES,
  methods: PAYMENT_METHODS,
}

const SLUG = /^[a-z0-9._/-]{1,80}$/i
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

function parseList(raw: string | null, allowed: readonly string[] | null): string[] {
  if (!raw) return []
  const items = [...new Set(raw.split(',').map((item) => item.trim()).filter(Boolean))]
  return items.filter((item) => (allowed ? allowed.includes(item) : SLUG.test(item))).slice(0, 50)
}

const isPreset = (value: string | null): value is PeriodPreset => PERIOD_PRESETS.some((preset) => preset === value)
const MONEY = /^\d{1,9}([.,]\d{1,2})?$/

/** Lê os filtros da URL, descartando o que não for válido (link antigo ou editado à mão). */
export function filtersFromParams(params: URLSearchParams): ExplorerFilters {
  const lists = Object.fromEntries(
    (Object.keys(LIST_PARAMS) as ListKey[]).map((key) => [key, parseList(params.get(LIST_PARAMS[key]), LIST_ALLOWED[key])]),
  ) as Record<ListKey, string[]>
  const preset = params.get('periodo')
  const granularity = params.get('agrupar')
  const money = (key: string) => {
    const value = params.get(key)?.trim() ?? ''
    return MONEY.test(value) ? value : ''
  }
  return {
    ...DEFAULT_FILTERS,
    ...(lists as unknown as Pick<ExplorerFilters, ListKey>),
    preset: isPreset(preset) ? preset : DEFAULT_FILTERS.preset,
    start: ISO_DAY.test(params.get('de') ?? '') ? (params.get('de') as string) : '',
    end: ISO_DAY.test(params.get('ate') ?? '') ? (params.get('ate') as string) : '',
    compare: params.get('comparar') === 'year' ? 'year' : 'previous',
    granularity: granularity === 'week' || granularity === 'month' ? granularity : 'day',
    user: (params.get('cliente') ?? '').slice(0, 120),
    minBrl: money('min'),
    maxBrl: money('max'),
  }
}

/** Grava os filtros na URL, só o que difere do padrão. Outros parâmetros (`?aba=`) ficam. */
export function filtersToParams(filters: ExplorerFilters, base: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(base)
  for (const key of ['periodo', 'de', 'ate', 'comparar', 'agrupar', 'cliente', 'min', 'max', ...Object.values(LIST_PARAMS)]) next.delete(key)
  if (filters.preset !== DEFAULT_FILTERS.preset) next.set('periodo', filters.preset)
  if (filters.preset === 'custom') {
    if (filters.start) next.set('de', filters.start)
    if (filters.end) next.set('ate', filters.end)
  }
  if (filters.compare !== 'previous') next.set('comparar', filters.compare)
  if (filters.granularity !== 'day') next.set('agrupar', filters.granularity)
  for (const key of Object.keys(LIST_PARAMS) as ListKey[]) {
    if (filters[key].length > 0) next.set(LIST_PARAMS[key], filters[key].join(','))
  }
  if (filters.user.trim()) next.set('cliente', filters.user.trim())
  if (filters.minBrl) next.set('min', filters.minBrl)
  if (filters.maxBrl) next.set('max', filters.maxBrl)
  return next
}

export function toCents(brl: string): number | null {
  if (!MONEY.test(brl.trim())) return null
  return Math.round(Number(brl.trim().replace(',', '.')) * 100)
}

/** Quantos filtros além do período estão ligados (badge do botão "Limpar"). */
export function activeFilterCount(filters: ExplorerFilters): number {
  const lists = (Object.keys(LIST_PARAMS) as ListKey[]).filter((key) => filters[key].length > 0).length
  return lists + (filters.user.trim() ? 1 : 0) + (filters.minBrl ? 1 : 0) + (filters.maxBrl ? 1 : 0)
}

export function clearFilters(filters: ExplorerFilters): ExplorerFilters {
  return { ...DEFAULT_FILTERS, preset: filters.preset, start: filters.start, end: filters.end, compare: filters.compare, granularity: filters.granularity }
}

/** Corpo de `p_filters`. Lista vazia vira nulo (sem filtro). */
export function toRpcFilters(filters: ExplorerFilters, period: Period): Record<string, unknown> {
  const list = (items: readonly string[]) => (items.length > 0 ? items : null)
  return {
    from: period.from.toISOString(),
    to: period.to.toISOString(),
    compare: filters.compare,
    granularity: filters.granularity,
    types: list(filters.types),
    statuses: list(filters.statuses),
    plans: list(filters.plans),
    sources: list(filters.sources),
    categories: list(filters.categories),
    ai_providers: list(filters.aiProviders),
    ai_models: list(filters.aiModels),
    ai_features: list(filters.aiFeatures),
    methods: list(filters.methods),
    user: filters.user.trim() || null,
    min_cents: toCents(filters.minBrl),
    max_cents: toCents(filters.maxBrl),
  }
}

/** Valor mínimo maior que o máximo: a tela avisa em vez de consultar. */
export function rangeError(filters: ExplorerFilters): string | null {
  const min = toCents(filters.minBrl)
  const max = toCents(filters.maxBrl)
  return min !== null && max !== null && min > max ? 'O valor mínimo está maior que o máximo.' : null
}

// ------------------------------------------------------------------------ contrato

const cents = z.coerce.number()
const totalsSchema = z.object({
  gross_cents: cents,
  reconciled_gross_cents: cents,
  reconciled_net_cents: cents,
  refunds_cents: cents,
  fees_cents: cents,
  fees_estimated_cents: cents,
  ai_cents: cents,
  ai_estimated_cents: cents,
  ai_unknown_events: cents,
  other_expenses_cents: cents,
  expenses_cents: cents,
  pending_cents: cents,
  overdue_cents: cents,
  paid_count: cents,
  paying_users: cents,
  rows: cents,
})
export type Totals = z.infer<typeof totalsSchema>

const pointSchema = z.object({
  key: z.string(),
  gross_cents: cents,
  refunds_cents: cents,
  expenses_cents: cents,
  ai_cents: cents,
  fees_cents: cents.optional().default(0),
})

export const movementSchema = z.object({
  id: z.string(),
  occurred_at: z.string(),
  type: z.string(),
  status: z.string(),
  source: z.string().nullable(),
  category: z.string().nullable(),
  plan_slug: z.string().nullable(),
  user_id: z.string().nullable(),
  email: z.string().nullable(),
  description: z.string(),
  amount_cents: cents,
  net_cents: cents.nullable(),
  credits: z.number().nullable(),
  method: z.string().nullable(),
  reference: z.string().nullable(),
  ai_provider: z.string().nullable(),
  ai_model: z.string().nullable(),
  ai_feature: z.string().nullable(),
  cost_basis: z.string().nullable(),
  events: z.number().nullable(),
  details: z.record(z.unknown()).nullable(),
})
export type Movement = z.infer<typeof movementSchema>

export const explorerSchema = z.object({
  period: z.object({
    from: z.string(),
    to: z.string(),
    compare_from: z.string(),
    compare_to: z.string(),
    compare: z.enum(['previous', 'year']),
    granularity: z.enum(['day', 'week', 'month']),
  }),
  totals: totalsSchema,
  previous: totalsSchema,
  mrr: z.object({ now_cents: cents, start_cents: cents }),
  coverage: z.object({ months_without_expenses: z.number(), months: z.number(), payment_fee_rate: z.coerce.number() }),
  series: z.array(pointSchema),
  monthly: z.array(pointSchema),
  by_plan: z.array(
    z.object({
      slug: z.string(),
      name: z.string(),
      gross_cents: cents,
      refunds_cents: cents,
      ai_cents: cents,
      fees_cents: cents,
      other_cents: cents,
      paying_users: z.number(),
      users: z.number(),
    }),
  ),
  by_category: z.array(z.object({ category: z.string(), cents, estimated_cents: cents.nullable() })),
  by_source: z.array(z.object({ source: z.string(), cents, count: z.number() })),
  by_method: z.array(z.object({ method: z.string(), cents, count: z.number() })),
  ai_by_model: z.array(
    z.object({ model: z.string(), name: z.string(), provider: z.string(), cents, events: cents, unknown_events: cents, estimated_cents: cents }),
  ),
  ai_by_provider: z.array(z.object({ provider: z.string(), cents, events: cents })),
  by_user: z.array(
    z.object({ user_id: z.string(), email: z.string().nullable(), plan_slug: z.string().nullable(), revenue_cents: cents, costs_cents: cents, ai_cents: cents }),
  ),
  options: z.object({
    plans: z.array(z.object({ slug: z.string(), name: z.string(), status: z.string() })),
    ai_providers: z.array(z.string()),
    ai_models: z.array(z.object({ slug: z.string(), name: z.string(), provider: z.string() })),
    can_filter_user: z.boolean(),
  }),
  table: z.object({ total: z.number(), page: z.number(), page_size: z.number(), rows: z.array(movementSchema) }),
})
export type Explorer = z.infer<typeof explorerSchema>

export const savedFilterSchema = z.object({
  id: z.string(),
  name: z.string(),
  filters: z.record(z.unknown()),
  updated_at: z.string(),
})
export type SavedFilter = z.infer<typeof savedFilterSchema>

/** Filtro salvo guarda o recorte relativo ("30 dias"), não datas: reaplicado amanhã, continua valendo. */
export function savedToFilters(saved: Record<string, unknown>): ExplorerFilters {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(saved)) if (typeof value === 'string') params.set(key, value)
  return filtersFromParams(params)
}

export function filtersToSaved(filters: ExplorerFilters): Record<string, string> {
  return Object.fromEntries(filtersToParams(filters, new URLSearchParams()).entries())
}

// -------------------------------------------------------------------- indicadores

/** Variação relativa; nula quando não há base (período anterior zerado). */
export function change(current: number, previous: number): number | null {
  if (previous === 0) return null
  return (current - previous) / Math.abs(previous)
}

export interface Result {
  readonly gross: number
  readonly refunds: number
  readonly fees: number
  /** Bruto menos reembolsos e taxas: o que sobra da venda antes dos custos de operação. */
  readonly netRevenue: number
  readonly ai: number
  readonly expenses: number
  readonly profit: number
  /** Lucro sobre a receita depois dos reembolsos; nula sem receita. */
  readonly margin: number | null
  readonly pending: number
}

export function resultOf(totals: Totals): Result {
  const revenue = totals.gross_cents - totals.refunds_cents
  const profit = revenue - totals.expenses_cents
  return {
    gross: totals.gross_cents,
    refunds: totals.refunds_cents,
    fees: totals.fees_cents,
    netRevenue: revenue - totals.fees_cents,
    ai: totals.ai_cents,
    expenses: totals.expenses_cents,
    profit,
    margin: revenue > 0 ? profit / revenue : null,
    pending: totals.pending_cents + totals.overdue_cents,
  }
}

export interface Provisional {
  /** Lucro não é definitivo: faltam custos registrados. */
  readonly provisional: boolean
  readonly reasons: readonly string[]
}

/** Por que o lucro do recorte ainda é provisório. Sem motivo, ele é o resultado registrado. */
export function provisionalOf(data: Explorer): Provisional {
  const reasons: string[] = []
  const { totals, coverage } = data
  if (totals.ai_unknown_events > 0) {
    reasons.push(`${totals.ai_unknown_events} ${totals.ai_unknown_events === 1 ? 'geração sem custo cadastrado' : 'gerações sem custo cadastrado'} no fornecedor`)
  }
  if (coverage.months_without_expenses > 0) {
    reasons.push(
      coverage.months_without_expenses === 1 ? 'um mês do período sem despesa fixa lançada' : `${coverage.months_without_expenses} meses do período sem despesa fixa lançada`,
    )
  }
  if (totals.fees_estimated_cents > 0) reasons.push('parte das taxas do gateway é estimada (sem o valor líquido do Asaas)')
  if (totals.ai_estimated_cents > 0) reasons.push('parte do custo de IA é estimada pela tabela do fornecedor')
  return { provisional: reasons.length > 0, reasons }
}

// ------------------------------------------------------------------------ séries

export interface ChartPoint {
  readonly key: string
  readonly values: Readonly<Record<string, number>>
}

/**
 * Pontos em reais: receita (bruto menos reembolsos), despesas e lucro de cada ponto. A margem é a
 * acumulada desde o início do período: dia sem receita não vira um falso 0%.
 */
export function chartPoints(points: Explorer['series']): ChartPoint[] {
  let revenueSoFar = 0
  let profitSoFar = 0
  return points.map((point) => {
    const revenue = point.gross_cents - point.refunds_cents
    const profit = revenue - point.expenses_cents
    revenueSoFar += revenue
    profitSoFar += profit
    return {
      key: point.key,
      values: {
        revenue: revenue / 100,
        expenses: point.expenses_cents / 100,
        ai: point.ai_cents / 100,
        other: (point.expenses_cents - point.ai_cents) / 100,
        profit: profit / 100,
        margin: revenueSoFar > 0 ? Math.round((profitSoFar / revenueSoFar) * 1000) / 10 : 0,
      },
    }
  })
}

export interface MonthRow {
  readonly key: string
  readonly revenue: number
  readonly expenses: number
  readonly profit: number
  readonly margin: number | null
  readonly revenueChange: number | null
  readonly profitChange: number | null
}

export function monthRows(monthly: Explorer['monthly']): MonthRow[] {
  const rows = monthly.map((point) => {
    const revenue = point.gross_cents - point.refunds_cents
    const profit = revenue - point.expenses_cents
    return { key: point.key, revenue, expenses: point.expenses_cents, profit, margin: revenue > 0 ? profit / revenue : null }
  })
  return rows.map((row, index) => {
    const before = rows[index - 1]
    return {
      ...row,
      revenueChange: before ? change(row.revenue, before.revenue) : null,
      profitChange: before ? change(row.profit, before.profit) : null,
    }
  })
}

export interface PlanResult {
  readonly slug: string
  readonly name: string
  readonly revenue: number
  readonly costs: number
  readonly result: number
  readonly margin: number | null
  readonly payingUsers: number
  readonly users: number
}

/** Resultado por plano: receita líquida de reembolso menos IA, taxas e despesas ligadas ao plano. */
export function planResults(rows: Explorer['by_plan']): PlanResult[] {
  return rows
    .map((row) => {
      const revenue = row.gross_cents - row.refunds_cents
      const costs = row.ai_cents + row.fees_cents + row.other_cents
      return {
        slug: row.slug,
        name: row.name,
        revenue,
        costs,
        result: revenue - costs,
        margin: revenue > 0 ? (revenue - costs) / revenue : null,
        payingUsers: row.paying_users,
        users: row.users,
      }
    })
    .sort((a, b) => b.revenue - a.revenue || a.result - b.result)
}

// ----------------------------------------------------------------------- alertas

export interface FinanceInsight {
  readonly id: string
  readonly tone: 'good' | 'warning' | 'info'
  readonly title: string
  readonly detail: string
}

const pctText = (value: number) => `${value > 0 ? '+' : ''}${(value * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
const brl = (value: number) => (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** Variações que merecem atenção, do recorte contra a comparação e dentro dele. */
export function financeInsights(data: Explorer, minMarginRate = 0.3): FinanceInsight[] {
  const insights: FinanceInsight[] = []
  const now = resultOf(data.totals)
  const before = resultOf(data.previous)
  const grossChange = change(now.gross, before.gross)
  if (grossChange !== null && Math.abs(grossChange) >= 0.2) {
    insights.push({
      id: 'gross',
      tone: grossChange > 0 ? 'good' : 'warning',
      title: `Receita bruta ${pctText(grossChange)} na comparação`,
      detail: `${brl(now.gross)} agora contra ${brl(before.gross)} antes.`,
    })
  }
  const expensesChange = change(now.expenses, before.expenses)
  if (expensesChange !== null && expensesChange >= 0.25 && (grossChange === null || expensesChange > grossChange)) {
    insights.push({
      id: 'expenses',
      tone: 'warning',
      title: `Despesas cresceram ${pctText(expensesChange)}`,
      detail: grossChange === null ? 'Sem receita para comparar no período anterior.' : `Mais rápido que a receita (${pctText(grossChange)}).`,
    })
  }
  if (now.margin !== null && before.margin !== null && Math.abs(now.margin - before.margin) >= 0.05) {
    const points = (now.margin - before.margin) * 100
    insights.push({
      id: 'margin',
      tone: points > 0 ? 'good' : 'warning',
      title: `Margem ${points > 0 ? 'subiu' : 'caiu'} ${Math.abs(points).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} p.p.`,
      detail: `De ${(before.margin * 100).toFixed(1)}% para ${(now.margin * 100).toFixed(1)}%.`,
    })
  }
  if (now.margin !== null && now.margin < minMarginRate) {
    insights.push({
      id: 'margin_target',
      tone: 'warning',
      title: 'Margem abaixo da meta',
      detail: `${(now.margin * 100).toFixed(1)}% no recorte; a meta cadastrada é ${(minMarginRate * 100).toFixed(0)}%.`,
    })
  }
  const topModel = data.ai_by_model[0]
  if (topModel && now.ai > 0 && topModel.cents / now.ai >= 0.5 && data.ai_by_model.length > 1) {
    insights.push({
      id: 'model',
      tone: 'info',
      title: `${topModel.name} concentra ${Math.round((topModel.cents / now.ai) * 100)}% do custo de IA`,
      detail: `${brl(topModel.cents)} em ${topModel.events.toLocaleString('pt-BR')} gerações.`,
    })
  }
  for (const plan of planResults(data.by_plan)) {
    if (plan.result < 0 && plan.costs > 0) {
      insights.push({
        id: `plan_${plan.slug}`,
        tone: 'warning',
        title: `${plan.name} deu prejuízo no recorte`,
        detail: `Custou ${brl(plan.costs)} e trouxe ${brl(plan.revenue)}.`,
      })
    }
  }
  if (data.totals.overdue_cents > 0) {
    insights.push({ id: 'overdue', tone: 'warning', title: 'Renovações vencidas', detail: `${brl(data.totals.overdue_cents)} em atraso no recorte.` })
  }
  if (now.refunds > 0 && now.gross > 0 && now.refunds / now.gross >= 0.1) {
    insights.push({ id: 'refunds', tone: 'warning', title: 'Reembolsos acima de 10% da receita', detail: `${brl(now.refunds)} de ${brl(now.gross)}.` })
  }
  return insights
}

// ----------------------------------------------------------------------- exportação

export const MOVEMENT_COLUMNS = [
  { id: 'occurred_at', label: 'Data e hora' },
  { id: 'user', label: 'Usuário' },
  { id: 'description', label: 'Descrição' },
  { id: 'category', label: 'Categoria' },
  { id: 'plan', label: 'Plano' },
  { id: 'type', label: 'Tipo' },
  { id: 'amount', label: 'Valor' },
  { id: 'status', label: 'Status' },
  { id: 'method', label: 'Forma de pagamento' },
  { id: 'reference', label: 'Identificador' },
] as const
export type MovementColumn = (typeof MOVEMENT_COLUMNS)[number]['id']

const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso))

/** Categoria da linha na tabela: a da despesa, a origem da receita ou o tipo. */
export function movementCategory(row: Movement): string {
  if (row.category) return categoryLabel(row.category)
  if (row.source) return sourceLabel(row.source)
  return typeLabel(row.type)
}

/** Sinal do valor no caixa: receita entra, despesa e reembolso saem, ajuste não mexe. */
export function signedCents(row: Movement): number {
  if (row.type === 'expense' || row.type === 'refund') return -row.amount_cents
  if (row.type === 'revenue' && (row.status === 'paid' || row.status === 'refunded')) return row.amount_cents
  return 0
}

export const EXPORT_HEADER = [
  'Data e hora',
  'Usuário',
  'Descrição',
  'Categoria',
  'Plano',
  'Tipo',
  'Valor (R$)',
  'Efeito no caixa (R$)',
  'Líquido Asaas (R$)',
  'Status',
  'Forma de pagamento',
  'Identificador',
  'Base do custo',
  'Provedor de IA',
  'Modelo',
  'Funcionalidade',
] as const

export function exportRows(rows: readonly Movement[], planName: (slug: string | null) => string): (string | number | null)[][] {
  return rows.map((row) => [
    formatDateTime(row.occurred_at),
    row.email ?? (row.user_id ? row.user_id : '–'),
    row.description,
    movementCategory(row),
    planName(row.plan_slug),
    typeLabel(row.type),
    row.amount_cents / 100,
    signedCents(row) / 100,
    row.net_cents === null ? null : row.net_cents / 100,
    statusLabel(row.status),
    methodLabel(row.method),
    row.reference ?? row.id,
    row.cost_basis ? (COST_BASIS_LABELS[row.cost_basis] ?? row.cost_basis) : null,
    row.ai_provider,
    row.ai_model,
    row.ai_feature ? featureName(row.ai_feature) : null,
  ])
}

/** Resumo do recorte para a primeira aba da planilha. */
export function summaryRows(data: Explorer): (string | number | null)[][] {
  const now = resultOf(data.totals)
  const before = resultOf(data.previous)
  const line = (name: string, current: number | null, previous: number | null) => [
    name,
    current === null ? null : current / 100,
    previous === null ? null : previous / 100,
  ]
  const { provisional, reasons } = provisionalOf(data)
  return [
    line('Receita bruta', now.gross, before.gross),
    line('Reembolsos', now.refunds, before.refunds),
    line('Taxas de pagamento', now.fees, before.fees),
    line('Receita líquida estimada', now.netRevenue, before.netRevenue),
    line('Receita líquida conciliada (Asaas)', data.totals.reconciled_net_cents, data.previous.reconciled_net_cents),
    line('Custo de IA', now.ai, before.ai),
    line('Despesas totais', now.expenses, before.expenses),
    line('Lucro líquido', now.profit, before.profit),
    ['Margem de lucro (%)', now.margin === null ? null : Math.round(now.margin * 1000) / 10, before.margin === null ? null : Math.round(before.margin * 1000) / 10],
    line('Pagamentos pendentes e vencidos', now.pending, before.pending),
    line('MRR atual', data.mrr.now_cents, data.mrr.start_cents),
    line('ARR atual', data.mrr.now_cents * 12, data.mrr.start_cents * 12),
    ['Lucro provisório?', provisional ? `Sim: ${reasons.join('; ')}` : 'Não', null],
  ]
}

export const SUMMARY_HEADER = ['Indicador', 'Recorte', 'Comparação'] as const

export const ALL_FEATURES: readonly Feature[] = FEATURES
