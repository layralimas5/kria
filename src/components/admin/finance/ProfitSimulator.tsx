import clsx from 'clsx'
import { useMemo, useState } from 'react'
import { simulate, type FinanceSettings, type SimulatorInput, type SimulatorPlan } from '@/domain/finance'
import { formatBRL } from '@/domain/format'
import { TextField } from '../../ui/Field'
import { Notice } from '../../ui/Notice'
import { moneyInput, parseDecimal, parseMoneyCents, parsePercent, percentInput } from './inputs'

interface PlanDraft {
  readonly name: string
  readonly price: string
  readonly subscribers: string
  readonly credits: string
  readonly exports: string
  readonly budget: string
}

// Ponto de partida: o catálogo Creator v2 (0018). Tudo editável; nada aqui é salvo nem publicado.
const STARTING_PLANS: readonly PlanDraft[] = [
  { name: 'Creator Start', price: '69,90', subscribers: '40', credits: '1000', exports: '40', budget: '10,00' },
  { name: 'Creator Pro', price: '149,90', subscribers: '50', credits: '2500', exports: '150', budget: '25,00' },
  { name: 'Creator Max', price: '299,90', subscribers: '10', credits: '6000', exports: '400', budget: '60,00' },
]

const ROWS = [
  ['Faturamento', 'netRevenueCents'],
  ['Custos variáveis', 'variableCents'],
  ['Margem de contribuição', 'contributionCents'],
  ['Custos fixos', 'fixedCents'],
  ['Resultado operacional', 'operatingCents'],
  ['Resultado após pró-labore', 'afterProLaboreCents'],
] as const

function toPlan(draft: PlanDraft): SimulatorPlan {
  return {
    name: draft.name,
    priceCents: parseMoneyCents(draft.price),
    subscribers: Number.parseInt(draft.subscribers, 10),
    monthlyCredits: Number.parseInt(draft.credits, 10),
    exportsPerMonth: Number.parseInt(draft.exports, 10),
    aiBudgetCents: parseMoneyCents(draft.budget),
  }
}

const breakEvenText = (subscribers: number | null) =>
  subscribers === null ? 'sem margem' : subscribers === 0 ? 'sem custo a cobrir' : `${subscribers.toLocaleString('pt-BR')} assinantes`

const validPlan = (plan: SimulatorPlan) =>
  [plan.priceCents, plan.subscribers, plan.monthlyCredits, plan.exportsPerMonth, plan.aiBudgetCents].every((value) => Number.isFinite(value) && value >= 0)

