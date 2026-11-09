import { describe, expect, it } from 'vitest'
import type { Dashboard } from './adminDashboard'
import type { Business } from './business'
import {
  bucketKey,
  centerCsvRows,
  centerAlerts,
  centerSchema,
  defaultGranularity,
  featureMargins,
  type CenterData,
  financialSummary,
  moneySeries,
  planMargins,
  providerHealth,
  simulateScenarios,
  unitEconomics,
  type Center,
} from './commandCenter'

const center = (overrides: Partial<Center> = {}): Center => ({
  ...centerSchema.parse({
    period: { from: '2026-10-01T03:00:00.000Z', to: '2026-10-31T03:00:00.000Z' },
    settings: { credit_value_brl: 0.1, usd_brl: 5.5, payment_fee_rate: 0.05, min_margin_rate: 0.4 },
    plans: [
      { slug: 'gratis', name: 'Grátis', price_cents: 0, monthly_credits: 100, status: 'active' },
      { slug: 'pro', name: 'Pro', price_cents: 5000, monthly_credits: 2000, status: 'active' },
      { slug: 'max', name: 'Max', price_cents: 10000, monthly_credits: 5000, status: 'active' },
    ],
    revenue: {
      series: [
        { day: '2026-10-05', gross_cents: 60_000, refunds_cents: 0, previous_gross_cents: 30_000 },
        { day: '2026-10-06', gross_cents: 60_000, refunds_cents: 20_000, previous_gross_cents: 0 },
      ],
      gross_cents: 120_000,
      refunds_cents: 20_000,
      previous_gross_cents: 30_000,
      previous_refunds_cents: 0,
      lifetime_gross_cents: 500_000,
      lifetime_refunds_cents: 20_000,
      month_received_cents: 100_000,
      projected_next_month_cents: 90_000,
      at_risk_cents: 5_000,
      mrr_start_cents: 100_000,
      mrr_lost_cents: 10_000,
      churn_30d: { base: 20, lost: 2, base_cents: 100_000, lost_cents: 10_000 },
      expenses_90d_cents: 90_000,
      expenses_by_day: [{ day: '2026-10-06', cents: 10_000 }],
      marketing_cents: 20_000,
      new_paying: 4,
      paying_ai_cost_brl: 100,
    },
    ai: {
      cost_today_brl: 0,
      cost_month_brl: 150,
      cost_brl: 150,
      credits: 3000,
      events: 100,
      unknown: 0,
      series: [],
      by_feature: [
        { feature: 'video', generations: 10, credits: 1000, cost_brl: 120, users: 3 },
        { feature: 'image', generations: 90, credits: 2000, cost_brl: 30, users: 9 },
      ],
      by_model: [],
      model_series: [],
      top_users: [],
    },
    users: {
      dau: 1, wau: 3, mau: 9, active_period: 9, generations_period: 100, never_used: 40, used_ai: 60, near_limit: 2, exhausted: 1,
      active_series: [], cohorts: [],
    },
    operations: {
      total: 100, succeeded: 95, failed: 5, open: 0, stuck: 0, failed_billed: 1, failed_billed_cost_brl: 1,
      duration: [], providers: [], errors: [],
    },
  }),
  ...overrides,
})

const dashboard = {
  users: { total: 100, paying: 10 },
  finance: { mrr_cents: 100_000 },
} as unknown as Dashboard

const business = {
  ai: { cost_brl: 150 },
  conversion: { signups: 0, converted: 0, signups_previous: 0, converted_previous: 0 },
  money: {
    payment_fee_rate: 0.05,
    expenses_cents: 10_000,
    revenue_series: [{ day: '2026-10-05', revenue_cents: 60_000, ai_cost_brl: 100 }, { day: '2026-10-06', revenue_cents: 40_000, ai_cost_brl: 50 }],
    plans: [
      { slug: 'pro', name: 'Pro', price_cents: 5000, users: 8, received_cents: 40_000, ai_cost_brl: 100, credits: 1000 },
      { slug: 'max', name: 'Max', price_cents: 10000, users: 2, received_cents: 10_000, ai_cost_brl: 120, credits: 900 },
    ],
  },
} as unknown as Business

describe('central: financeiro', () => {
  it('separa bruto, reembolso, taxa, IA e despesas; lucro só desconta o que foi registrado', () => {
    const summary = financialSummary(center(), business)
    expect(summary).toMatchObject({
      grossCents: 120_000,
      refundsCents: 20_000,
      feesCents: 5_000,
      netCents: 95_000,
      aiCostCents: 15_000,
      otherCostsCents: 10_000,
      contributionCents: 80_000,
      profitCents: 70_000,
      lifetimeNetCents: 480_000,
    })
    expect(summary?.profitMargin).toBeCloseTo(0.7)
    expect(summary?.grossChange).toBeCloseTo(3)
  })

  it('sem acesso ao financeiro, não há resumo', () => {
    expect(financialSummary(center({ revenue: null }), business)).toBeNull()
  })

  it('série agrupa por semana (segunda) e mês, com lucro do dia', () => {
    expect(bucketKey('2026-10-07', 'week')).toBe('2026-10-05')
    expect(bucketKey('2026-10-07', 'month')).toBe('2026-10')
    const [week] = moneySeries(center(), business, 'week')
    expect(week?.gross).toBe(1200)
    expect(week?.ai).toBe(150)
    expect(week?.other).toBe(100)
    expect(week?.profit).toBeCloseTo(950 - 150 - 100)
    expect(defaultGranularity(30)).toBe('day')
    expect(defaultGranularity(90)).toBe('week')
    expect(defaultGranularity(365)).toBe('month')
  })
})

