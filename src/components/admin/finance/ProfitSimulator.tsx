import clsx from 'clsx'
import { useMemo, useState } from 'react'
import { CONSUMPTION_PROFILES, simulate, type ConsumptionProfile, type FinanceSettings, type SimulatorInput, type SimulatorPlan } from '@/domain/finance'
import { formatBRL } from '@/domain/format'
import type { EconomicsPlan } from '@/domain/planEconomics'
import { TextField } from '../../ui/Field'
import { Notice } from '../../ui/Notice'
import { SelectField } from '../../ui/SelectField'
import { formatPercent } from './format'
import { moneyInput, parseDecimal, parseMoneyCents, percentInput } from './inputs'

interface PlanDraft {
  readonly name: string
  readonly price: string
  readonly subscribers: string
  readonly credits: string
  readonly exports: string
  readonly budget: string
}

// Assinantes de partida são palpite para mexer; preço, créditos e exportações vêm dos rascunhos do banco.
const STARTING_SUBSCRIBERS = ['40', '50', '10']

function draftsFrom(plans: readonly EconomicsPlan[]): PlanDraft[] {
  return plans.map((plan, index) => ({
    name: plan.name,
    price: moneyInput(plan.price_cents),
    subscribers: STARTING_SUBSCRIBERS[index] ?? '10',
    credits: String(plan.monthly_credits),
    exports: String(plan.max_exports_month ?? 0),
    budget: moneyInput(plan.ai_budget_cents ?? plan.monthly_credits),
  }))
}

const ROWS = [
  ['Receita', 'netRevenueCents'],
  ['Custos de IA', 'apiCostCents'],
  ['Renderização', 'renderCents'],
  ['Armazenamento, transferência e taxa fixa', 'otherVariableCents'],
  ['Taxas de pagamento', 'gatewayCents'],
  ['Tributos', 'taxesCents'],
  ['Margem de contribuição', 'contributionCents'],
  ['Custos fixos', 'fixedCents'],
  ['Resultado operacional', 'operatingCents'],
  ['Pró-labore', 'proLaboreCents'],
  ['Resultado após pró-labore', 'afterProLaboreCents'],
] as const

const int = (value: string) => (/^\d+$/.test(value.trim()) ? Number.parseInt(value, 10) : Number.NaN)

function toPlan(draft: PlanDraft): SimulatorPlan {
  return {
    name: draft.name,
    priceCents: parseMoneyCents(draft.price),
    subscribers: int(draft.subscribers),
    monthlyCredits: int(draft.credits),
    exportsPerMonth: int(draft.exports),
    aiBudgetCents: parseMoneyCents(draft.budget),
  }
}

const breakEvenText = (subscribers: number | null) =>
  subscribers === null ? 'sem margem' : subscribers === 0 ? 'sem custo a cobrir' : `${subscribers.toLocaleString('pt-BR')} assinantes`

const nonNegative = (value: number) => Number.isFinite(value) && value >= 0

interface SimulatorProps {
  readonly settings: FinanceSettings
  readonly paymentFeeRate: number
  readonly plans: readonly EconomicsPlan[]
}

