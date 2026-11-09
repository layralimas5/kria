import clsx from 'clsx'
import { formatBRL } from '@/domain/format'
import { planComparison, type ComparisonColumn, type Economics } from '@/domain/planEconomics'
import { Notice } from '../../ui/Notice'
import { Section } from '../dashboard/DashboardSections'
import { formatNumber, formatPercent } from './format'

const STATUS = { draft: 'rascunho', live: 'à venda', legacy: 'antigo' } as const

function Cell({ column, target }: { readonly column: ComparisonColumn | null; readonly target: number }) {
  if (!column) return <td className="px-3 py-3 text-zinc-500">–</td>
  return (
    <td className="px-3 py-3 align-top">
      <span className="block text-zinc-100">
        {formatBRL(column.priceCents)} · {formatNumber(column.credits)} créditos
      </span>
      <span className={clsx('text-xs font-semibold', column.meetsTarget ? 'text-accent-soft' : 'text-red-300')}>
        {formatPercent(column.margin)} no uso integral{column.margin !== null && column.margin < target ? ' (abaixo da meta)' : ''}
      </span>
      <span className="block text-xs text-zinc-500">{column.planName}</span>
    </td>
  )
}

/** Planos abaixo da meta em destaque e o comparativo atual × proposta v3 × recomendação calculada. */
export function PlanTargets({ economics }: { readonly economics: Economics }) {
  const target = economics.finance.min_margin_rate
  const below = economics.plans.filter((plan) => plan.line === 'creator' && plan.status !== 'legacy' && plan.full_use_margin !== null && plan.full_use_margin < target)
  const rows = planComparison(economics)
  return (
    <Section
      title="Planos contra a meta de margem"
      description={`Meta configurada: ${formatPercent(target)} de margem de contribuição com o plano usado por inteiro. Crédito na régua v2; o plano atual entra convertido pelo fator da virada.`}
    >
      {below.length > 0 && (
        <Notice tone="error">
          {below.length} {below.length === 1 ? 'plano está' : 'planos estão'} abaixo da meta:{' '}
          {below.map((plan) => `${plan.name} (${STATUS[plan.status]}, ${formatPercent(plan.full_use_margin)})`).join(', ')}.
        </Notice>
      )}
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhuma proposta em rascunho para comparar.</p>
      ) : (
        <div className="relative overflow-x-auto rounded-2xl ring-1 ring-white/[0.06]">
          <table className="w-full min-w-[40rem] text-sm">
            <caption className="sr-only">Comparativo entre o plano atual, a proposta v3 e a recomendação do sistema</caption>
            <thead className="bg-surface text-xs text-zinc-500">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-semibold">
                  Faixa
                </th>
                <th scope="col" className="px-3 py-2 text-left font-semibold">
                  Plano atual
                </th>
                <th scope="col" className="px-3 py-2 text-left font-semibold">
                  Proposta v3
                </th>
                <th scope="col" className="px-3 py-2 text-left font-semibold">
                  Recomendação (mesmo preço)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {rows.map((row) => (
                <tr key={row.tier}>
                  <th scope="row" className="px-3 py-3 text-left align-top font-semibold text-zinc-200">
                    {row.tier}
                  </th>
                  <Cell column={row.current} target={target} />
                  <Cell column={row.proposal} target={target} />
                  <Cell column={row.recommended} target={target} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}
