import clsx from 'clsx'
import { METRIC_LABELS, type MetricSummary } from '@/domain/analytics'

const integer = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

function formatValue(summary: MetricSummary, value: number): string {
  if (summary.metric === 'engagement_rate' || summary.metric === 'retention_rate' || summary.metric === 'ctr') return `${decimal.format(value)}%`
  if (summary.metric === 'watch_time_seconds') {
    const hours = Math.floor(value / 3600)
    const minutes = Math.round((value % 3600) / 60)
    return hours > 0 ? `${integer.format(hours)} h ${minutes} min` : `${minutes} min`
  }
  return integer.format(value)
}

const LABELS: Record<MetricSummary['metric'], string> = { ...METRIC_LABELS, engagement_rate: 'Engajamento' }

/** Como cada número foi obtido, para ninguém ler soma como conta única. */
const NOTES: Partial<Record<MetricSummary['metric'], string>> = {
  reach: 'Soma dos dias: a mesma pessoa pode contar mais de uma vez.',
  engagement_rate: 'Calculado: curtidas, comentários, compartilhamentos e salvamentos sobre o alcance.',
  followers: 'Último dia com dado no período.',
  retention_rate: 'Média das linhas com retenção.',
  ctr: 'Média das linhas com CTR.',
}

/** Indicadores do período. Métrica sem dado aparece como "Sem dado", nunca como zero. */
export function MetricGrid({ summaries }: { readonly summaries: readonly MetricSummary[] }) {
  return (
    <ul className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-4">
      {summaries.map((summary) => {
        const hasValue = summary.value !== null
        return (
          <li key={summary.metric} className={clsx('rounded-2xl p-4 ring-1', hasValue ? 'bg-surface ring-white/[0.06]' : 'bg-transparent ring-white/[0.04]')}>
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{LABELS[summary.metric]}</p>
            <p className={clsx('mt-2 font-headline tabular-nums', hasValue ? 'text-2xl text-zinc-50' : 'text-base text-zinc-600')}>
              {summary.value === null ? 'Sem dado' : formatValue(summary, summary.value)}
            </p>
            {summary.change !== null ? (
              <p className={clsx('mt-1 text-xs font-semibold tabular-nums', summary.change >= 0 ? 'text-emerald-300' : 'text-red-300')}>
                {summary.change >= 0 ? '+' : ''}
                {decimal.format(summary.change)}% <span className="font-normal text-zinc-500">vs. período anterior</span>
              </p>
            ) : (
              hasValue && <p className="mt-1 text-xs text-zinc-500">Sem período anterior para comparar</p>
            )}
            {hasValue && NOTES[summary.metric] && <p className="mt-2 text-[11px] leading-snug text-zinc-500">{NOTES[summary.metric]}</p>}
          </li>
        )
      })}
    </ul>
  )
}