/** Simulador de rentabilidade: 25%, 60% e 100% de uso por perfil de consumo. Roda só no navegador. */
export function ProfitSimulator({ settings, paymentFeeRate, plans: startingPlans }: SimulatorProps) {
  const [plans, setPlans] = useState<readonly PlanDraft[]>(() => draftsFrom(startingPlans))
  const [profileId, setProfileId] = useState<ConsumptionProfile['id']>('mixed')
  const [costs, setCosts] = useState({
    costPerCredit: '1,00',
    edit: moneyInput(settings.render_cost_cents_per_export),
    fee: percentInput(paymentFeeRate),
    fixedFee: moneyInput(settings.payment_fee_fixed_cents),
    tax: percentInput(settings.tax_rate),
    storageGb: '0,00',
    transferGb: '0,00',
    otherPerSubscriber: moneyInput(settings.other_variable_cents_per_subscriber),
    fixed: moneyInput(settings.fixed_costs_cents + settings.storage_costs_cents),
    infra: moneyInput(settings.infra_costs_cents),
    acquisition: '0,00',
    support: '0,00',
    proLabore: moneyInput(settings.pro_labore_cents),
  })
  const setCost = (field: keyof typeof costs, value: string) => setCosts((current) => ({ ...current, [field]: value }))
  const profile = CONSUMPTION_PROFILES.find((item) => item.id === profileId) ?? CONSUMPTION_PROFILES[0]!

  const input = useMemo<SimulatorInput | null>(() => {
    const parsedPlans = plans.map(toPlan)
    const values = {
      aiCostPerCreditCents: parseDecimal(costs.costPerCredit),
      editCostCentsPerExport: parseMoneyCents(costs.edit),
      paymentFeeRate: parseDecimal(costs.fee) / 100,
      paymentFeeFixedCents: parseMoneyCents(costs.fixedFee),
      storageCentsPerGb: parseMoneyCents(costs.storageGb),
      transferCentsPerGb: parseMoneyCents(costs.transferGb),
      otherVariableCentsPerSubscriber: parseMoneyCents(costs.otherPerSubscriber),
      acquisitionCents: parseMoneyCents(costs.acquisition),
      supportCents: parseMoneyCents(costs.support),
    }
    const simSettings: FinanceSettings = {
      ...settings,
      tax_rate: parseDecimal(costs.tax) / 100,
      fixed_costs_cents: parseMoneyCents(costs.fixed),
      infra_costs_cents: parseMoneyCents(costs.infra),
      storage_costs_cents: 0,
      pro_labore_cents: parseMoneyCents(costs.proLabore),
    }
    const planNumbers = parsedPlans.flatMap((plan) => [plan.priceCents, plan.subscribers, plan.monthlyCredits, plan.exportsPerMonth, plan.aiBudgetCents])
    const numbers = [...planNumbers, ...Object.values(values), simSettings.tax_rate, simSettings.fixed_costs_cents, simSettings.infra_costs_cents, simSettings.pro_labore_cents]
    if (!numbers.every(nonNegative)) return null
    return { plans: parsedPlans, profile, settings: simSettings, ...values }
  }, [plans, costs, settings, profile])

  const scenarios = input ? simulate(input) : null
  const setPlan = (index: number, patch: Partial<PlanDraft>) => setPlans(plans.map((plan, i) => (i === index ? { ...plan, ...patch } : plan)))
  const costField = (field: keyof typeof costs, label: string, hint?: string) => (
    <TextField label={label} hint={hint} inputMode="decimal" value={costs[field]} onChange={(event) => setCost(field, event.target.value)} />
  )

  return (
    <div className="space-y-5">
      <Notice>Simulação, não previsão. Uso médio de hoje não garante o consumo de amanhã. Assinantes, uso e custos são premissas suas até haver dados reais. Nada daqui é salvo.</Notice>

      <section aria-labelledby="sim-plans" className="space-y-3 rounded-3xl bg-surface p-5 ring-1 ring-white/[0.06]">
        <h3 id="sim-plans" className="text-sm font-bold text-zinc-200">
          Planos (começa pela proposta em rascunho)
        </h3>
        {plans.map((plan, index) => (
          <fieldset key={plan.name} className="grid grid-cols-2 gap-3 border-t border-white/[0.05] pt-3 first-of-type:border-0 first-of-type:pt-0 sm:grid-cols-3 lg:grid-cols-5">
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
          Perfil, uso e custos
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <SelectField
            label="Perfil de consumo"
            value={profileId}
            onChange={setProfileId}
            hint={`Créditos ${formatPercent(profile.creditShare)} e exportações ${formatPercent(profile.exportShare)} do uso.`}
            options={CONSUMPTION_PROFILES.map((item) => ({ value: item.id, label: item.label }))}
          />
          {costField('costPerCredit', 'Custo de IA por crédito (centavos)', '1,00 conta a reserva como gasta; 0,87 se o custo bater a tarifa.')}
          {costField('edit', 'Custo por edição (R$)')}
          {costField('fee', 'Taxa do gateway (%)')}
          {costField('fixedFee', 'Taxa fixa por cobrança (R$)')}
          {costField('tax', 'Tributos (%)')}
          {costField('storageGb', 'Armazenamento (R$ por GB)', 'Da fatura do Supabase.')}
          {costField('transferGb', 'Transferência (R$ por GB)', 'Cada arquivo baixado uma vez.')}
          {costField('otherPerSubscriber', 'Outros variáveis por assinante (R$)')}
          {costField('infra', 'Infraestrutura/mês (R$)')}
          {costField('acquisition', 'Aquisição/mês (R$)', 'Anúncios e afiliados.')}
          {costField('support', 'Suporte/mês (R$)')}
          {costField('fixed', 'Custos fixos/mês (R$)')}
          {costField('proLabore', 'Pró-labore/mês (R$)')}
        </div>
      </section>

      {!scenarios ? (
        <Notice tone="error">Confira os números: valores sem sinal negativo e assinantes, créditos e exportações inteiros.</Notice>
      ) : (
        <div className="grid gap-3 lg:grid-cols-3">
          {scenarios.map((scenario) => (
            <section key={scenario.utilization} aria-labelledby={`sc-${scenario.utilization}`} className="rounded-3xl bg-surface p-5 ring-1 ring-white/[0.06]">
              <h3 id={`sc-${scenario.utilization}`} className="font-headline text-lg text-zinc-100">
                {scenario.label}
              </h3>
              <p className="text-xs text-zinc-500">
                {scenario.description} Créditos {formatPercent(scenario.creditUse)}, exportações {formatPercent(scenario.exportUse)}.
              </p>
              <dl className="mt-4 space-y-2 text-sm">
                {ROWS.map(([label, key]) => (
                  <div key={key} className={clsx('flex justify-between gap-3', (key === 'contributionCents' || key === 'operatingCents') && 'border-t border-white/[0.06] pt-2')}>
                    <dt className="text-zinc-400">{label}</dt>
                    <dd className={clsx('tabular-nums font-semibold', scenario.statement[key] < 0 ? 'text-red-300' : 'text-zinc-100')}>{formatBRL(scenario.statement[key])}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-3 border-t border-white/[0.06] pt-2">
                  <dt className="text-zinc-400">Margem de contribuição</dt>
                  <dd className={clsx('tabular-nums', (scenario.statement.contributionRate ?? 0) < settings.min_margin_rate ? 'text-red-300' : 'text-zinc-100')}>
                    {formatPercent(scenario.statement.contributionRate)}
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
