import { describe, expect, it } from 'vitest'
import { costAlerts, summarizeCosts, type AiCosts, type CostModel } from './aiCosts'
import { buildInsights, executiveMetrics, planMargin, toCsv, type Business } from './business'
import type { Dashboard } from './adminDashboard'

const model = (overrides: Partial<CostModel> = {}): CostModel => ({
  slug: 'foto',
  name: 'Foto',
  provider: 'fal',
  endpoint: 'fal-ai/nano-banana-2',
  kind: 'image',
  active: true,
  credits: 8,
  pricing: { unit: 'image', usd: 0.08 },
  provider_cost_usd: 0.08,
  target_margin_rate: null,
  cost_checked_at: null,
  cost_source: null,
  unit: 'image',
  unit_margin: 0.6,
  uses_period: 0,
  uses_previous: 0,
  uses_total: 0,
  uses_7d: 0,
  uses_prev_7d: 0,
  credits_period: 0,
  cost_period_brl: 0,
  cost_total_brl: 0,
  metered: 0,
  unknown: 0,
  ...overrides,
})

const costs = (models: CostModel[], kpis: Partial<AiCosts['kpis']> = {}): AiCosts => ({
  period: { from: '', to: '' },
  usd_brl: 5.5,
  credit_value_brl: 0.1,
  min_margin_rate: 0.4,
  max_operation_cost_usd: 5,
  kpis: {
    cost_today_brl: 0,
    cost_7d_brl: 0,
    cost_month_brl: 0,
    cost_total_brl: 0,
    cost_period_brl: 100,
    cost_previous_brl: 0,
    generations: 50,
    generations_previous: 0,
    failed_billed: 0,
    credits: 1000,
    credits_previous: 0,
    active_users: 4,
    metered: 10,
    estimated: 30,
    unknown: 10,
    revenue_estimated_brl: 400,
    ...kpis,
  },
  models,
  series: [],
  trend_30d: [],
  by_provider: [],
  by_kind: [],
  providers: ['fal'],
})

describe('custos de IA', () => {
  it('resume médias, margem e parcela com custo conhecido', () => {
    const summary = summarizeCosts(costs([]))
    expect(summary).toEqual({ avgPerGeneration: 2, avgPerActiveUser: 25, grossMargin: 0.75, trustedShare: 0.8 })
  })

  it('sem receita visível, a margem fica nula em vez de inventada', () => {
    expect(summarizeCosts(costs([], { revenue_estimated_brl: null })).grossMargin).toBeNull()
  })

  it('alerta margem abaixo da meta do modelo, custo perto do teto, pico de uso e custo desconhecido', () => {
    const kinds = costAlerts(
      costs([
        model({ slug: 'a', unit_margin: 0.5, target_margin_rate: 0.6 }),
        model({ slug: 'b', provider_cost_usd: 4.5 }),
        model({ slug: 'c', uses_7d: 30, uses_prev_7d: 10 }),
        model({ slug: 'd', unknown: 2 }),
        model({ slug: 'e', active: false, unit_margin: 0 }),
      ]),
    ).map((alert) => `${alert.slug}:${alert.kind}`)
    expect(kinds).toEqual(['a:margin', 'b:cost', 'c:spike', 'd:unknown'])
  })

  it('pico com pouco volume não vira alerta', () => {
    expect(costAlerts(costs([model({ uses_7d: 5, uses_prev_7d: 1 })]))).toEqual([])
  })
})

const dashboard = {
  users: { total: 100, active_in_period: 30, new_in_period: 20, new_previous: 10, paying: 10 },
  plan_distribution: [{ slug: 'gratis', name: 'Grátis', users: 90 }],
  finance: { mrr_cents: 100_000, received_cents: 120_000, refunds_cents: 20_000, churn_lost: 1, churn_base: 10, cancellations: 2 },
} as unknown as Dashboard

const business = (overrides: Partial<Business> = {}): Business => ({
  period: { from: '', to: '' },
  ai: { cost_brl: 150, cost_previous_brl: 100, generations: 100, generations_previous: 100, unknown_cost: 0, estimated_cost: 0 },
  credits: { distributed: 0, consumed: 0, available: 0 },
  credit_series: [],
  conversion: { signups: 20, converted: 2, signups_previous: 10, converted_previous: 2 },
  unusual_users: [],
  money: {
    payment_fee_rate: 0.05,
    received_cents: 120_000,
    expenses_cents: 10_000,
    expenses: [],
    mrr_series: [],
    revenue_series: [],
    plans: [],
  },
  ...overrides,
})

describe('analytics executivo', () => {
  it('calcula ARR, ARPU, churn, margem bruta e lucro só com despesas registradas', () => {
    const metrics = executiveMetrics(dashboard, business())
    expect(metrics.freeUsers).toBe(90)
    expect(metrics.conversion).toBe(0.1)
    expect(metrics.conversionChange).toBeCloseTo(-0.5)
    expect(metrics.money).toEqual({
      mrrCents: 100_000,
      arrCents: 1_200_000,
      arpuCents: 10_000,
      churn: 0.1,
      cancellations: 2,
      netReceivedCents: 100_000,
      paymentFeesCents: 5_000,
      expensesCents: 10_000,
      grossMargin: 0.85,
      profitCents: 100_000 - 5_000 - 15_000 - 10_000,
    })
  })

  it('sem permissão de financeiro, o bloco de dinheiro some', () => {
    expect(executiveMetrics({ ...dashboard, finance: null }, business({ money: null })).money).toBeNull()
  })

  it('insights disparam por regra e com volume mínimo', () => {
    const ids = buildInsights(
      business({
        unusual_users: [{ user_id: 'u', email: 'ana@x.com', credits: 900, generations: 40, cost_brl: 12 }],
        money: {
          ...business().money!,
          plans: [
            { slug: 'pro', name: 'Pro', price_cents: 16990, users: 3, received_cents: 10_000, ai_cost_brl: 80, credits: 0 },
            { slug: 'gratis', name: 'Grátis', price_cents: 0, users: 90, received_cents: 0, ai_cost_brl: 12, credits: 0 },
          ],
        },
      }),
      {
        by_tool: [
          { model_slug: 'video', name: 'Vídeo', kind: 'video', total: 30, users: 3, succeeded: 30, failed: 0, credits: 0, cost_usd: null, previous_total: 10 },
          { model_slug: 'copy', name: 'Copy', kind: 'text', total: 2, users: 1, succeeded: 2, failed: 0, credits: 0, cost_usd: null, previous_total: 20 },
        ],
      } as never,
      0.4,
    ).map((insight) => insight.id)
    expect(ids).toEqual(['cost-per-generation', 'conversion', 'growth-video', 'drop-copy', 'unusual-users', 'plan-pro', 'plan-cost-gratis'])
  })

  it('margem do plano sem receita é nula', () => {
    expect(planMargin({ slug: 'x', name: 'X', price_cents: 0, users: 0, received_cents: 0, ai_cost_brl: 5, credits: 0 })).toBeNull()
  })
})

describe('CSV', () => {
  it('usa ponto e vírgula, vírgula decimal, aspas quando precisa e BOM', () => {
    expect(toCsv(['a', 'b'], [['x;y', 1.5], [null, 2]])).toBe('﻿a;b\r\n"x;y";1,5\r\n;2')
  })
})
