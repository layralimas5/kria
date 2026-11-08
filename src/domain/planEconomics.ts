import { z } from 'zod'

// Economia por plano (0019 `admin_plan_economics`): quanto sobra de cada assinatura depois dos custos
// variáveis, com o plano usado por inteiro. É a mesma regra de `plan_full_use_margin` no banco: todo
// crédito vira custo no orçamento interno (sem descontar a reserva de segurança) e toda exportação é usada.
// Margem de contribuição não é lucro: custos fixos, aquisição e pró-labore ainda saem depois.

const num = z.coerce.number()

export const economicsSchema = z.object({
  settings: z.object({
    usd_brl: num,
    payment_fee_rate: num,
    credit_budget_brl: num,
    safety_factor: num,
    legacy_cost_per_credit_brl: num,
    credit_scale: num,
    welcome_credits: num,
    next_welcome_credits: num,
  }),
  finance: z.object({
    tax_rate: num,
    render_cost_cents_per_export: num,
    min_margin_rate: num,
    payment_fee_fixed_cents: num,
    storage_cents_per_subscriber: num,
    transfer_cents_per_subscriber: num,
    other_variable_cents_per_subscriber: num,
  }),
  plans: z.array(
    z.object({
      slug: z.string(),
      name: z.string(),
      line: z.enum(['creator', 'business']),
      status: z.enum(['draft', 'live', 'legacy']),
      public: z.boolean(),
      contact_only: z.boolean(),
      price_cents: num,
      monthly_credits: num,
      max_exports_month: num.nullable(),
      ai_budget_cents: num.nullable(),
      full_use_margin: num.nullable(),
    }),
  ),
  models: z.array(
    z.object({
      slug: z.string(),
      name: z.string(),
      kind: z.string(),
      active: z.boolean(),
      credits: num,
      provider_cost_usd: num.nullable(),
      trusted: z.boolean(),
      quoted_credits: num.nullable(),
    }),
  ),
})
export type Economics = z.infer<typeof economicsSchema>
export type EconomicsPlan = Economics['plans'][number]
export type EconomicsModel = Economics['models'][number]

/** Custos variáveis por assinante e a régua do crédito. Tudo editável na calculadora. */
export interface CostAssumptions {
  readonly paymentFeeRate: number
  readonly paymentFeeFixedCents: number
  readonly taxRate: number
  /** Orçamento interno de um crédito, em reais (R$ 0,01 na escala v2). */
  readonly creditBudgetBrl: number
  readonly safetyFactor: number
  readonly renderCentsPerExport: number
  readonly storageCents: number
  readonly transferCents: number
  readonly otherVariableCents: number
  readonly targetMargin: number
}

export interface PlanInput {
  readonly priceCents: number
  readonly monthlyCredits: number
  readonly exportsPerMonth: number
}

/** Fração de créditos e de exportações usada no mês (1 = uso integral). */
export interface Usage {
  readonly credits: number
  readonly exports: number
}

export const FULL_USE: Usage = { credits: 1, exports: 1 }

export interface UnitEconomics {
  readonly revenueCents: number
  readonly gatewayCents: number
  readonly taxesCents: number
  /** Teto de custo de IA: todos os créditos × orçamento por crédito. */
  readonly aiMaxCents: number
  /** Custo de IA no uso informado, contando a reserva de segurança como gasta. */
  readonly aiCents: number
  /** Parte do orçamento que é reserva (câmbio, variação do fornecedor), não custo esperado. */
  readonly safetyReserveCents: number
  readonly exportsCents: number
  readonly perSubscriberCents: number
  readonly variableCents: number
  /** Valor que sobra depois dos custos variáveis. */
  readonly contributionCents: number
  readonly margin: number | null
  readonly meetsTarget: boolean
}

const perSubscriber = (costs: CostAssumptions) => costs.storageCents + costs.transferCents + costs.otherVariableCents

export function unitEconomics(plan: PlanInput, costs: CostAssumptions, usage: Usage = FULL_USE): UnitEconomics {
  const creditUse = clamp01(usage.credits)
  const exportUse = clamp01(usage.exports)
  const revenueCents = plan.priceCents
  const gatewayCents = revenueCents > 0 ? revenueCents * costs.paymentFeeRate + costs.paymentFeeFixedCents : 0
  const taxesCents = revenueCents * costs.taxRate
  const aiMaxCents = plan.monthlyCredits * costs.creditBudgetBrl * 100
  const aiCents = aiMaxCents * creditUse
  const exportsCents = plan.exportsPerMonth * exportUse * costs.renderCentsPerExport
  const perSubscriberCents = perSubscriber(costs)
  const variableCents = gatewayCents + taxesCents + aiCents + exportsCents + perSubscriberCents
  const contributionCents = revenueCents - variableCents
  const margin = revenueCents > 0 ? round4(contributionCents / revenueCents) : null
  return {
    revenueCents,
    gatewayCents,
    taxesCents,
    aiMaxCents,
    aiCents,
    safetyReserveCents: aiCents - aiCents / costs.safetyFactor,
    exportsCents,
    perSubscriberCents,
    variableCents,
    contributionCents,
    margin,
    meetsTarget: margin !== null && margin >= costs.targetMargin,
  }
}

