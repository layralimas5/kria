import { describe, expect, it } from 'vitest'
import { financeAlerts, financeStatement, simulate, statementOf, userProfitability, type Finance, type FinanceSettings } from './finance'

const SETTINGS: FinanceSettings = {
  tax_rate: 0.06,
  fixed_costs_cents: 30_000,
  infra_costs_cents: 13_000,
  storage_costs_cents: 0,
  render_cost_cents_per_export: 0,
  pro_labore_cents: 300_000,
  reserve_rate: 0.1,
  min_margin_rate: 0.4,
}

function finance(overrides: Partial<Finance> = {}): Finance {
  return {
    period: { from: '2026-11-01T03:00:00Z', to: '2026-12-01T03:00:00Z', days: 30 },
    usd_brl: 5.6,
    payment_fee_rate: 0.035,
    credit_scale: 1,
    settings: SETTINGS,
    revenue_cents: 1_000_000,
    revenue_previous_cents: 800_000,
    refunds_cents: 0,
    mrr_cents: 1_000_000,
    active_subscriptions: 70,
    api_cost_usd: 250,
    api_cost_previous_usd: 200,
    api_cost_estimated_count: 0,
    failed_billed_usd: 0,
    exports_done: 300,
    export_render_ms: 0,
    export_bytes: 0,
    by_plan: [],
    by_user: [],
    by_model: [],
    ...overrides,
  }
}

describe('financeStatement', () => {
  it('desce da receita ao distribuível, camada por camada', () => {
    const statement = statementOf(finance())
    expect(statement.netRevenueCents).toBe(1_000_000)
    expect(statement.gatewayCents).toBe(35_000)
    expect(statement.taxesCents).toBe(60_000)
    expect(statement.apiCostCents).toBe(140_000)
    expect(statement.variableCents).toBe(235_000)
    expect(statement.contributionCents).toBe(765_000)
    expect(statement.contributionRate).toBeCloseTo(0.765)
    expect(statement.fixedCents).toBe(43_000)
    expect(statement.operatingCents).toBe(722_000)
    expect(statement.afterProLaboreCents).toBe(422_000)
    expect(statement.reserveCents).toBe(42_200)
    expect(statement.distributableCents).toBe(379_800)
  })

  it('custo mensal entra proporcional ao período e prejuízo não gera reserva nem distribuição', () => {
    const statement = financeStatement({
      revenueCents: 10_000,
      refundsCents: 2_000,
      apiCostCents: 1_000,
      exports: 0,
      days: 15,
      paymentFeeRate: 0.035,
      settings: SETTINGS,
    })
    expect(statement.netRevenueCents).toBe(8_000)
    expect(statement.fixedCents).toBe(21_500)
    expect(statement.proLaboreCents).toBe(150_000)
    expect(statement.reserveCents).toBe(0)
    expect(statement.distributableCents).toBe(0)
  })

  it('sem receita a margem fica nula, não 0%', () => {
    expect(statementOf(finance({ revenue_cents: 0 })).contributionRate).toBeNull()
  })
})

describe('financeAlerts', () => {
  const model = { slug: 'foto', name: 'Nano Banana 2', provider: 'fal', kind: 'image', current_credits: 5, provider_cost_usd: null, cost_checked_at: null }

  it('avisa preço velho, operação deficitária, falha demais, margem baixa e custo crescendo', () => {
    const alerts = financeAlerts(
      finance({
        revenue_cents: 100_000,
        api_cost_usd: 120,
        api_cost_previous_usd: 50,
        by_model: [{ ...model, stale: true, total: 10, failed: 4, billed: 6, credits: 30, cost_usd: 120, estimated: 6, deficit: 2 }],
        api_cost_estimated_count: 6,
      }),
    )
    expect(alerts.map((alert) => alert.id)).toEqual(['deficit-foto', 'low-margin', 'stale-cost', 'failures-foto', 'cost-growth', 'estimated-cost'])
  })

  it('assinante acima de 80% do orçamento interno vira alerta', () => {
    const alerts = financeAlerts(
      finance({
        by_user: [{ user_id: crypto.randomUUID(), email: 'a@x.com', plan_slug: 'creator-start', ai_budget_cents: 1000, credits: 900, generations: 20, cost_usd: 1.8, revenue_cents: 6990, exports: 3 }],
      }),
    )
    expect(alerts.find((alert) => alert.id === 'user-budget')?.severity).toBe('critical')
  })

  it('operação saudável não gera alerta', () => {
    expect(financeAlerts(finance())).toEqual([])
  })
})

describe('userProfitability', () => {
  it('margem da pessoa desconta taxas, impostos e custo de IA', () => {
    const [row] = userProfitability(
      finance({
        by_user: [{ user_id: crypto.randomUUID(), email: null, plan_slug: 'creator-pro', ai_budget_cents: 2500, credits: 1000, generations: 10, cost_usd: 2, revenue_cents: 14_990, exports: 10 }],
      }),
    )
    expect(row!.costCents).toBe(1120)
    expect(row!.marginCents).toBe(14_990 - Math.round(14_990 * 0.095) - 1120)
    expect(row!.budgetUse).toBeCloseTo(0.448)
  })
})

describe('simulate', () => {
  const input = {
    plans: [
      { name: 'Creator Start', priceCents: 6990, subscribers: 40, monthlyCredits: 1000, exportsPerMonth: 40, aiBudgetCents: 1000 },
      { name: 'Creator Pro', priceCents: 14_990, subscribers: 50, monthlyCredits: 2500, exportsPerMonth: 150, aiBudgetCents: 2500 },
      { name: 'Creator Max', priceCents: 29_990, subscribers: 10, monthlyCredits: 6000, exportsPerMonth: 400, aiBudgetCents: 6000 },
    ],
    usageRate: 0.5,
    aiCostPerCreditCents: 0.87,
    editCostCentsPerExport: 0,
    paymentFeeRate: 0.035,
    settings: SETTINGS,
    acquisitionCents: 100_000,
    supportCents: 0,
  }

  it('monta os três cenários com receita, custo e ponto de equilíbrio', () => {
    const [conservative, expected, heavy] = simulate(input)
    expect(expected!.subscribers).toBe(100)
    expect(expected!.revenueCents).toBe(40 * 6990 + 50 * 14_990 + 10 * 29_990)
    expect(heavy!.statement.apiCostCents).toBeGreaterThan(expected!.statement.apiCostCents)
    expect(conservative!.subscribers).toBe(70)
    expect(expected!.breakEvenSubscribers).toBeGreaterThan(0)
    expect(expected!.breakEvenWithProLaboreSubscribers!).toBeGreaterThan(expected!.breakEvenSubscribers!)
  })

  it('custo de IA nunca passa do orçamento interno do plano', () => {
    const heavy = simulate({ ...input, aiCostPerCreditCents: 5 })[2]!
    expect(heavy.statement.apiCostCents).toBe(40 * 1000 + 50 * 2500 + 10 * 6000)
  })

  it('sem margem por assinante não há ponto de equilíbrio', () => {
    const expected = simulate({ ...input, plans: input.plans.map((plan) => ({ ...plan, priceCents: 0 })) })[1]!
    expect(expected.breakEvenSubscribers).toBeNull()
  })
})
