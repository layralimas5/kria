import clsx from 'clsx'
import { Check, Minus } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { formatBRL } from '@/domain/format'
import { canUseModel, distinctByName, isFreePlan, PLAN_TOOL_INFO, PLAN_TOOLS, WELCOME_CREDITS } from '@/domain/plans'
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
      <Check className="mx-auto size-4 text-accent-soft" aria-hidden="true" />
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

function buildRows(models: readonly Model[]): Row[] {
  return [
    { label: 'Preço por mês', cell: (plan) => (isFreePlan(plan) ? 'Grátis' : formatBRL(plan.price_cents)) },
    {
      label: 'Créditos por mês',
      cell: (plan) => (isFreePlan(plan) ? `${WELCOME_CREDITS} de boas-vindas` : plan.monthly_credits.toLocaleString('pt-BR')),
    },
    { label: 'Personagens salvos', cell: (plan) => (plan.max_personas === 1 ? '1' : `Até ${plan.max_personas}`) },
    { label: 'Gerações ao mesmo tempo', cell: (plan) => plan.max_concurrent },
    ...distinctByName(models).map((model) => ({
      label: model.name,
      cell: (plan: Plan) => (canUseModel(model.allowed_plans, plan.slug) ? <Included /> : <NotIncluded />),
    })),
    // Ferramenta que ainda não existe não entra na comparação.
    ...PLAN_TOOLS.filter((tool) => PLAN_TOOL_INFO[tool].ready).map((tool) => ({
      label: PLAN_TOOL_INFO[tool].label,
      cell: (plan: Plan) => (plan.tools.includes(tool) ? <Included /> : <NotIncluded />),
    })),
  ]
}

/** Celular: um plano por vez, sem tabela correndo para o lado. Começa no plano da pessoa. */
function PlanPicker({ plans, rows, currentSlug }: { readonly plans: readonly Plan[]; readonly rows: readonly Row[]; readonly currentSlug: string | null }) {
  const [selected, setSelected] = useState(() => plans.find((plan) => plan.slug === currentSlug)?.slug ?? plans[0]?.slug ?? '')
  const plan = plans.find((item) => item.slug === selected) ?? plans[0]
  if (!plan) return null
  return (
    <div className="rounded-3xl bg-surface p-3 ring-1 ring-white/[0.06] md:hidden">
      <div role="radiogroup" aria-label="Plano para ver" className="grid gap-1 rounded-xl bg-surface-2 p-1" style={{ gridTemplateColumns: `repeat(${plans.length}, minmax(0, 1fr))` }}>
        {plans.map((item) => {
          const active = item.slug === plan.slug
          return (
            <button
              key={item.slug}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setSelected(item.slug)}
              className={clsx(
                'min-h-10 truncate rounded-lg px-1 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                active ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-400 hover:text-zinc-100',
              )}
            >
              {item.name}
            </button>
          )
        })}
      </div>
      {plan.slug === currentSlug && <p className="px-2 pt-3 text-xs font-bold uppercase tracking-wide text-accent-soft">Seu plano</p>}
      <dl className="mt-1 divide-y divide-white/[0.05]">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 px-2 py-2.5 text-sm">
            <dt className="text-zinc-300">{row.label}</dt>
            <dd className="shrink-0 text-right tabular-nums text-zinc-100 [&_svg]:mx-0">{row.cell(plan)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** Tabela do que cada plano libera, montada do banco: o mesmo dado que trava o app. */
export function PlanComparison({ plans, models, currentSlug }: PlanComparisonProps) {
  const rows = buildRows(models)
  return (
    <section aria-labelledby="comparison-title" className="space-y-4">
      <h2 id="comparison-title" className="font-headline text-lg text-zinc-100">
        Compare os planos
      </h2>
      <PlanPicker plans={plans} rows={rows} currentSlug={currentSlug} />
      <div className="relative hidden overflow-x-auto rounded-3xl bg-surface ring-1 ring-white/[0.06] md:block">
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
                  className={clsx('px-4 py-3 text-center font-headline text-base', plan.slug === currentSlug ? 'bg-accent/[0.08] text-accent-soft' : 'text-zinc-100')}
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