/** Créditos máximos que ainda batem a meta no uso integral, pelo preço informado. */
export function maxCreditsForTarget(plan: PlanInput, costs: CostAssumptions): number {
  const room =
    plan.priceCents * (1 - costs.targetMargin - costs.paymentFeeRate - costs.taxRate) -
    costs.paymentFeeFixedCents -
    plan.exportsPerMonth * costs.renderCentsPerExport -
    perSubscriber(costs)
  return Math.max(0, Math.floor(room / (costs.creditBudgetBrl * 100)))
}

/** Preço mínimo (centavos) que bate a meta no uso integral com os créditos informados; nulo se a meta é impossível. */
export function minPriceForTarget(plan: PlanInput, costs: CostAssumptions): number | null {
  const share = 1 - costs.targetMargin - costs.paymentFeeRate - costs.taxRate
  if (share <= 0) return null
  const costCents =
    plan.monthlyCredits * costs.creditBudgetBrl * 100 + plan.exportsPerMonth * costs.renderCentsPerExport + perSubscriber(costs) + costs.paymentFeeFixedCents
  return Math.ceil(costCents / share)
}

export interface ModelYield {
  readonly slug: string
  readonly name: string
  readonly creditsEach: number
  readonly count: number
}

/** Quantas operações de cada modelo os créditos compram, pela cotação v2. Modelo sem custo fica de fora. */
export function generationsPerModel(credits: number, models: readonly EconomicsModel[]): ModelYield[] {
  return models
    .filter((model) => model.active && model.quoted_credits !== null && model.quoted_credits > 0)
    .map((model) => ({ slug: model.slug, name: model.name, creditsEach: model.quoted_credits ?? 0, count: Math.floor(credits / (model.quoted_credits ?? 1)) }))
}

export function assumptionsFrom(economics: Economics): CostAssumptions {
  const { settings, finance } = economics
  return {
    paymentFeeRate: settings.payment_fee_rate,
    paymentFeeFixedCents: finance.payment_fee_fixed_cents,
    taxRate: finance.tax_rate,
    creditBudgetBrl: settings.credit_budget_brl,
    safetyFactor: settings.safety_factor,
    renderCentsPerExport: finance.render_cost_cents_per_export,
    storageCents: finance.storage_cents_per_subscriber,
    transferCents: finance.transfer_cents_per_subscriber,
    otherVariableCents: finance.other_variable_cents_per_subscriber,
    targetMargin: finance.min_margin_rate,
  }
}

/** Fator da virada: um crédito da escala atual vale esse tanto de créditos v2. */
export function scaleFactorOf(economics: Economics): number {
  const { settings } = economics
  return (settings.legacy_cost_per_credit_brl * settings.safety_factor) / settings.credit_budget_brl
}

/** Créditos do plano na régua v2: plano no ar antes da virada é convertido pelo fator. */
export function creditsInV2(plan: EconomicsPlan, economics: Economics): number {
  return plan.status !== 'draft' && economics.settings.credit_scale === 1 ? Math.floor(plan.monthly_credits * scaleFactorOf(economics)) : plan.monthly_credits
}

// ------------------------------------------------------------ comparativo

export interface ComparisonColumn {
  readonly label: string
  readonly planName: string
  readonly priceCents: number
  /** Créditos na régua v2. */
  readonly credits: number
  readonly margin: number | null
  readonly meetsTarget: boolean
}

export interface ComparisonRow {
  readonly tier: string
  readonly current: ComparisonColumn | null
  readonly proposal: ComparisonColumn
  readonly recommended: ComparisonColumn
}

const TIERS = ['Start', 'Pro', 'Max'] as const

/**
 * Plano atual (à venda hoje, convertido para v2) × proposta v3 (rascunho) × recomendação do sistema
 * (mesmo preço da proposta, créditos máximos que batem a meta no uso integral).
 */
export function planComparison(economics: Economics): ComparisonRow[] {
  const costs = assumptionsFrom(economics)
  const byPrice = (a: EconomicsPlan, b: EconomicsPlan) => a.price_cents - b.price_cents
  const current = economics.plans.filter((plan) => plan.line === 'creator' && plan.status === 'live' && plan.public && plan.price_cents > 0).sort(byPrice)
  const proposals = economics.plans.filter((plan) => plan.line === 'creator' && plan.status === 'draft' && !plan.contact_only).sort(byPrice)

  const column = (label: string, planName: string, input: PlanInput): ComparisonColumn => {
    const result = unitEconomics(input, costs)
    return { label, planName, priceCents: input.priceCents, credits: input.monthlyCredits, margin: result.margin, meetsTarget: result.meetsTarget }
  }

  return proposals.map((proposal, index) => {
    const exportsPerMonth = proposal.max_exports_month ?? 0
    const proposalInput = { priceCents: proposal.price_cents, monthlyCredits: proposal.monthly_credits, exportsPerMonth }
    const live = current[index]
    return {
      tier: TIERS[index] ?? proposal.name,
      current: live
        ? column('Atual', live.name, { priceCents: live.price_cents, monthlyCredits: creditsInV2(live, economics), exportsPerMonth: live.max_exports_month ?? 0 })
        : null,
      proposal: column('Proposta v3', proposal.name, proposalInput),
      recommended: column('Recomendação', proposal.name, { ...proposalInput, monthlyCredits: maxCreditsForTarget(proposalInput, costs) }),
    }
  })
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000
}
