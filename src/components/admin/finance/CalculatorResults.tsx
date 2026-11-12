import clsx from 'clsx'
import { formatBRL } from '@/domain/format'
import type { ModelYield, UnitEconomics } from '@/domain/planEconomics'
import { formatNumber, formatPercent, formatPoints } from './format'

const CARD = 'card-premium rounded-3xl p-5'

interface ResultsProps {
  readonly expected: UnitEconomics
  readonly full: UnitEconomics
  readonly usage: number
  readonly target: number
}

const ROWS: readonly { readonly label: string; readonly value: (result: UnitEconomics) => number; readonly strong?: true }[] = [
  { label: 'Receita por assinante', value: (result) => result.revenueCents },
  { label: 'Orçamento máximo de IA', value: (result) => result.aiMaxCents },
  { label: 'Custo de IA', value: (result) => result.aiCents },
  { label: 'Gateway e tributos', value: (result) => result.gatewayCents + result.taxesCents },
  { label: 'Exportações, armazenamento e outros', value: (result) => result.exportsCents + result.perSubscriberCents },
  { label: 'Custo variável total', value: (result) => result.variableCents, strong: true },
  { label: 'Valor restante após custos variáveis', value: (result) => result.contributionCents, strong: true },
  { label: 'Reserva de segurança (dentro do custo de IA)', value: (result) => result.safetyReserveCents },
]

/** Uso esperado × uso integral, linha a linha. A margem é de contribuição, não lucro. */
export function ResultsTable({ expected, full, usage, target }: ResultsProps) {
  const cell = (cents: number, strong?: true) => (
    <td className={clsx('px-2 py-2 sm:px-3 text-right tabular-nums', strong ? 'font-semibold text-zinc-50' : 'text-zinc-200', cents < 0 && 'text-red-300')}>{formatBRL(Math.round(cents))}</td>
  )
  const marginCell = (result: UnitEconomics) => (
    <td className={clsx('px-2 py-2 sm:px-3 text-right font-semibold tabular-nums', result.meetsTarget ? 'text-accent-soft' : 'text-red-300')}>{formatPercent(result.margin)}</td>
  )
  return (
    <section aria-labelledby="calc-results" className={CARD}>
      <h3 id="calc-results" className="text-sm font-bold text-zinc-200">
        Resultado por assinante no mês
      </h3>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-[13px] sm:text-sm">
          <caption className="sr-only">Resultado por assinante com uso esperado e com uso integral</caption>
          <thead>
            <tr className="text-xs text-zinc-500">
              <th scope="col" className="px-2 py-2 sm:px-3 text-left font-semibold">
                Item
              </th>
              <th scope="col" className="px-2 py-2 sm:px-3 text-right font-semibold">
                Uso esperado ({formatPercent(usage)})
              </th>
              <th scope="col" className="px-2 py-2 sm:px-3 text-right font-semibold">
                Uso integral
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {ROWS.map((row) => (
              <tr key={row.label}>
                <th scope="row" className="px-2 py-2 sm:px-3 text-left font-normal text-zinc-400">
                  {row.label}
                </th>
                {cell(row.value(expected), row.strong)}
                {cell(row.value(full), row.strong)}
              </tr>
            ))}
            <tr>
              <th scope="row" className="px-2 py-2 sm:px-3 text-left font-semibold text-zinc-200">
                Margem de contribuição
              </th>
              {marginCell(expected)}
              {marginCell(full)}
            </tr>
            <tr>
              <th scope="row" className="px-2 py-2 sm:px-3 text-left font-normal text-zinc-400">
                Folga sobre a meta de {formatPercent(target)}
              </th>
              <td className="px-2 py-2 sm:px-3 text-right tabular-nums text-zinc-200">{expected.margin === null ? '–' : formatPoints(expected.margin - target)}</td>
              <td className="px-2 py-2 sm:px-3 text-right tabular-nums text-zinc-200">{full.margin === null ? '–' : formatPoints(full.margin - target)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        No uso integral todo crédito vira custo pelo orçamento (a reserva de segurança conta como gasta) e toda exportação é usada. Margem de contribuição ainda paga custos fixos,
        aquisição e pró-labore: não é lucro.
      </p>
    </section>
  )
}

interface RecommendationProps {
  readonly fullMeetsTarget: boolean
  readonly maxCredits: number
  readonly minPriceCents: number | null
  readonly credits: number
  readonly priceCents: number
}

export function Recommendation({ fullMeetsTarget, maxCredits, minPriceCents, credits, priceCents }: RecommendationProps) {
  return (
    <section aria-labelledby="calc-reco" className={clsx(CARD, !fullMeetsTarget && 'ring-red-500/30')}>
      <h3 id="calc-reco" className="text-sm font-bold text-zinc-200">
        Recomendação para bater a meta
      </h3>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-zinc-500">Créditos máximos a {formatBRL(priceCents)}</dt>
          <dd className={clsx('text-2xl font-semibold tabular-nums', credits > maxCredits ? 'text-red-300' : 'text-zinc-50')}>{formatNumber(maxCredits)}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Preço mínimo para {formatNumber(credits)} créditos</dt>
          <dd className={clsx('text-2xl font-semibold tabular-nums', minPriceCents !== null && priceCents < minPriceCents ? 'text-red-300' : 'text-zinc-50')}>
            {minPriceCents === null ? 'Meta impossível' : formatBRL(minPriceCents)}
          </dd>
        </div>
      </dl>
      {!fullMeetsTarget && (
        <p className="mt-3 text-sm text-zinc-400">
          Fora da meta. Saídas: manter o preço e reduzir créditos, manter os créditos e subir o preço, baixar o custo por modelo (trocar fornecedor ou configuração), reduzir
          exportações, ou cobrar à parte o recurso premium.
        </p>
      )}
    </section>
  )
}

interface YieldsProps {
  readonly yields: readonly ModelYield[]
  readonly saved: readonly ModelYield[]
}

/** Quantas operações de cada modelo o plano compra, e quantas a mais (ou a menos) que o salvo. */
export function YieldsTable({ yields, saved }: YieldsProps) {
  const before = new Map(saved.map((item) => [item.slug, item.count]))
  if (yields.length === 0) return <p className="text-sm text-zinc-500">Nenhum modelo com custo cadastrado para cotar.</p>
  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="Gerações por modelo">
      {yields.map((item) => {
        const delta = item.count - (before.get(item.slug) ?? item.count)
        return (
          <li key={item.slug} className="card-premium rounded-2xl p-4">
            <p className="text-[13px] font-semibold text-zinc-300">{item.name}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-50">{formatNumber(item.count)}</p>
            <p className="text-xs text-zinc-500">
              {formatNumber(item.creditsEach)} créditos cada
              {delta !== 0 && <span className={clsx('ml-1 font-semibold', delta > 0 ? 'text-accent-soft' : 'text-red-300')}>({delta > 0 ? '+' : ''}{formatNumber(delta)} contra o salvo)</span>}
            </p>
          </li>
        )
      })}
    </ul>
  )
}
