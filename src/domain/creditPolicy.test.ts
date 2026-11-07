import { describe, expect, it } from 'vitest'
import { operationSpecs, scaleFactor, welcomeCovers, type ModelQuote } from './creditPolicy'

const settings = {
  usd_brl: 5.6,
  safety_factor: 1.15,
  credit_budget_brl: 0.01,
  legacy_cost_per_credit_brl: 0.09,
  cost_stale_days: 30,
  credit_scale: 1,
  scale_activated_at: null,
  welcome_credits: 20,
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
