import clsx from 'clsx'
import { Check, Minus } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatBRL } from '@/domain/format'
import { canUseModel, isFreePlan, PLAN_TOOL_INFO, PLAN_TOOLS, WELCOME_CREDITS } from '@/domain/plans'
import type { Model, Plan } from '@/domain/types'

interface PlanComparisonProps {
  readonly plans: readonly Plan[]
  readonly models: readonly Model[]
  /** Plano em vigor: a coluna dele fica destacada. */
  readonly currentSlug: string | null
}

interface Row {
  readonly label: string
  readonly cell: (plan: Plan) => ReactNode
}

function Included() {
  return (
    <>
      <Check className="mx-auto size-4 text-accent" aria-hidden="true" />
      <span className="sr-only">Incluso</span>
    </>
  )
}

function NotIncluded() {
  return (
    <>
      <Minus className="mx-auto size-4 text-zinc-600" aria-hidden="true" />
      <span className="sr-only">Não incluso</span>
    </>
  )
}

function Soon() {
  return <span className="text-xs font-semibold text-zinc-400">Em breve</span>
}

function buildRows(models: readonly Model[]): Row[] {
  return [
    { label: 'Preço por mês', cell: (plan) => (isFreePlan(plan) ? 'Grátis' : formatBRL(plan.price_cents)) },
    {
      label: 'Créditos por mês',
      cell: (plan) => (isFreePlan(plan) ? `${WELCOME_CREDITS} de boas-vindas` : plan.monthly_credits.toLocaleString('pt-BR')),
    },
    { label: 'Personagens salvos', cell: (plan) => (plan.max_personas === 1 ? '1' : `Até ${plan.max_personas}`) },
    { label: 'Gerações ao mesmo tempo', cell: (plan) => plan.max_concurrent },
    ...models.map((model) => ({
      label: model.name,
      cell: (plan: Plan) => (canUseModel(model.allowed_plans, plan.slug) ? <Included /> : <NotIncluded />),
    })),
    ...PLAN_TOOLS.map((tool) => ({
      label: PLAN_TOOL_INFO[tool].label,
      cell: (plan: Plan) => {
        if (!plan.tools.includes(tool)) return <NotIncluded />
        return PLAN_TOOL_INFO[tool].ready ? <Included /> : <Soon />
      },
    })),
  ]
}

/** Tabela do que cada plano libera, montada do banco: o mesmo dado que trava o app. */
export function PlanComparison({ plans, models, currentSlug }: PlanComparisonProps) {
  const rows = buildRows(models)
  return (
    <section aria-labelledby="comparison-title" className="space-y-4">
      <h2 id="comparison-title" className="font-headline text-lg text-zinc-100">
        Compare os planos
      </h2>
      <div className="relative overflow-x-auto rounded-3xl bg-surface ring-1 ring-white/[0.06]">
        <table className="w-full min-w-[34rem] text-sm">
          <caption className="sr-only">O que cada plano inclui</caption>
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th scope="col" className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                Recurso
              </th>
              {plans.map((plan) => (
                <th
                  key={plan.slug}
                  scope="col"
                  className={clsx('px-4 py-3 text-center font-headline text-base', plan.slug === currentSlug ? 'bg-accent/[0.08] text-accent' : 'text-zinc-100')}
                >
                  {plan.name}
                  {plan.slug === currentSlug && <span className="block text-[10px] font-bold uppercase tracking-wide">Seu plano</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row" className="px-4 py-3 text-left font-medium text-zinc-300">
                  {row.label}
                </th>
                {plans.map((plan) => (
                  <td
                    key={plan.slug}
                    className={clsx('px-4 py-3 text-center tabular-nums text-zinc-200', plan.slug === currentSlug && 'bg-accent/[0.05]')}
                  >
                    {row.cell(plan)}
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
