import { describe, expect, it } from 'vitest'
import {
  brtDay,
  buildAlerts,
  change,
  contribution,
  dashboardSchema,
  ratio,
  resolvePeriod,
  type Dashboard,
  type DashboardFinance,
} from './adminDashboard'

// 23/10/2026 às 01:30 em Brasília (04:30 UTC).
const NOW = new Date('2026-10-23T04:30:00Z')

const finance = (overrides: Partial<DashboardFinance> = {}): DashboardFinance => ({
  mrr_cents: 0,
  past_due: 0,
  received_cents: 0,
  received_previous_cents: 0,
  received_total_cents: 0,
  subscription_received_cents: 0,
  pack_received_cents: 0,
  payments_count: 0,
  refunds_cents: 0,
  new_subscriptions: 0,
  cancellations: 0,
  cancellations_previous: 0,
  churn_base: 0,
  churn_lost: 0,
  api_cost_usd: 0,
  api_cost_previous_usd: 0,
  api_cost_unknown: 0,
  usd_brl: 5.5,
  payment_fee_rate: 0.035,
  by_plan: [],
  ...overrides,
})

const dashboard = (overrides: Partial<Dashboard> = {}): Dashboard =>
  dashboardSchema.parse({
    period: { from: '2026-10-01T03:00:00Z', to: '2026-10-23T03:00:00Z' },
    users: {
      total: 0, new_in_period: 0, new_previous: 0, new_today: 0, new_7d: 0, new_30d: 0, active_1d: 0, active_30d: 0,
      active_in_period: 0, paying: 0, onboarded_in_period: 0, first_generation_in_period: 0, converted_in_period: 0,
    },
    generations: {
      total: 0, succeeded: 0, failed: 0, open: 0, image: 0, video: 0, text: 0, today: 0, month: 0, credits_consumed: 0,
      previous_total: 0, previous_failed: 0,
    },
    plan_distribution: [],
    by_model: [],
    series: null,
    top_consumers: null,
    finance: null,
    ...overrides,
  })

describe('resolvePeriod', () => {
  it('usa o dia de Brasília, não o de UTC', () => {
    expect(brtDay(NOW)).toBe('2026-10-23')
    const today = resolvePeriod('today', NOW)
    expect(today?.from.toISOString()).toBe('2026-10-23T03:00:00.000Z')
    expect(today?.to.toISOString()).toBe('2026-10-24T03:00:00.000Z')
  })

  it('ontem termina onde hoje começa', () => {
    const yesterday = resolvePeriod('yesterday', NOW)
    expect(yesterday?.from.toISOString()).toBe('2026-10-22T03:00:00.000Z')
    expect(yesterday?.to.toISOString()).toBe('2026-10-23T03:00:00.000Z')
  })

  it('7 dias inclui hoje', () => {
    const week = resolvePeriod('7d', NOW)
    expect(week?.from.toISOString()).toBe('2026-10-17T03:00:00.000Z')
    expect(week?.to.toISOString()).toBe('2026-10-24T03:00:00.000Z')
  })

  it('mês atual, mês anterior e ano atual seguem o calendário de Brasília', () => {
    const month = resolvePeriod('month', NOW)
    expect(month?.from.toISOString()).toBe('2026-10-01T03:00:00.000Z')
    expect(month?.to.toISOString()).toBe('2026-10-24T03:00:00.000Z')
    const last = resolvePeriod('last_month', NOW)
    expect(last?.from.toISOString()).toBe('2026-09-01T03:00:00.000Z')
    expect(last?.to.toISOString()).toBe('2026-10-01T03:00:00.000Z')
    expect(resolvePeriod('year', NOW)?.from.toISOString()).toBe('2026-01-01T03:00:00.000Z')
  })

  it('personalizado inclui o último dia e recusa intervalo invertido ou longo demais', () => {
    const custom = resolvePeriod('custom', NOW, { start: '2026-10-01', end: '2026-10-01' })
    expect(custom?.from.toISOString()).toBe('2026-10-01T03:00:00.000Z')
    expect(custom?.to.toISOString()).toBe('2026-10-02T03:00:00.000Z')
    expect(resolvePeriod('custom', NOW, { start: '2026-10-05', end: '2026-10-01' })).toBeNull()
    expect(resolvePeriod('custom', NOW, { start: '2024-01-01', end: '2026-10-01' })).toBeNull()
    expect(resolvePeriod('custom', NOW, { start: 'ontem', end: '2026-10-01' })).toBeNull()
  })
})

describe('indicadores', () => {
  it('sem base não vira zero', () => {
    expect(ratio(3, 0)).toBeNull()
    expect(change(10, 0)).toBeNull()
    expect(change(15, 10)).toBe(0.5)
  })

  it('margem de contribuição desconta taxa e custo de API em reais', () => {
    const result = contribution(finance({ received_cents: 100_00, api_cost_usd: 2 }))
    expect(result.feesCents).toBe(350)
    expect(result.apiCostCents).toBe(1100)
    expect(result.marginCents).toBe(100_00 - 350 - 1100)
    expect(result.marginRate).toBeCloseTo(0.855)
  })
})

describe('buildAlerts', () => {
  it('sem dados, sem alerta', () => {
    expect(buildAlerts(dashboard())).toEqual([])
  })

  it('modelo com muita falha alerta só com volume mínimo', () => {
    const model = { model_slug: 'video-veo', name: 'Veo 3.1', kind: 'video', provider: 'fal', credits: 0, cost_usd: null }
    expect(buildAlerts(dashboard({ by_model: [{ ...model, total: 3, failed: 3 }] }))).toEqual([])
    const alerts = buildAlerts(dashboard({ by_model: [{ ...model, total: 10, failed: 6 }] }))
    expect(alerts.map((alert) => [alert.id, alert.severity])).toEqual([['model-failure:video-veo', 'critical']])
  })

  it('margem negativa vem antes dos avisos', () => {
    const alerts = buildAlerts(dashboard({ finance: finance({ received_cents: 1000, api_cost_usd: 10, past_due: 1 }) }))
    expect(alerts[0]?.id).toBe('negative-margin')
    expect(alerts.map((alert) => alert.id)).toContain('past-due')
  })

  it('custo de API que cresce rápido alerta; crescimento pequeno não', () => {
    expect(buildAlerts(dashboard({ finance: finance({ api_cost_usd: 12, api_cost_previous_usd: 10 }) }))).toEqual([])
    const ids = buildAlerts(dashboard({ finance: finance({ api_cost_usd: 20, api_cost_previous_usd: 10 }) })).map((alert) => alert.id)
    expect(ids).toEqual(['cost-growth'])
  })

  it('uma conta com a maior parte dos créditos alerta', () => {
    const alerts = buildAlerts(
      dashboard({
        generations: { ...dashboard().generations, credits_consumed: 1000 },
        top_consumers: [{ user_id: 'u1', email: 'ana@x.com', credits: 600, generations: 15 }],
      }),
    )
    expect(alerts.map((alert) => alert.id)).toEqual(['consumer:u1'])
  })
})
