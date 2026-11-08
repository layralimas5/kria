import { describe, expect, it } from 'vitest'
import {
  creditsInV2,
  FULL_USE,
  generationsPerModel,
  maxCreditsForTarget,
  minPriceForTarget,
  planComparison,
  unitEconomics,
  type CostAssumptions,
  type Economics,
  type EconomicsPlan,
} from './planEconomics'

// Premissas iniciais da 0019: Asaas 3,5%, tributos 6%, R$ 0,01 por crédito, meta de 60%.
const COSTS: CostAssumptions = {
  paymentFeeRate: 0.035,
  paymentFeeFixedCents: 0,
  taxRate: 0.06,
  creditBudgetBrl: 0.01,
  safetyFactor: 1.15,
  renderCentsPerExport: 0,
  storageCents: 0,
  transferCents: 0,
  otherVariableCents: 0,
  targetMargin: 0.6,
}

const plan = (slug: string, status: EconomicsPlan['status'], price: number, credits: number, exports: number | null = 150): EconomicsPlan => ({
  slug,
  name: slug,
  line: 'creator',
  status,
  public: status === 'live',
  contact_only: false,
  price_cents: price,
  monthly_credits: credits,
  max_exports_month: exports,
  ai_budget_cents: null,
  full_use_margin: null,
})

const ECONOMICS: Economics = {
  settings: {
    usd_brl: 5.6,
    payment_fee_rate: 0.035,
    credit_budget_brl: 0.01,
    safety_factor: 1.15,
    legacy_cost_per_credit_brl: 0.09,
    credit_scale: 1,
    welcome_credits: 20,
    next_welcome_credits: 100,
  },
  finance: {
    tax_rate: 0.06,
    render_cost_cents_per_export: 0,
    min_margin_rate: 0.6,
    payment_fee_fixed_cents: 0,
    storage_cents_per_subscriber: 0,
    transfer_cents_per_subscriber: 0,
    other_variable_cents_per_subscriber: 0,
  },
  plans: [
    plan('gratis', 'live', 0, 0, 3),
    plan('starter', 'live', 5990, 300, 40),
    plan('pro', 'live', 7990, 450),
    plan('studio', 'live', 14990, 1000, 400),
    plan('creator-start', 'draft', 7990, 2500, 40),
    plan('creator-pro', 'draft', 16990, 6000),
    plan('creator-max', 'draft', 34990, 13000, 400),
  ],
  models: [
    { slug: 'foto', name: 'Nano Banana 2', kind: 'image', active: true, credits: 5, provider_cost_usd: 0.08, trusted: false, quoted_credits: 52 },
    { slug: 'video-kling', name: 'Kling 3.0', kind: 'video', active: true, credits: 40, provider_cost_usd: 0.63, trusted: false, quoted_credits: 406 },
    { slug: 'video-veo', name: 'Veo 3.1', kind: 'video', active: true, credits: 200, provider_cost_usd: 3.2, trusted: false, quoted_credits: 2061 },
    { slug: 'copy', name: 'Copy', kind: 'text', active: true, credits: 3, provider_cost_usd: null, trusted: false, quoted_credits: null },
  ],
}

