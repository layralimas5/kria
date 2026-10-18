import { describe, expect, it } from 'vitest'
import { costInBrl, grossMargin, suggestedCredits, type PricingSettings } from './pricing'

const settings: PricingSettings = { usd_brl: 5.6, fx_buffer: 0.1, markup: 2.5, credit_value_brl: 0.1 }

describe('pricing', () => {
  it('converte o custo com a folga do câmbio', () => {
    expect(costInBrl(1, settings)).toBeCloseTo(6.16, 2)
  })

  it('sugere créditos que cobrem custo × markup, arredondando para cima', () => {
    // US$ 0,04 → R$ 0,2464 × 2,5 = R$ 0,616 → 6,16 créditos → 7
    expect(suggestedCredits(0.04, settings)).toBe(7)
    expect(suggestedCredits(0, settings)).toBe(1)
  })

  it('a margem do preço sugerido fica perto do markup pedido', () => {
    const credits = suggestedCredits(3.2, settings)
    expect(grossMargin(credits, 3.2, settings)).toBeGreaterThanOrEqual(0.6)
  })

  it('margem negativa quando o preço não cobre o custo', () => {
    expect(grossMargin(100, 3.2, settings)).toBeLessThan(0)
  })
})
