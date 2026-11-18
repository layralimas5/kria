import clsx from 'clsx'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, ChevronDown, Minus } from 'lucide-react'
import { useId, useState } from 'react'
import { useQuery } from '@/hooks/useQuery'
import { buildComparison, fetchPlanAccess, type Cell, type ComparisonGroup } from './comparison'
import type { StorefrontPlan } from './storefront'

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const

function CellValue({ cell }: { readonly cell: Cell }) {
  if (cell.kind === 'yes') {
    return (
      <>
        <Check className="size-4 text-accent-soft" strokeWidth={2.5} aria-hidden="true" />
        <span className="sr-only">Incluído</span>
      </>
    )
  }
  if (cell.kind === 'no') {
    return (
      <>
        <Minus className="size-4 text-zinc-600" aria-hidden="true" />
        <span className="sr-only">Não incluído</span>
      </>
    )
  }
  return <span className="text-zinc-200">{cell.value}</span>
}

function DesktopTable({ groups, columns }: { readonly groups: readonly ComparisonGroup[]; readonly columns: readonly StorefrontPlan[] }) {
  return (
    <table className="hidden w-full table-fixed border-collapse text-sm md:table">
      <caption className="sr-only">Recursos de cada plano da Vynkio</caption>
      <colgroup>
        <col className="w-[28%]" />
        {columns.map((plan) => (
          <col key={plan.slug} />
        ))}
      </colgroup>
      <thead>
        <tr>
          <td />
          {columns.map((plan) => (
            <th key={plan.slug} scope="col" className={clsx('rounded-t-2xl px-3 pb-4 pt-5 text-center', plan.highlight && 'bg-accent/[0.08]')}>
              <span className="block font-landing text-lg font-bold tracking-[-0.02em] text-zinc-50">{plan.name}</span>
              {plan.highlight && <span className="mt-1 block text-[11px] font-bold uppercase tracking-[0.1em] text-accent-soft">Recomendado</span>}
            </th>
          ))}
        </tr>
      </thead>
      {groups.map((group) => (
        <tbody key={group.title}>
          <tr>
            <th colSpan={columns.length + 1} scope="colgroup" className="px-4 pb-2 pt-7 text-left text-[12px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
              {group.title}
            </th>
          </tr>
          {group.rows.map((row) => (
            <tr key={row.label} className="border-t border-white/[0.05] transition-colors hover:bg-white/[0.02]">
              <th scope="row" className="px-4 py-3 text-left font-normal text-zinc-300">
                {row.label}
              </th>
              {row.cells.map((cell, index) => (
                <td key={columns[index]?.slug ?? index} className={clsx('px-3 py-3 text-center tabular-nums', columns[index]?.highlight && 'bg-accent/[0.05]')}>
                  <span className="inline-flex justify-center">
                    <CellValue cell={cell} />
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      ))}
    </table>
  )
}

/** No celular, um plano por vez: sem tabela larga e sem rolagem lateral. */
function MobileList({ groups, columns }: { readonly groups: readonly ComparisonGroup[]; readonly columns: readonly StorefrontPlan[] }) {
  const [selected, setSelected] = useState(() => Math.max(0, columns.findIndex((plan) => plan.highlight)))
  const plan = columns[selected]
  return (
    <div className="md:hidden">
      <div role="group" aria-label="Plano para ver os recursos" className="grid auto-cols-fr grid-flow-col gap-1 rounded-2xl bg-white/[0.03] p-1 ring-1 ring-white/[0.08]">
        {columns.map((column, index) => (
          <button
            key={column.slug}
            type="button"
            aria-pressed={index === selected}
            onClick={() => setSelected(index)}
            className={clsx(
              'min-h-11 rounded-xl text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              index === selected ? 'bg-accent text-white' : 'text-zinc-400 hover:text-zinc-100',
            )}
          >
            {column.name}
          </button>
        ))}
      </div>
      {plan &&
        groups.map((group) => (
          <section key={group.title} aria-label={`${group.title} no ${plan.name}`} className="mt-6">
            <h4 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{group.title}</h4>
            <dl className="mt-2 divide-y divide-white/[0.05]">
              {group.rows.map((row) => {
                const cell = row.cells[selected]
                return (
                  <div key={row.label} className="flex items-start justify-between gap-4 py-3 text-sm">
                    <dt className="text-zinc-400">{row.label}</dt>
                    <dd className="text-right font-medium">{cell && <CellValue cell={cell} />}</dd>
                  </div>
                )
              })}
            </dl>
          </section>
        ))}
    </div>
  )
}

function Comparison({ storefront, columns }: { readonly storefront: readonly StorefrontPlan[]; readonly columns: readonly StorefrontPlan[] }) {
  const access = useQuery(fetchPlanAccess, 'Não deu para carregar a comparação dos planos.')
  if (access.error) {
    return (
      <div className="py-8 text-center text-sm text-zinc-300">
        <p>A comparação não carregou agora.</p>
        <button
          type="button"
          onClick={() => void access.reload()}
          className="mt-2 min-h-10 rounded-lg px-4 font-semibold text-accent-soft underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Tentar de novo
        </button>
      </div>
    )
  }
  if (!access.data) {
    return <div aria-hidden="true" className="h-72 animate-pulse rounded-2xl bg-white/[0.03] motion-reduce:animate-none" />
  }
  const groups = buildComparison(storefront, access.data, columns)
  return (
    <>
      <DesktopTable groups={groups} columns={columns} />
      <MobileList groups={groups} columns={columns} />
    </>
  )
}

/** "Comparar todos os recursos": fechado por padrão; os dados só carregam ao abrir. */
export function CompareAllFeatures({ storefront, columns }: { readonly storefront: readonly StorefrontPlan[]; readonly columns: readonly StorefrontPlan[] }) {
  const [open, setOpen] = useState(false)
  const reduceMotion = useReducedMotion()
  const panelId = useId()

  return (
    <div className="mx-auto mt-10 max-w-6xl">
      <div className="flex justify-center">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
          className="group inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold text-zinc-200 ring-1 ring-white/[0.12] transition-colors hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {open ? 'Ocultar comparação' : 'Comparar todos os recursos'}
          <ChevronDown className={clsx('size-4 transition-transform duration-300', open && 'rotate-180')} aria-hidden="true" />
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            key="comparison"
            initial={reduceMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.45, ease: EASE_OUT_EXPO }}
            className="overflow-hidden"
          >
            <div className="mt-6 rounded-[1.75rem] border border-white/[0.07] bg-[#0c0b14] p-4 sm:p-6">
              <Comparison storefront={storefront} columns={columns} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
