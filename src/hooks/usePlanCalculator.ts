import { useMemo, useState } from 'react'
import { moneyInput, parseMoneyCents, parsePercent, percentInput } from '@/components/admin/finance/inputs'
import {
  assumptionsFrom,
  creditsInV2,
  FULL_USE,
  generationsPerModel,
  maxCreditsForTarget,
  minPriceForTarget,
  unitEconomics,
  type CostAssumptions,
  type Economics,
  type EconomicsPlan,
  type PlanInput,
} from '@/domain/planEconomics'

export interface CalculatorDraft {
  readonly price: string
  readonly credits: string
  readonly exports: string
  readonly budget: string
  readonly avgCost: string
  readonly usage: string
  readonly fee: string
  readonly fixedFee: string
  readonly tax: string
  readonly render: string
  readonly storage: string
  readonly transfer: string
  readonly other: string
  readonly target: string
}

const DEFAULT_USAGE = '60'

function draftFrom(plan: EconomicsPlan, economics: Economics): CalculatorDraft {
  const costs = assumptionsFrom(economics)
  const credits = creditsInV2(plan, economics)
  return {
    price: moneyInput(plan.price_cents),
    credits: String(credits),
    exports: plan.max_exports_month === null ? '' : String(plan.max_exports_month),
    budget: moneyInput(plan.ai_budget_cents ?? Math.round(credits * costs.creditBudgetBrl * 100)),
    avgCost: '',
    usage: DEFAULT_USAGE,
    fee: percentInput(costs.paymentFeeRate),
    fixedFee: moneyInput(costs.paymentFeeFixedCents),
    tax: percentInput(costs.taxRate),
    render: moneyInput(costs.renderCentsPerExport),
    storage: moneyInput(costs.storageCents),
    transfer: moneyInput(costs.transferCents),
    other: moneyInput(costs.otherVariableCents),
    target: percentInput(costs.targetMargin),
  }
}

const integer = (value: string) => (value.trim() === '' ? 0 : /^\d+$/.test(value.trim()) ? Number.parseInt(value, 10) : Number.NaN)
const valid = (values: readonly number[]) => values.every((value) => Number.isFinite(value) && value >= 0)

/** Estado da calculadora de um plano: rascunho editável, contas e comparação com o que está salvo. */
export function usePlanCalculator(economics: Economics, plan: EconomicsPlan) {
  const [draft, setDraft] = useState<CalculatorDraft>(() => draftFrom(plan, economics))
  const setField = (field: keyof CalculatorDraft, value: string) => setDraft((current) => ({ ...current, [field]: value }))
  const reset = () => setDraft(draftFrom(plan, economics))

  const result = useMemo(() => {
    const input: PlanInput = { priceCents: parseMoneyCents(draft.price), monthlyCredits: integer(draft.credits), exportsPerMonth: integer(draft.exports) }
    const costs: CostAssumptions = {
      ...assumptionsFrom(economics),
      paymentFeeRate: parsePercent(draft.fee),
      paymentFeeFixedCents: parseMoneyCents(draft.fixedFee),
      taxRate: parsePercent(draft.tax),
      renderCentsPerExport: parseMoneyCents(draft.render),
      storageCents: parseMoneyCents(draft.storage),
      transferCents: parseMoneyCents(draft.transfer),
      otherVariableCents: parseMoneyCents(draft.other),
      targetMargin: parsePercent(draft.target),
    }
    const usage = parsePercent(draft.usage)
    const budgetCents = parseMoneyCents(draft.budget)
    const avgCostCents = draft.avgCost.trim() === '' ? null : parseMoneyCents(draft.avgCost)
    const numbers = [input.priceCents, input.monthlyCredits, input.exportsPerMonth, budgetCents, usage, costs.paymentFeeRate, costs.taxRate, costs.targetMargin]
    if (!valid(numbers) || !valid([costs.paymentFeeFixedCents, costs.renderCentsPerExport, costs.storageCents, costs.transferCents, costs.otherVariableCents])) return null
    if (usage > 1 || costs.targetMargin >= 1 || (avgCostCents !== null && !(avgCostCents > 0))) return null

    const savedInput: PlanInput = { priceCents: plan.price_cents, monthlyCredits: creditsInV2(plan, economics), exportsPerMonth: plan.max_exports_month ?? 0 }
    const full = unitEconomics(input, costs, FULL_USE)
    const saved = unitEconomics(savedInput, costs, FULL_USE)
    const expected = unitEconomics(input, costs, { credits: usage, exports: usage })
    return {
      input,
      costs,
      usage,
      budgetCents,
      expected,
      full,
      saved,
      changed: input.priceCents !== savedInput.priceCents || input.monthlyCredits !== savedInput.monthlyCredits || input.exportsPerMonth !== savedInput.exportsPerMonth,
      maxCredits: maxCreditsForTarget(input, costs),
      minPriceCents: minPriceForTarget(input, costs),
      yields: generationsPerModel(input.monthlyCredits, economics.models),
      savedYields: generationsPerModel(savedInput.monthlyCredits, economics.models),
      /** Gerações no uso esperado pelo custo médio informado (orçamento usado ÷ custo médio). */
      expectedGenerations: avgCostCents === null ? null : Math.floor(expected.aiCents / avgCostCents),
      budgetBelowCredits: budgetCents < full.aiMaxCents,
    }
  }, [draft, economics, plan])

  return { draft, setField, reset, result }
}
