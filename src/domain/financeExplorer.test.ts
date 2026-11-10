import { describe, expect, it } from 'vitest'
import {
  activeFilterCount,
  change,
  chartPoints,
  clearFilters,
  DEFAULT_FILTERS,
  explorerSchema,
  exportRows,
  financeInsights,
  filtersFromParams,
  filtersToParams,
  filtersToSaved,
  monthRows,
  planResults,
  provisionalOf,
  rangeError,
  resultOf,
  savedToFilters,
  signedCents,
  toRpcFilters,
  type Explorer,
  type Movement,
  type Totals,
} from './financeExplorer'

const totals = (patch: Partial<Totals> = {}): Totals => ({
  gross_cents: 100_000,
  reconciled_gross_cents: 0,
  reconciled_net_cents: 0,
  refunds_cents: 0,
  fees_cents: 5_000,
  fees_estimated_cents: 0,
  ai_cents: 20_000,
  ai_estimated_cents: 0,
  ai_unknown_events: 0,
  other_expenses_cents: 10_000,
  expenses_cents: 35_000,
  pending_cents: 0,
  overdue_cents: 0,
  paid_count: 10,
  paying_users: 8,
  rows: 30,
  ...patch,
})

const movement = (patch: Partial<Movement> = {}): Movement => ({
  id: 'sp:1',
  occurred_at: '2026-11-05T15:00:00Z',
  type: 'revenue',
  status: 'paid',
  source: 'renewal',
  category: null,
  plan_slug: 'pro',
  user_id: 'u1',
  email: 'ana@x.com',
  description: 'Mensalidade Pro',
  amount_cents: 7_990,
  net_cents: 7_700,
  credits: null,
  method: 'card',
  reference: 'pay_1',
  ai_provider: null,
  ai_model: null,
  ai_feature: null,
  cost_basis: null,
  events: null,
  details: null,
  ...patch,
})

function explorer(patch: Partial<Explorer> = {}): Explorer {
  return {
    period: { from: '2026-10-11T03:00:00Z', to: '2026-11-10T03:00:00Z', compare_from: '', compare_to: '', compare: 'previous', granularity: 'day' },
    totals: totals(),
    previous: totals(),
    mrr: { now_cents: 50_000, start_cents: 40_000 },
    coverage: { months_without_expenses: 0, months: 2, payment_fee_rate: 0.05 },
    series: [],
    monthly: [],
    by_plan: [],
    by_category: [],
    by_source: [],
    by_method: [],
    ai_by_model: [],
    ai_by_provider: [],
    by_user: [],
    options: { plans: [], ai_providers: [], ai_models: [], can_filter_user: true },
    table: { total: 0, page: 1, page_size: 25, rows: [] },
    ...patch,
  }
}

describe('filtros na URL', () => {
  it('ida e volta mantém o recorte e preserva outros parâmetros', () => {
    const filters = {
      ...DEFAULT_FILTERS,
      preset: 'custom' as const,
      start: '2026-11-01',
      end: '2026-11-09',
      compare: 'year' as const,
      granularity: 'week' as const,
      types: ['revenue' as const, 'refund' as const],
      methods: ['pix' as const],
      plans: ['creator-pro'],
      user: 'ana@',
      minBrl: '10,50',
    }
    const params = filtersToParams(filters, new URLSearchParams('aba=central'))
    expect(params.get('aba')).toBe('central')
    expect(params.get('tipo')).toBe('revenue,refund')
    expect(filtersFromParams(params)).toEqual(filters)
  })

  it('descarta valores inválidos de link editado à mão', () => {
    const parsed = filtersFromParams(new URLSearchParams('tipo=revenue,saque&forma=pix,cheque&min=abc&agrupar=ano&periodo=sempre&de=ontem'))
    expect(parsed.types).toEqual(['revenue'])
    expect(parsed.methods).toEqual(['pix'])
    expect([parsed.minBrl, parsed.granularity, parsed.preset, parsed.start]).toEqual(['', 'day', '30d', ''])
  })

  it('padrão não suja a URL e limpar mantém período, comparação e agrupamento', () => {
    expect(filtersToParams(DEFAULT_FILTERS, new URLSearchParams()).toString()).toBe('')
    const busy = { ...DEFAULT_FILTERS, preset: '7d' as const, granularity: 'week' as const, methods: ['pix' as const], user: 'x', maxBrl: '100' }
    expect(activeFilterCount(busy)).toBe(3)
    expect(clearFilters(busy)).toEqual({ ...DEFAULT_FILTERS, preset: '7d', granularity: 'week' })
  })

  it('filtro salvo guarda o recorte relativo e volta igual', () => {
    const filters = { ...DEFAULT_FILTERS, preset: 'month' as const, categories: ['ai' as const] }
    expect(savedToFilters(filtersToSaved(filters))).toEqual(filters)
  })

  it('manda lista vazia como nulo e valores em centavos', () => {
    const body = toRpcFilters({ ...DEFAULT_FILTERS, minBrl: '19,90', statuses: ['paid'] }, { from: new Date('2026-11-01T03:00:00Z'), to: new Date('2026-11-02T03:00:00Z') })
    expect(body).toMatchObject({ types: null, statuses: ['paid'], min_cents: 1990, max_cents: null, user: null, from: '2026-11-01T03:00:00.000Z' })
  })

  it('avisa quando o mínimo passa do máximo', () => {
    expect(rangeError({ ...DEFAULT_FILTERS, minBrl: '100', maxBrl: '10' })).toMatch(/mínimo/)
    expect(rangeError({ ...DEFAULT_FILTERS, minBrl: '10', maxBrl: '100' })).toBeNull()
  })
})