describe('central: unidade econômica', () => {
  it('calcula ARPU, ARPPU, custo de atender, LTV, CAC e ponto de equilíbrio', () => {
    const unit = unitEconomics(center(), dashboard)
    expect(unit).toMatchObject({
      arpuCents: 1_000,
      arppuCents: 10_000,
      costToServeCents: 1_000,
      unitContributionCents: 8_500,
      fixedMonthlyCents: 30_000,
      breakEvenSubscribers: 4,
      cacCents: 5_000,
    })
    expect(unit?.monthlyChurn).toBeCloseTo(0.1)
    expect(unit?.revenueChurn).toBeCloseTo(0.1)
    expect(unit?.ltvCents).toBe(85_000)
    expect(unit?.ltvToCac).toBeCloseTo(17)
  })

  it('sem churn medido ou sem marketing registrado, LTV e CAC ficam nulos', () => {
    const base = center()
    const revenue = base.revenue
    if (!revenue) throw new Error('fixture')
    const unit = unitEconomics({ ...base, revenue: { ...revenue, churn_30d: { base: 0, lost: 0, base_cents: 0, lost_cents: 0 }, marketing_cents: 0 } }, dashboard)
    expect([unit?.ltvCents, unit?.cacCents, unit?.ltvToCac]).toEqual([null, null, null])
  })

  it('margem por plano e por funcionalidade, com custo por geração', () => {
    const [pro, max] = planMargins(business, 0.05)
    expect(pro?.marginCents).toBe(40_000 - 2_000 - 10_000)
    expect(max?.margin).toBeLessThan(0)
    const [video] = featureMargins(center())
    expect(video?.label).toBe('Vídeos')
    expect(video?.revenueBrl).toBe(100)
    expect(video?.margin).toBeCloseTo(-0.2)
    expect(video?.costPerGenerationBrl).toBe(12)
  })
})

describe('central: operação, alertas e simulação', () => {
  it('saúde do fornecedor vem da taxa de falha das últimas 24 h', () => {
    expect(providerHealth(0, 0)).toBe('idle')
    expect(providerHealth(100, 5)).toBe('ok')
    expect(providerHealth(100, 15)).toBe('degraded')
    expect(providerHealth(10, 4)).toBe('unstable')
  })

  it('alerta plano com margem negativa, pico de custo, falhas e fornecedor instável, críticos primeiro', () => {
    const base = center({
      ai: { ...center().ai, cost_today_brl: 40 },
      operations: {
        ...center().operations,
        total: 40,
        failed: 12,
        providers: [{ provider: 'fal', total_24h: 10, failed_24h: 5, last_success_at: null, last_failure_at: null }],
      },
    })
    const alerts = centerAlerts(base, financialSummary(base, business), planMargins(business, 0.05))
    expect(alerts.map((alert) => alert.id)).toEqual(['failures', 'provider-fal', 'plan-max', 'ai-spike'])
    expect(alerts.slice(0, 3).every((alert) => alert.severity === 'critical')).toBe(true)
  })

  it('cenários usam o preço real e as premissas, sem plano grátis na receita', () => {
    const plans = center().plans
    const [thirty, thousand] = simulateScenarios(
      plans,
      { mix: { pro: 3, max: 1, gratis: 5 }, utilization: 0.5, costPerCreditBrl: 0.02, feeRate: 0.05, fixedMonthlyCents: 50_000 },
      [30, 1000],
    )
    expect(thirty?.revenueCents).toBe(22.5 * 5000 + 7.5 * 10000)
    expect(thirty?.aiCostCents).toBe(Math.round(22.5 * 2000 * 0.5 * 2 + 7.5 * 5000 * 0.5 * 2))
    expect(thousand?.profitCents).toBeGreaterThan(thirty?.profitCents ?? 0)
  })
})

describe('central: exportação', () => {
  it('CSV traz indicadores em reais e a série diária, sem dinheiro para quem não vê o financeiro', () => {
    const base = center()
    const fullDashboard = {
      ...dashboard,
      users: { ...dashboard.users, new_in_period: 0, new_previous: 0 },
      finance: { ...dashboard.finance, new_subscriptions: 1, cancellations: 0, churn_lost: 0, churn_base: 0 },
      series: [{ day: '2026-10-05', signups: 2, succeeded: 3, failed: 1 }],
    } as unknown as Dashboard
    const data: CenterData = {
      dashboard: fullDashboard,
      business: { ...business, credits: { distributed: 0, consumed: 0, available: 10 } } as Business,
      center: base,
      summary: financialSummary(base, business),
      unit: unitEconomics(base, fullDashboard),
      plans: [],
      features: featureMargins(base),
      alerts: [],
    }
    const { indicators, daily } = centerCsvRows(data)
    expect(indicators).toContainEqual(['Financeiro', 'Lucro operacional estimado (R$)', 700])
    expect(indicators).toContainEqual(['IA por funcionalidade', 'Vídeos: custo (R$)', 120])
    expect(daily[0]).toEqual(['2026-10-05', 2, 0, 3, 1, 0, 600, 0])
    const restricted = centerCsvRows({ ...data, summary: null, unit: null, dashboard: { ...fullDashboard, finance: null } })
    expect(restricted.indicators.some(([section]) => section === 'Financeiro' || section === 'Negócio')).toBe(false)
  })
})
