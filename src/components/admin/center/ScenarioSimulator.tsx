import clsx from 'clsx'
import { useMemo, useState } from 'react'
import { costPerCredit, simulateScenarios, type CenterData } from '@/domain/commandCenter'
import { formatBRL } from '@/domain/format'
import { TextField } from '../../ui/Field'
import { moneyInput, parseDecimal, parseMoneyCents, parsePercent, percentInput } from '../finance/inputs'
import { pct } from './format'

interface Draft {
  readonly mix: Readonly<Record<string, string>>
  readonly utilization: string
  readonly costPerCredit: string
  readonly feeRate: string
  readonly fixed: string
}

// Premissas de partida quando a base ainda não mede: metade dos créditos usados.
const DEFAULT_UTILIZATION = 0.5

function startingDraft(data: CenterData): Draft {
  const paid = data.center.plans.filter((plan) => plan.price_cents > 0)
  const subscribers = new Map((data.dashboard.finance?.by_plan ?? []).map((plan) => [plan.slug, plan.subscribers]))
  const total = paid.reduce((sum, plan) => sum + (subscribers.get(plan.slug) ?? 0), 0)
  const mix = Object.fromEntries(
    paid.map((plan) => [plan.slug, percentInput(total > 0 ? (subscribers.get(plan.slug) ?? 0) / total : 1 / Math.max(paid.length, 1))]),
  )
  return {
    mix,
    utilization: percentInput(DEFAULT_UTILIZATION),
    costPerCredit: (costPerCredit(data.center) ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 4 }),
    feeRate: percentInput(data.center.settings.payment_fee_rate ?? 0),
    fixed: moneyInput(data.unit?.fixedMonthlyCents ?? 0),
  }
}

/** Cenários de 30 a 1.000 assinantes com os preços reais dos planos. Tudo aqui é simulação. */
export function ScenarioSimulator({ data }: { readonly data: CenterData }) {
  const [draft, setDraft] = useState<Draft>(() => startingDraft(data))
  const paid = useMemo(() => data.center.plans.filter((plan) => plan.price_cents > 0), [data.center.plans])
  const measuredCost = costPerCredit(data.center)

  const parsed = useMemo(() => {
    const mix = Object.fromEntries(paid.map((plan) => [plan.slug, parsePercent(draft.mix[plan.slug] ?? '0')]))
    const assumptions = {
      mix,
      utilization: parsePercent(draft.utilization),
      costPerCreditBrl: parseDecimal(draft.costPerCredit),
      feeRate: parsePercent(draft.feeRate),
      fixedMonthlyCents: parseMoneyCents(draft.fixed),
    }
    const valid =
      Object.values(mix).every((share) => Number.isFinite(share) && share >= 0) &&
      Object.values(mix).some((share) => share > 0) &&
      Number.isFinite(assumptions.utilization) && assumptions.utilization >= 0 && assumptions.utilization <= 1 &&
      Number.isFinite(assumptions.costPerCreditBrl) && assumptions.costPerCreditBrl >= 0 &&
      Number.isFinite(assumptions.feeRate) && assumptions.feeRate >= 0 && assumptions.feeRate < 1 &&
      Number.isFinite(assumptions.fixedMonthlyCents)
    return valid ? simulateScenarios(paid, assumptions) : null
  }, [draft, paid])

  if (paid.length === 0) {
    return <p className="text-sm text-zinc-500">Cadastre um plano pago para simular cenários.</p>
  }

  return (
    <section aria-labelledby="scenario-title" className="space-y-4 rounded-2xl bg-surface p-4 ring-1 ring-white/[0.06]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id="scenario-title" className="text-sm font-bold text-zinc-200">
            Simulação de cenários (mensal)
          </h3>
          <p className="mt-0.5 text-xs text-zinc-500">Preços reais dos planos. Mix, uso e custos são premissas editáveis: isto é simulação, não previsão.</p>
        </div>
        <span className="rounded-md bg-hot/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-hot">Simulação</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {paid.map((plan) => (
          <TextField
            key={plan.slug}
            label={`Mix ${plan.name} (%)`}
            hint={`${formatBRL(plan.price_cents)} · ${plan.monthly_credits.toLocaleString('pt-BR')} créditos`}
            inputMode="decimal"
            value={draft.mix[plan.slug] ?? ''}
            onChange={(event) => setDraft({ ...draft, mix: { ...draft.mix, [plan.slug]: event.target.value } })}
          />
        ))}
        <TextField
          label="Uso dos créditos (%)"
          hint="Parcela dos créditos do plano usada no mês"
          inputMode="decimal"
          value={draft.utilization}
          onChange={(event) => setDraft({ ...draft, utilization: event.target.value })}
        />
        <TextField
          label="Custo de IA por crédito (R$)"
          hint={measuredCost === null ? 'Sem consumo medido no período' : `Medido no período: R$ ${measuredCost.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}`}
          inputMode="decimal"
          value={draft.costPerCredit}
          onChange={(event) => setDraft({ ...draft, costPerCredit: event.target.value })}
        />
        <TextField
          label="Taxa de pagamento (%)"
          inputMode="decimal"
          value={draft.feeRate}
          onChange={(event) => setDraft({ ...draft, feeRate: event.target.value })}
        />
        <TextField
          label="Custos fixos por mês (R$)"
          hint="Média das despesas registradas em 90 dias"
          inputMode="decimal"
          value={draft.fixed}
          onChange={(event) => setDraft({ ...draft, fixed: event.target.value })}
        />
      </div>

      {parsed === null ? (
        <p role="alert" className="text-sm text-red-300">
          Confira as premissas: porcentagens entre 0 e 100, pelo menos um plano no mix e valores sem letras.
        </p>
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">Resultado mensal por número de assinantes</caption>
            <thead className="text-[11px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th scope="col" className="py-2 pr-3 font-bold">Assinantes</th>
                <th scope="col" className="py-2 pr-3 text-right font-bold">Receita</th>
                <th scope="col" className="py-2 pr-3 text-right font-bold">Taxas</th>
                <th scope="col" className="py-2 pr-3 text-right font-bold">Custo de IA</th>
                <th scope="col" className="py-2 pr-3 text-right font-bold">Custos fixos</th>
                <th scope="col" className="py-2 pr-3 text-right font-bold">Lucro</th>
                <th scope="col" className="py-2 text-right font-bold">Margem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05] tabular-nums">
              {parsed.map((row) => (
                <tr key={row.subscribers}>
                  <th scope="row" className="py-2 pr-3 font-semibold text-zinc-100">{row.subscribers.toLocaleString('pt-BR')}</th>
                  <td className="py-2 pr-3 text-right text-zinc-200">{formatBRL(row.revenueCents)}</td>
                  <td className="py-2 pr-3 text-right text-zinc-400">{formatBRL(row.feesCents)}</td>
                  <td className="py-2 pr-3 text-right text-zinc-400">{formatBRL(row.aiCostCents)}</td>
                  <td className="py-2 pr-3 text-right text-zinc-400">{formatBRL(row.fixedCents)}</td>
                  <td className={clsx('py-2 pr-3 text-right font-semibold', row.profitCents < 0 ? 'text-red-300' : 'text-emerald-300')}>{formatBRL(row.profitCents)}</td>
                  <td className={clsx('py-2 text-right', row.margin !== null && row.margin < 0 ? 'text-red-300' : 'text-zinc-300')}>{pct(row.margin) ?? '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
