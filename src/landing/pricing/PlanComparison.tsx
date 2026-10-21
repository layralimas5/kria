import clsx from 'clsx'
import { Check, Minus } from 'lucide-react'
import { formatBRL } from '@/domain/format'
import { COMPARISON_ROWS, type MarketingPlan } from './catalog'
import { isFreePlan } from './freePlan'

function Cell({ value }: { readonly value: string | undefined }) {
  if (value === undefined || value === 'no') {
    return (
      <>
        <Minus className="mx-auto size-4 text-zinc-600" aria-hidden="true" />
        <span className="sr-only">Não incluído</span>
      </>
    )
  }
  if (value === 'yes') {
    return (
      <>
        <Check className="mx-auto size-4 text-accent-soft" aria-hidden="true" />
        <span className="sr-only">Incluído</span>
      </>
    )
  }
  if (value === 'soon') {
    return <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Em breve</span>
  }
  return <span className="text-zinc-200">{value}</span>
}

export function PlanComparison({ plans }: { readonly plans: readonly MarketingPlan[] }) {
  return (
    <section aria-labelledby="comparar-title" className="mt-16">
      <h3 id="comparar-title" className="text-center font-landing text-2xl font-bold uppercase tracking-[-0.03em] text-zinc-50 md:text-3xl">
        Compare os planos
      </h3>
      {/* Só a tabela rola na horizontal no celular; a página não. */}
      <div className="relative mt-8 overflow-x-auto rounded-2xl border border-white/[0.06]" tabIndex={0} role="region" aria-labelledby="comparar-title">
        <table className="w-full min-w-[620px] border-collapse text-sm">
          <caption className="sr-only">Recursos de cada plano do Vynkio</caption>
          <thead>
            <tr className="bg-panel">
              <th scope="col" className="sticky left-0 z-10 bg-panel px-4 py-4 text-left font-medium text-zinc-400">
                Recurso
              </th>
              {plans.map((plan) => (
                <th key={plan.slug} scope="col" className={clsx('px-4 py-4 text-center', plan.highlight && 'bg-accent/[0.07]')}>
                  <span className="block font-semibold text-zinc-50">{plan.name}</span>
                  <span className="block text-[13px] font-normal text-zinc-500">{isFreePlan(plan) ? 'Grátis' : `${formatBRL(plan.price_cents)}/mês`}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARISON_ROWS.map((row) => (
              <tr key={row.key} className="border-t border-white/[0.05]">
                <th scope="row" className="sticky left-0 z-10 bg-stage px-4 py-3 text-left font-normal text-zinc-300">
                  {row.label}
                </th>
                {plans.map((plan) => (
                  <td key={plan.slug} className={clsx('px-4 py-3 text-center', plan.highlight && 'bg-accent/[0.04]')}>
                    <Cell value={plan.comparison[row.key]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