describe('indicadores', () => {
  it('lucro desconta reembolso e todas as despesas; margem sobre a receita depois do reembolso', () => {
    const result = resultOf(totals({ refunds_cents: 10_000, pending_cents: 3_000, overdue_cents: 2_000 }))
    expect(result).toMatchObject({ netRevenue: 85_000, profit: 55_000, pending: 5_000 })
    expect(result.margin).toBeCloseTo(55_000 / 90_000)
    expect(resultOf(totals({ gross_cents: 0, expenses_cents: 100 })).margin).toBeNull()
  })

  it('variação é nula sem base', () => {
    expect(change(10, 0)).toBeNull()
    expect(change(150, 100)).toBe(0.5)
    expect(change(-50, -100)).toBe(0.5)
  })

  it('lucro é provisório quando falta custo registrado', () => {
    expect(provisionalOf(explorer()).provisional).toBe(false)
    const missing = provisionalOf(
      explorer({ totals: totals({ ai_unknown_events: 3, fees_estimated_cents: 100 }), coverage: { months_without_expenses: 1, months: 1, payment_fee_rate: 0.05 } }),
    )
    expect(missing.reasons).toHaveLength(3)
    expect(missing.reasons[0]).toMatch(/3 gerações sem custo/)
  })

  it('margem do gráfico é acumulada: dia sem receita não derruba para zero', () => {
    const [, second] = chartPoints([
      { key: '2026-11-01', gross_cents: 10_000, refunds_cents: 0, expenses_cents: 4_000, ai_cents: 0, fees_cents: 0 },
      { key: '2026-11-02', gross_cents: 0, refunds_cents: 0, expenses_cents: 1_000, ai_cents: 0, fees_cents: 0 },
    ])
    expect(second?.values).toMatchObject({ revenue: 0, profit: -10, margin: 50 })
  })

  it('pontos do gráfico em reais, com margem em %', () => {
    const [point] = chartPoints([{ key: '2026-11-01', gross_cents: 10_000, refunds_cents: 0, expenses_cents: 4_000, ai_cents: 3_000, fees_cents: 500 }])
    expect(point?.values).toMatchObject({ revenue: 100, expenses: 40, ai: 30, other: 10, profit: 60, margin: 60 })
  })

  it('comparativo mensal calcula a variação contra o mês anterior', () => {
    const rows = monthRows([
      { key: '2026-10', gross_cents: 10_000, refunds_cents: 0, expenses_cents: 5_000, ai_cents: 0, fees_cents: 0 },
      { key: '2026-11', gross_cents: 15_000, refunds_cents: 0, expenses_cents: 5_000, ai_cents: 0, fees_cents: 0 },
    ])
    expect(rows[0]?.revenueChange).toBeNull()
    expect(rows[1]).toMatchObject({ revenueChange: 0.5, profitChange: 1, margin: 10_000 / 15_000 })
  })

  it('resultado por plano soma IA, taxas e despesas do plano', () => {
    const [free, pro] = planResults([
      { slug: 'gratis', name: 'Grátis', gross_cents: 0, refunds_cents: 0, ai_cents: 900, fees_cents: 0, other_cents: 0, paying_users: 0, users: 10 },
      { slug: 'pro', name: 'Pro', gross_cents: 20_000, refunds_cents: 0, ai_cents: 4_000, fees_cents: 1_000, other_cents: 0, paying_users: 2, users: 2 },
    ]).reverse()
    expect(pro).toMatchObject({ result: 15_000, margin: 0.75 })
    expect(free).toMatchObject({ result: -900, margin: null })
  })
})

describe('alertas', () => {
  it('destaca queda de receita, plano no prejuízo e vencidos', () => {
    const insights = financeInsights(
      explorer({
        totals: totals({ gross_cents: 50_000, overdue_cents: 7_990 }),
        by_plan: [{ slug: 'gratis', name: 'Grátis', gross_cents: 0, refunds_cents: 0, ai_cents: 900, fees_cents: 0, other_cents: 0, paying_users: 0, users: 10 }],
      }),
    )
    const ids = insights.map((item) => item.id)
    expect(ids).toEqual(expect.arrayContaining(['gross', 'plan_gratis', 'overdue', 'margin']))
    expect(insights.find((item) => item.id === 'gross')?.tone).toBe('warning')
  })

  it('sem variação relevante, sem alerta', () => {
    expect(financeInsights(explorer())).toEqual([])
  })
})

describe('movimentações', () => {
  it('efeito no caixa por tipo e status', () => {
    expect(signedCents(movement())).toBe(7_990)
    expect(signedCents(movement({ status: 'pending' }))).toBe(0)
    expect(signedCents(movement({ type: 'refund', status: 'refunded' }))).toBe(-7_990)
    expect(signedCents(movement({ type: 'expense', category: 'ai', amount_cents: 300 }))).toBe(-300)
    expect(signedCents(movement({ type: 'adjustment', amount_cents: 0 }))).toBe(0)
  })

  it('exporta em reais com rótulos em português', () => {
    const [row] = exportRows([movement({ type: 'expense', category: 'payment_fees', cost_basis: 'estimated', amount_cents: 290, net_cents: null })], () => 'Pro')
    expect(row?.slice(2, 13)).toEqual(['Mensalidade Pro', 'Taxas de pagamento', 'Pro', 'Despesa', 2.9, -2.9, null, 'Pago', 'Cartão', 'pay_1', 'Estimado'])
  })

  it('o contrato aceita a resposta do banco', () => {
    expect(explorerSchema.parse({ ...explorer(), table: { total: 1, page: 1, page_size: 25, rows: [movement()] } }).table.rows).toHaveLength(1)
  })
})
