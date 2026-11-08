import { describe, expect, it } from 'vitest'
import { conversionDeviation, operationSpecs, quoteCredits, scaleFactor, tariffCostUsd, welcomeCovers, type ModelQuote } from './creditPolicy'

const settings = {
  usd_brl: 5.6,
  safety_factor: 1.15,
  credit_budget_brl: 0.01,
  legacy_cost_per_credit_brl: 0.09,
  cost_stale_days: 30,
  credit_scale: 1,
  scale_activated_at: null,
  welcome_credits: 20,
  next_welcome_credits: 100,
  require_trusted_cost: false,
  max_operation_cost_usd: 5,
  welcome_daily_cap: 300,
  price_drift_tolerance: 0.01,
}

const quote = (slug: string, quoted: number): ModelQuote => ({
  slug,
  name: slug,
  kind: 'image',
  provider: 'fal',
  endpoint: 'x',
  defaults: {},
  active: true,
  credits: 5,
  provider_cost_usd: null,
  cost_checked_at: null,
  cost_source: null,
  basis: 'legacy_estimate',
  estimated_brl: 0.45,
  protected_brl: 0.5175,
  quoted_credits: quoted,
  stale: true,
  pricing: null,
  cost_drift_at: null,
  cost_drift_note: null,
  trusted: false,
  avg_input_tokens: null,
  avg_output_tokens: null,
  max_output_tokens: null,
  reconciled: 0,
})

describe('política de crédito v2', () => {
  it('fator da virada = custo médio do crédito × segurança ÷ orçamento', () => {
    expect(scaleFactor(settings)).toBeCloseTo(10.35)
  })

  it('mostra duração, resolução e áudio do modelo', () => {
    expect(operationSpecs({ duration: '8s', resolution: '720p', generate_audio: true })).toBe('8 s · 720p · com áudio')
    expect(operationSpecs({ num_images: 1 })).toBe('')
  })

  it('diz o que as boas-vindas compram, ou nada', () => {
    const quotes = [quote('copy', 32), quote('foto', 52)]
    expect(welcomeCovers(10, quotes)).toBeNull()
    expect(welcomeCovers(60, quotes)?.slug).toBe('copy')
  })
})

describe('tarifa e cotação (0019)', () => {
  it('custo pela tarifa, igual ao banco', () => {
    expect(tariffCostUsd({ unit: 'image', usd: 0.08, resolution_multipliers: { '1K': 1, '2K': 1.5 } }, { num_images: 2, resolution: '2K' })).toBe(0.24)
    expect(tariffCostUsd({ unit: 'image', usd: 0.08 }, {})).toBe(0.08)
    expect(tariffCostUsd({ unit: 'image', usd: 0.08, resolution_multipliers: { '1K': 1 } }, { resolution: '8K' })).toBeNull()
    expect(tariffCostUsd({ unit: 'second', usd: 0.084, usd_audio: 0.126 }, { duration: '5', generate_audio: true })).toBe(0.63)
    expect(tariffCostUsd({ unit: 'second', usd: 0.2, usd_audio: 0.4 }, { duration: '8s', generate_audio: true })).toBe(3.2)
    expect(tariffCostUsd({ unit: 'second', usd: 0.2 }, { generate_audio: true, duration: '8s' })).toBeNull()
    const text = { unit: 'token', input_usd_per_mtok: 4, output_usd_per_mtok: 20, est_input_tokens: null, est_output_tokens: null } as const
    expect(tariffCostUsd(text, {})).toBeNull()
    expect(tariffCostUsd({ ...text, est_input_tokens: 4000, est_output_tokens: 3000 }, {})).toBe(0.076)
  })

  it('créditos v2 pelo custo, para cima', () => {
    const policy = { usd_brl: 5.6, safety_factor: 1.15, credit_budget_brl: 0.01 }
    expect(quoteCredits(0.08, policy)).toBe(52)
    expect(quoteCredits(0.63, policy)).toBe(406)
    expect(quoteCredits(3.2, policy)).toBe(2061)
    expect(quoteCredits(0.000001, policy)).toBe(1)
  })

  it('desvio do poder de compra na conversão', () => {
    expect(conversionDeviation(0.0896, 0.09)).toBe(0.0045)
    expect(conversionDeviation(0.0747, 0.09)).toBe(0.2048)
    expect(conversionDeviation(null, 0.09)).toBeNull()
  })
})
