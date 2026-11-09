import { providerLabel, type AiCosts } from '@/domain/aiCosts'
import { KIND_LABELS } from '@/domain/adminAnalytics'
import { BarList } from '../charts/BarList'
import { SERIES_COLORS } from '../charts/chartColors'
import { ColumnChart } from '../charts/ColumnChart'
import { LineChart } from '../charts/LineChart'
import { formatBrlValue, formatNumber } from '../finance/format'

const RANK_LIMIT = 6

/** Os sete gráficos da aba. Cada um tem tabela de apoio (ver tabela) ou valor escrito na barra. */
export function CostCharts({ data, stale }: { readonly data: AiCosts; readonly stale: boolean }) {
  const used = [...data.models].filter((model) => model.uses_period > 0).sort((a, b) => b.uses_period - a.uses_period).slice(0, RANK_LIMIT)
  const expensive = [...data.models].filter((model) => model.cost_period_brl > 0).sort((a, b) => b.cost_period_brl - a.cost_period_brl).slice(0, RANK_LIMIT)

  return (
    <section aria-labelledby="cost-charts" className="space-y-4">
      <h2 id="cost-charts" className="font-headline text-xl text-zinc-50">
        Análises
      </h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <ColumnChart
          title="Evolução dos gastos com IA"
          series={[{ key: 'cost', label: 'Custo', color: SERIES_COLORS[0] }]}
          points={data.series.map((point) => ({ day: point.day, values: { cost: point.cost_brl } }))}
          format={formatBrlValue}
          stale={stale}
        />
        <LineChart
          title="Custo de IA × valor dos créditos consumidos"
          series={[
            { key: 'cost', label: 'Custo de IA', color: SERIES_COLORS[0] },
            { key: 'credits', label: 'Créditos em reais', color: SERIES_COLORS[1] },
          ]}
          points={data.series.map((point) => ({ key: point.day, values: { cost: point.cost_brl, credits: point.credits * data.credit_value_brl } }))}
          format={formatBrlValue}
          stale={stale}
        />
        <LineChart
          title="Tendência dos últimos 30 dias"
          series={[{ key: 'cost', label: 'Custo', color: SERIES_COLORS[2] }]}
          points={data.trend_30d.map((point) => ({ key: point.day, values: { cost: point.cost_brl } }))}
          format={formatBrlValue}
          stale={stale}
          area
        />
        <BarList
          title="Custo por provedor"
          color={SERIES_COLORS[0]}
          emptyText="Sem custo no período."
          rows={data.by_provider.map((row) => ({
            key: row.provider,
            label: providerLabel(row.provider),
            value: row.cost_brl,
            display: formatBrlValue(row.cost_brl),
            detail: `${formatNumber(row.generations)} gerações · ${formatNumber(row.credits)} créditos`,
          }))}
        />
        <BarList
          title="Modelos mais usados"
          color={SERIES_COLORS[2]}
          emptyText="Nenhuma geração no período."
          rows={used.map((model) => ({ key: model.slug, label: model.name, value: model.uses_period, display: `${formatNumber(model.uses_period)} usos` }))}
        />
        <BarList
          title="Modelos que mais custam"
          color={SERIES_COLORS[3]}
          emptyText="Sem custo no período."
          rows={expensive.map((model) => ({
            key: model.slug,
            label: model.name,
            value: model.cost_period_brl,
            display: formatBrlValue(model.cost_period_brl),
            detail: `${providerLabel(model.provider)} · ${formatNumber(model.uses_period)} usos`,
          }))}
        />
        <BarList
          title="Custo por categoria"
          color={SERIES_COLORS[1]}
          emptyText="Sem custo no período."
          rows={data.by_kind.map((row) => ({
            key: row.kind,
            label: KIND_LABELS[row.kind] ?? row.kind,
            value: row.cost_brl,
            display: formatBrlValue(row.cost_brl),
            detail: `${formatNumber(row.generations)} gerações`,
          }))}
        />
      </div>
    </section>
  )
}
