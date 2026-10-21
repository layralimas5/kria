import { describe, expect, it } from 'vitest'
import { isEntitled, subscriptionPlanSchema, type Subscription } from './plans'

const base: Subscription = {
  id: 's1',
  plan_slug: 'pro',
  status: 'active',
  price_cents: 7990,
  current_period_end: '2026-11-19T23:59:59Z',
  canceled_at: null,
  created_at: '2026-10-18T12:00:00Z',
}
const now = new Date('2026-10-20T00:00:00Z')

describe('isEntitled', () => {
  it('ativa dentro do período vale', () => {
    expect(isEntitled(base, now)).toBe(true)
  })

  it('cancelada vale até o fim do período pago', () => {
    expect(isEntitled({ ...base, status: 'canceled' }, now)).toBe(true)
    expect(isEntitled({ ...base, status: 'canceled' }, new Date('2026-11-20T00:00:00Z'))).toBe(false)
  })

  it('pendente nunca vale, mesmo se o navegador voltou do checkout', () => {
    expect(isEntitled({ ...base, status: 'pending', current_period_end: null }, now)).toBe(false)
  })
})

describe('subscriptionPlanSchema', () => {
  it('benefício sem "soon" conta como disponível', () => {
    const plan = subscriptionPlanSchema.parse({
      slug: 'pro', name: 'Vynkio Pro', tagline: '', price_cents: 7990, monthly_credits: 700, max_personas: 5,
      cta_label: 'Quero ser Pro', badge: 'Mais popular', highlight: true, position: 20,
      features: [{ label: '700 créditos' }, { label: 'Motion Control', soon: true }],
      comparison: { credits: '700 por mês' },
    })
    expect(plan.features).toEqual([{ label: '700 créditos', soon: false }, { label: 'Motion Control', soon: true }])
  })
})
