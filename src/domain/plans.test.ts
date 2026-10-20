import { describe, expect, it } from 'vitest'
import { canUseModel, currentSubscription, planIncludes, pricePerCredit } from './plans'
import type { Subscription } from './types'

const NOW = new Date('2026-10-18T12:00:00Z').getTime()
const DAY = 24 * 60 * 60 * 1000

const subscription = (overrides: Partial<Subscription>): Subscription => ({
  id: crypto.randomUUID(),
  plan_slug: 'pro',
  status: 'active',
  price_cents: 7990,
  monthly_credits: 700,
  current_period_start: new Date(NOW - 10 * DAY).toISOString(),
  current_period_end: new Date(NOW + 20 * DAY).toISOString(),
  canceled_at: null,
  created_at: new Date(NOW - 10 * DAY).toISOString(),
  ...overrides,
})

describe('currentSubscription', () => {
  it('ativa dentro do período vale', () => {
    expect(currentSubscription([subscription({})], NOW)?.plan_slug).toBe('pro')
  })

  it('pendente e encerrada não valem', () => {
    expect(currentSubscription([subscription({ status: 'pending', current_period_end: null }), subscription({ status: 'expired' })], NOW)).toBeNull()
  })

  it('em atraso vale durante a carência de 3 dias', () => {
    expect(currentSubscription([subscription({ status: 'past_due', current_period_end: new Date(NOW - 2 * DAY).toISOString() })], NOW)).not.toBeNull()
    expect(currentSubscription([subscription({ status: 'past_due', current_period_end: new Date(NOW - 4 * DAY).toISOString() })], NOW)).toBeNull()
  })

  it('cancelada vale até o fim do período, sem carência', () => {
    expect(currentSubscription([subscription({ status: 'canceled' })], NOW)).not.toBeNull()
    expect(currentSubscription([subscription({ status: 'canceled', current_period_end: new Date(NOW - 1000).toISOString() })], NOW)).toBeNull()
  })
})

describe('pricePerCredit', () => {
  it('divide o preço pelos créditos do mês', () => {
    expect(pricePerCredit({ price_cents: 5990, monthly_credits: 300 })).toBeCloseTo(0.1997, 3)
    expect(pricePerCredit({ price_cents: 0, monthly_credits: 0 })).toBeNull()
  })
})

describe('canUseModel', () => {
  it('modelo sem restrição é de todos; restrito, só dos planos listados', () => {
    expect(canUseModel(null, 'gratis')).toBe(true)
    expect(canUseModel(['pro', 'studio'], 'gratis')).toBe(false)
    expect(canUseModel(['pro', 'studio'], 'pro')).toBe(true)
  })
})

describe('planIncludes', () => {
  it('libera só as ferramentas do plano e nada enquanto o plano não carregou', () => {
    const starter = { tools: ['copy', 'prompt_library'] }
    expect(planIncludes(starter, 'copy')).toBe(true)
    expect(planIncludes(starter, 'motion_control')).toBe(false)
    expect(planIncludes(null, 'copy')).toBe(false)
  })
})