describe('unitEconomics', () => {
  it('bate com plan_full_use_margin do banco no uso integral', () => {
    expect(unitEconomics({ priceCents: 7990, monthlyCredits: 2500, exportsPerMonth: 40 }, COSTS).margin).toBe(0.5921)
    expect(unitEconomics({ priceCents: 16990, monthlyCredits: 6000, exportsPerMonth: 150 }, COSTS).margin).toBe(0.5519)
    expect(unitEconomics({ priceCents: 34990, monthlyCredits: 13000, exportsPerMonth: 400 }, COSTS).margin).toBe(0.5335)
    expect(unitEconomics({ priceCents: 16990, monthlyCredits: 5100, exportsPerMonth: 150 }, COSTS).margin).toBe(0.6048)
  })

  it('separa gateway, tributo, IA, reserva e o que sobra', () => {
    const pro = unitEconomics({ priceCents: 16990, monthlyCredits: 6000, exportsPerMonth: 150 }, COSTS)
    expect(pro.gatewayCents).toBeCloseTo(594.65)
    expect(pro.taxesCents).toBeCloseTo(1019.4)
    expect(pro.aiMaxCents).toBe(6000)
    expect(pro.safetyReserveCents).toBeCloseTo(782.61, 1)
    expect(pro.contributionCents).toBeCloseTo(9375.95)
    expect(pro.meetsTarget).toBe(false)
  })

  it('uso parcial reduz só o que é consumido; plano grátis não tem margem', () => {
    const partial = unitEconomics({ priceCents: 16990, monthlyCredits: 6000, exportsPerMonth: 150 }, { ...COSTS, renderCentsPerExport: 2 }, { credits: 0.25, exports: 0.5 })
    expect(partial.aiCents).toBe(1500)
    expect(partial.exportsCents).toBe(150)
    expect(unitEconomics({ priceCents: 0, monthlyCredits: 100, exportsPerMonth: 3 }, COSTS).margin).toBeNull()
  })

  it('custos por assinante e taxa fixa entram no variável', () => {
    const withExtras = unitEconomics(
      { priceCents: 10000, monthlyCredits: 0, exportsPerMonth: 0 },
      { ...COSTS, paymentFeeFixedCents: 49, storageCents: 30, transferCents: 20, otherVariableCents: 1 },
      FULL_USE,
    )
    expect(withExtras.variableCents).toBeCloseTo(350 + 49 + 600 + 51)
  })
})

describe('recomendação pela meta', () => {
  it('créditos máximos ao preço proposto', () => {
    expect(maxCreditsForTarget({ priceCents: 7990, monthlyCredits: 2500, exportsPerMonth: 40 }, COSTS)).toBe(2436)
    expect(maxCreditsForTarget({ priceCents: 16990, monthlyCredits: 6000, exportsPerMonth: 150 }, COSTS)).toBe(5181)
    expect(maxCreditsForTarget({ priceCents: 34990, monthlyCredits: 13000, exportsPerMonth: 400 }, COSTS)).toBe(10671)
  })

  it('preço mínimo para os créditos propostos, ou nulo quando a meta não fecha', () => {
    expect(minPriceForTarget({ priceCents: 16990, monthlyCredits: 6000, exportsPerMonth: 150 }, COSTS)).toBe(19673)
    expect(minPriceForTarget({ priceCents: 7990, monthlyCredits: 2500, exportsPerMonth: 40 }, COSTS)).toBe(8197)
    expect(minPriceForTarget({ priceCents: 1, monthlyCredits: 1, exportsPerMonth: 0 }, { ...COSTS, targetMargin: 0.95 })).toBeNull()
  })
})

describe('generationsPerModel', () => {
  it('conta só modelo com cotação', () => {
    expect(generationsPerModel(6000, ECONOMICS.models).map((item) => [item.slug, item.count])).toEqual([
      ['foto', 115],
      ['video-kling', 14],
      ['video-veo', 2],
    ])
  })
})

describe('planComparison', () => {
  it('converte o plano atual para a régua v2 e recomenda pelo preço da proposta', () => {
    expect(creditsInV2(ECONOMICS.plans[1]!, ECONOMICS)).toBe(3105)
    const rows = planComparison(ECONOMICS)
    expect(rows.map((row) => row.tier)).toEqual(['Start', 'Pro', 'Max'])
    const [start, pro] = rows
    expect(start!.current).toMatchObject({ planName: 'starter', credits: 3105, margin: 0.3866 })
    expect(start!.proposal).toMatchObject({ credits: 2500, margin: 0.5921, meetsTarget: false })
    expect(start!.recommended).toMatchObject({ priceCents: 7990, credits: 2436, meetsTarget: true })
    expect(pro!.recommended.credits).toBe(5181)
  })
})