/** Calculadora de planos e lucro. Roda só no navegador: mexer aqui não muda nenhum plano. */
export function ProfitSimulator({ settings, paymentFeeRate }: { readonly settings: FinanceSettings; readonly paymentFeeRate: number }) {
  const [plans, setPlans] = useState<readonly PlanDraft[]>(STARTING_PLANS)
  const [usage, setUsage] = useState('50')
  const [costPerCredit, setCostPerCredit] = useState('0,87')
  const [editCost, setEditCost] = useState(moneyInput(settings.render_cost_cents_per_export))
  const [fee, setFee] = useState(percentInput(paymentFeeRate))
  const [tax, setTax] = useState(percentInput(settings.tax_rate))
  const [fixed, setFixed] = useState(moneyInput(settings.fixed_costs_cents + settings.storage_costs_cents))
  const [infra, setInfra] = useState(moneyInput(settings.infra_costs_cents))
  const [acquisition, setAcquisition] = useState('0,00')
  const [support, setSupport] = useState('0,00')
  const [proLabore, setProLabore] = useState(moneyInput(settings.pro_labore_cents))

  const input = useMemo<SimulatorInput | null>(() => {
    const parsedPlans = plans.map(toPlan)
    const values = {
      usageRate: parsePercent(usage),
      aiCostPerCreditCents: parseDecimal(costPerCredit),
      editCostCentsPerExport: parseMoneyCents(editCost),
      paymentFeeRate: parsePercent(fee),
      acquisitionCents: parseMoneyCents(acquisition),
      supportCents: parseMoneyCents(support),
    }
    const simSettings: FinanceSettings = {
      ...settings,
      tax_rate: parsePercent(tax),
      fixed_costs_cents: parseMoneyCents(fixed),
      infra_costs_cents: parseMoneyCents(infra),
      storage_costs_cents: 0,
      pro_labore_cents: parseMoneyCents(proLabore),
    }
    const numbers = [...Object.values(values), simSettings.tax_rate, simSettings.fixed_costs_cents, simSettings.infra_costs_cents, simSettings.pro_labore_cents]
    if (!parsedPlans.every(validPlan) || !numbers.every((value) => Number.isFinite(value) && value >= 0) || values.usageRate > 1) return null
    return { plans: parsedPlans, settings: simSettings, ...values }
  }, [plans, usage, costPerCredit, editCost, fee, tax, fixed, infra, acquisition, support, proLabore, settings])

  const scenarios = input ? simulate(input) : null
  const setPlan = (index: number, patch: Partial<PlanDraft>) => setPlans(plans.map((plan, i) => (i === index ? { ...plan, ...patch } : plan)))

  return (
    <div className="space-y-5">
      <Notice>Simulação, não previsão. Assinantes, uso e custos são premissas suas até haver dados reais. Nada daqui é salvo.</Notice>

      <section aria-labelledby="sim-plans" className="space-y-3 rounded-3xl bg-surface p-5 ring-1 ring-white/[0.06]">
        <h3 id="sim-plans" className="text-sm font-bold text-zinc-200">
          Planos
        </h3>
        {plans.map((plan, index) => (
          <fieldset key={plan.name} className="grid grid-cols-2 gap-3 border-t border-white/[0.05] pt-3 first-of-type:border-0 first-of-type:pt-0 sm:grid-cols-3 lg:grid-cols-6">
            <legend className="col-span-full mb-1 text-[13px] font-semibold text-zinc-300">{plan.name}</legend>
            <TextField label="Preço (R$)" inputMode="decimal" value={plan.price} onChange={(event) => setPlan(index, { price: event.target.value })} />
            <TextField label="Assinantes" inputMode="numeric" value={plan.subscribers} onChange={(event) => setPlan(index, { subscribers: event.target.value })} />
            <TextField label="Créditos/mês" inputMode="numeric" value={plan.credits} onChange={(event) => setPlan(index, { credits: event.target.value })} />
            <TextField label="Exportações/mês" inputMode="numeric" value={plan.exports} onChange={(event) => setPlan(index, { exports: event.target.value })} />
            <TextField label="Custo máx. de IA (R$)" inputMode="decimal" value={plan.budget} onChange={(event) => setPlan(index, { budget: event.target.value })} />
          </fieldset>
        ))}
      </section>

      <section aria-labelledby="sim-costs" className="space-y-3 rounded-3xl bg-surface p-5 ring-1 ring-white/[0.06]">
        <h3 id="sim-costs" className="text-sm font-bold text-zinc-200">
          Uso e custos
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <TextField label="Utilização média (%)" hint="Dos créditos e exportações." inputMode="decimal" value={usage} onChange={(event) => setUsage(event.target.value)} />
          <TextField label="Custo de IA por crédito (centavos)" hint="R$ 0,01 ÷ 1,15 ≈ 0,87." inputMode="decimal" value={costPerCredit} onChange={(event) => setCostPerCredit(event.target.value)} />
          <TextField label="Custo por edição (R$)" inputMode="decimal" value={editCost} onChange={(event) => setEditCost(event.target.value)} />
          <TextField label="Taxa do gateway (%)" inputMode="decimal" value={fee} onChange={(event) => setFee(event.target.value)} />
          <TextField label="Tributos (%)" inputMode="decimal" value={tax} onChange={(event) => setTax(event.target.value)} />
          <TextField label="Infraestrutura/mês (R$)" inputMode="decimal" value={infra} onChange={(event) => setInfra(event.target.value)} />
          <TextField label="Aquisição/mês (R$)" hint="Anúncios e afiliados." inputMode="decimal" value={acquisition} onChange={(event) => setAcquisition(event.target.value)} />
          <TextField label="Suporte/mês (R$)" inputMode="decimal" value={support} onChange={(event) => setSupport(event.target.value)} />
          <TextField label="Custos fixos/mês (R$)" inputMode="decimal" value={fixed} onChange={(event) => setFixed(event.target.value)} />
          <TextField label="Pró-labore/mês (R$)" inputMode="decimal" value={proLabore} onChange={(event) => setProLabore(event.target.value)} />
        </div>
      </section>

      {!scenarios ? (
        <Notice tone="error">Confira os números: valores sem sinal negativo e utilização até 100%.</Notice>
      ) : (
        <div className="grid gap-3 lg:grid-cols-3">
          {scenarios.map((scenario) => (
            <section key={scenario.id} aria-labelledby={`sc-${scenario.id}`} className="rounded-3xl bg-surface p-5 ring-1 ring-white/[0.06]">
              <h3 id={`sc-${scenario.id}`} className="font-headline text-lg text-zinc-100">
                {scenario.label}
              </h3>
              <p className="text-xs text-zinc-500">{scenario.description}</p>
              <dl className="mt-4 space-y-2 text-sm">
                {ROWS.map(([label, key]) => (
                  <div key={key} className="flex justify-between gap-3">
                    <dt className="text-zinc-400">{label}</dt>
                    <dd className={clsx('tabular-nums font-semibold', scenario.statement[key] < 0 ? 'text-red-300' : 'text-zinc-100')}>{formatBRL(scenario.statement[key])}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-3 border-t border-white/[0.06] pt-2">
                  <dt className="text-zinc-400">Margem</dt>
                  <dd className="tabular-nums text-zinc-100">
                    {scenario.statement.contributionRate === null ? '–' : `${Math.round(scenario.statement.contributionRate * 100)}%`}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-400">Equilíbrio (sem pró-labore)</dt>
                  <dd className="tabular-nums text-zinc-100">{breakEvenText(scenario.breakEvenSubscribers)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-400">Equilíbrio com pró-labore</dt>
                  <dd className="tabular-nums text-zinc-100">{breakEvenText(scenario.breakEvenWithProLaboreSubscribers)}</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-zinc-500">{scenario.subscribers} assinantes no cenário.</p>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
