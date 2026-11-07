import { formatCredits, formatDateTime } from '@/domain/format'
import { useQuery } from '@/hooks/useQuery'
import { fetchMyUsage } from '@/lib/api'
import { Notice } from '../ui/Notice'
import { UsageMeter } from '../ui/UsageMeter'

const ALERT_RATIO = 0.8
const exportsText = (value: number) => `${value.toLocaleString('pt-BR')} ${value === 1 ? 'exportação' : 'exportações'}`

/** Consumo do dia e do mês contra o limite do plano. Estorno não conta. */
export function UsageLimits() {
  const usage = useQuery(fetchMyUsage, 'Não deu para carregar seu consumo.')
  if (usage.error) return <Notice tone="error">{usage.error}</Notice>
  if (!usage.data) return null
  const { data } = usage
  if (data.daily_limit === null && data.monthly_limit === null && data.exports_limit === null) return null

  return (
    <section aria-labelledby="usage-title" className="space-y-4 rounded-3xl bg-surface p-5 ring-1 ring-white/[0.06]">
      <div>
        <h2 id="usage-title" className="font-headline text-lg text-zinc-100">
          Limite de consumo do plano
        </h2>
        <p className="mt-1 text-sm text-zinc-400">Protege sua conta de gasto fora do normal. Geração que falha não conta.</p>
      </div>
      {data.paused && <Notice>As gerações estão pausadas por alguns instantes. Nenhum crédito é usado enquanto isso.</Notice>}
      <div className="grid gap-5 sm:grid-cols-2">
        <UsageMeter
          label="Hoje"
          used={data.used_today}
          limit={data.daily_limit}
          alertRatio={ALERT_RATIO}
          format={formatCredits}
          footnote={`Renova em ${formatDateTime(data.day_resets_at)}`}
        />
        <UsageMeter
          label="Este mês"
          used={data.used_month}
          limit={data.monthly_limit}
          alertRatio={ALERT_RATIO}
          format={formatCredits}
          footnote={`Renova em ${formatDateTime(data.month_resets_at)}`}
        />
        <UsageMeter
          label="Exportações do Multiplicador no mês"
          used={data.exports_used}
          limit={data.exports_limit}
          alertRatio={ALERT_RATIO}
          format={exportsText}
          footnote="Cada vídeo montado conta uma. Montagem que falha não conta."
        />
      </div>
    </section>
  )
}
