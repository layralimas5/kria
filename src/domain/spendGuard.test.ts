import { describe, expect, it } from 'vitest'
import { guardLevel, spendAlerts, spendGuardSchema, usageSchema, usedShare, type SpendGuard } from './spendGuard'

const guard = (overrides: Partial<SpendGuard> = {}): SpendGuard => ({
  daily_cost_cap_usd: 25,
  monthly_cost_cap_usd: 300,
  cost_alert_ratio: 0.8,
  generation_paused: false,
  paused_reason: null,
  spent_today_usd: 0,
  spent_month_usd: 0,
  failed_billed_month_usd: 0,
  estimated_month_count: 0,
  top_today: [],
  ...overrides,
})

describe('guardLevel', () => {
  it('sem limite é ilimitado', () => expect(guardLevel(999, null, 0.8)).toBe('unlimited'))
  it('abaixo do alerta é ok', () => expect(guardLevel(79, 100, 0.8)).toBe('ok'))
  it('a partir do alerta avisa', () => expect(guardLevel(80, 100, 0.8)).toBe('warning'))
  it('no limite está atingido', () => expect(guardLevel(100, 100, 0.8)).toBe('reached'))
})

describe('usedShare', () => {
  it('fica entre 0 e 1', () => {
    expect(usedShare(50, 100)).toBe(0.5)
    expect(usedShare(150, 100)).toBe(1)
    expect(usedShare(10, null)).toBe(0)
  })
})

describe('spendAlerts', () => {
  it('nada a dizer quando tudo está abaixo do alerta', () => {
    expect(spendAlerts(guard({ spent_today_usd: 5, spent_month_usd: 50 }))).toEqual([])
  })

  it('avisa a pausa com o motivo, o teto em alerta e o atingido', () => {
    const alerts = spendAlerts(guard({ generation_paused: true, paused_reason: 'fatura alta', spent_today_usd: 25, spent_month_usd: 250 }))
    expect(alerts).toEqual([
      { text: 'Gerações pausadas: fatura alta', severe: true },
      { text: 'Teto de hoje atingido: novas gerações estão barradas até a virada.', severe: true },
      { text: 'Custo do mês passou de 80% do teto.', severe: false },
    ])
  })

  it('lembra quando o custo real não foi cadastrado', () => {
    expect(spendAlerts(guard({ estimated_month_count: 3 }))).toEqual([
      { text: '3 gerações do mês sem custo real cadastrado: a conta usa o pior caso.', severe: false },
    ])
  })
})

describe('schemas', () => {
  it('lê o numeric do Postgres que chega como texto', () => {
    const parsed = spendGuardSchema.parse({ ...guard(), spent_today_usd: '0.1339', daily_cost_cap_usd: '25.00' })
    expect(parsed.spent_today_usd).toBe(0.1339)
    expect(parsed.daily_cost_cap_usd).toBe(25)
  })

  it('consumo da pessoa não traz custo', () => {
    const usage = usageSchema.parse({
      plan_slug: 'gratis',
      daily_limit: 100,
      monthly_limit: null,
      used_today: 10,
      used_month: 10,
      day_resets_at: '2026-11-07T03:00:00Z',
      month_resets_at: '2026-12-01T03:00:00Z',
      paused: false,
      provider_cost_usd: 1,
    })
    expect(usage).not.toHaveProperty('provider_cost_usd')
    expect(usage.monthly_limit).toBeNull()
  })
})
