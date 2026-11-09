import clsx from 'clsx'
import { ratio } from '@/domain/adminDashboard'
import { KIND_LABELS } from '@/domain/adminAnalytics'
import { providerLabel } from '@/domain/aiCosts'
import { modelCostSeries, PROVIDER_HEALTH_LABELS, providerHealth, type CenterData, type ProviderHealth } from '@/domain/commandCenter'
import { formatDateTime } from '@/domain/format'
import { FAILURE_COLOR, SERIES_COLORS } from '../charts/chartColors'
import { ColumnChart } from '../charts/ColumnChart'
import { LineChart } from '../charts/LineChart'
import { CenterSection } from './CenterLayout'
import { axisBrl, count, moneyFromBrl, pct, seconds } from './format'
import { MetricCard, MetricGrid } from './MetricCard'

const [VIOLET] = SERIES_COLORS

const HEALTH_STYLES: Readonly<Record<ProviderHealth, string>> = {
  ok: 'bg-emerald-400/10 text-emerald-300',
  degraded: 'bg-hot/10 text-hot',
  unstable: 'bg-red-500/10 text-red-300',
  idle: 'bg-white/[0.05] text-zinc-400',
}

/** Desempenho das integrações, tempo de resposta e erros, pelas próprias gerações. */
export function OperationsSection({ data }: { readonly data: CenterData }) {
  const { center, dashboard } = data
  const ops = center.operations
  const successRate = ratio(ops.succeeded, ops.succeeded + ops.failed)
  const modelNames = new Map(center.ai.by_model.map((model) => [model.model_slug, model.name ?? model.model_slug]))
  const topSlugs = [...new Set(center.ai.model_series.map((row) => row.model_slug))]

  return (
    <CenterSection id="operacional" title="Operacional" question="Se as IAs estão respondendo, em quanto tempo e quanto as falhas custaram.">
      <MetricGrid>
        <MetricCard label="Requisições de IA" value={count(ops.total)} info="Gerações pedidas no período, de qualquer resultado." to="/admin/geracoes" />
        <MetricCard label="Gerações concluídas" value={count(ops.succeeded)} info="Pedidos que terminaram com resultado entregue." />
        <MetricCard
          label="Gerações com falha"
          value={count(ops.failed)}
          tone={ops.failed > 0 && successRate !== null && successRate < 0.9 ? 'bad' : undefined}
          hint={ops.open > 0 ? `${count(ops.open)} em andamento${ops.stuck > 0 ? ` · ${count(ops.stuck)} paradas há 15 min+` : ''}` : undefined}
          info="Pedidos que falharam. O crédito volta para a pessoa; o custo, se o fornecedor cobrou, fica com o Vynkio."
          to="/admin/geracoes"
        />
        <MetricCard
          label="Taxa de sucesso"
          value={pct(successRate)}
          tone={successRate !== null && successRate < 0.9 ? 'bad' : successRate !== null ? 'good' : undefined}
          info="Concluídas ÷ (concluídas + falhas). As que ainda estão em andamento ficam de fora."
        />
        {ops.duration.map((row) => (
          <MetricCard
            key={row.kind}
            label={`Tempo médio · ${KIND_LABELS[row.kind] ?? row.kind}`}
            value={seconds(row.avg_seconds)}
            hint={`90% em até ${seconds(row.p90_seconds)} · ${count(row.samples)} amostras`}
            info="Do pedido até o resultado entregue, nas gerações concluídas do período."
          />
        ))}
        <MetricCard
          label="Custo das falhas"
          value={moneyFromBrl(ops.failed_billed_cost_brl)}
          tone={ops.failed_billed_cost_brl > 0 ? 'bad' : undefined}
          hint={`${count(ops.failed_billed)} falhas cobradas pelo fornecedor`}
          info="Custo de IA das gerações que falharam mas o fornecedor cobrou (por exemplo, texto que estourou o tempo depois de processar)."
        />
      </MetricGrid>

      <section aria-labelledby="providers-title" className="space-y-2">
        <h3 id="providers-title" className="text-sm font-bold text-zinc-200">
          Status das APIs integradas
        </h3>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {ops.providers.map((provider) => {
            const health = providerHealth(provider.total_24h, provider.failed_24h)
            return (
              <li key={provider.provider} className="rounded-2xl bg-surface p-4 ring-1 ring-white/[0.06]">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-zinc-100">{providerLabel(provider.provider)}</p>
                  <span className={clsx('rounded-md px-2 py-0.5 text-[11px] font-bold', HEALTH_STYLES[health])}>{PROVIDER_HEALTH_LABELS[health]}</span>
                </div>
                <p className="mt-2 text-xs text-zinc-400">
                  {count(provider.total_24h)} pedidos em 24 h · {count(provider.failed_24h)} falhas ({pct(ratio(provider.failed_24h, provider.total_24h)) ?? '–'})
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Último sucesso: {provider.last_success_at ? formatDateTime(provider.last_success_at) : 'nunca'}
                  {provider.last_failure_at && ` · última falha: ${formatDateTime(provider.last_failure_at)}`}
                </p>
              </li>
            )
          })}
        </ul>
        <p className="text-xs text-zinc-500">Status calculado pelas gerações das últimas 24 h (10% de falha = degradado, 30% = instável). O painel não consulta os fornecedores.</p>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <ColumnChart
          title="Gerações por dia"
          series={[
            { key: 'succeeded', label: 'Concluídas', color: VIOLET },
            { key: 'failed', label: 'Falharam', color: FAILURE_COLOR },
          ]}
          points={dashboard.series.map((day) => ({ day: day.day, values: { succeeded: day.succeeded, failed: day.failed } }))}
          format={count}
          integer
        />
        <LineChart
          title="Histórico de custo por modelo (5 mais caros)"
          series={topSlugs.map((slug, index) => ({ key: slug, label: modelNames.get(slug) ?? slug, color: SERIES_COLORS[index % SERIES_COLORS.length] ?? VIOLET, dashed: index >= SERIES_COLORS.length }))}
          points={modelCostSeries(center)}
          format={axisBrl}
        />
      </div>

      <section aria-labelledby="errors-title" className="space-y-2">
        <h3 id="errors-title" className="text-sm font-bold text-zinc-200">
          Erros recentes
        </h3>
        {ops.errors.length === 0 ? (
          <p className="rounded-2xl bg-surface px-4 py-6 text-center text-sm text-zinc-500 ring-1 ring-white/[0.06]">Nenhuma falha no período.</p>
        ) : (
          <ol className="divide-y divide-white/[0.05] rounded-2xl bg-surface ring-1 ring-white/[0.06]">
            {ops.errors.map((error) => (
              <li key={error.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
                <time dateTime={error.at} className="shrink-0 text-xs tabular-nums text-zinc-500 sm:w-32">
                  {formatDateTime(error.at)}
                </time>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-zinc-100">
                    <span className="font-semibold">{error.model_name}</span>
                    <span className="text-zinc-500"> · {providerLabel(error.provider)}</span>
                    {error.email && <span className="text-zinc-500"> · {error.email}</span>}
                  </p>
                  <p className="mt-0.5 break-words font-mono text-xs text-red-200/80">{error.error}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </CenterSection>
  )
}
