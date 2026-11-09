import { change, KIND_LABELS, ratio, type Analytics, type ToolUsage } from '@/domain/adminAnalytics'
import { BarList } from '../charts/BarList'
import { SERIES_COLORS } from '../charts/chartColors'
import { ColumnChart } from '../charts/ColumnChart'
import { GRID, Section } from '../dashboard/DashboardSections'
import { StatTile } from '../dashboard/StatTile'
import { DataTable, type Column } from '../finance/DataTable'
import { formatNumber, formatPercent, formatUsd } from '../finance/format'

const [VIOLET, GOLD, SKY] = SERIES_COLORS

function trend(row: ToolUsage): string {
  const value = change(row.total, row.previous_total)
  if (value === null) return row.total > 0 ? 'novo' : '–'
  return `${value > 0 ? '+' : ''}${Math.round(value * 100)}%`
}

function toolColumns(showCost: boolean): Column<ToolUsage>[] {
  const columns: Column<ToolUsage>[] = [
    { key: 'name', label: 'Ferramenta', render: (row) => <span className="font-semibold text-zinc-200">{row.name}</span> },
    { key: 'kind', label: 'Tipo', render: (row) => KIND_LABELS[row.kind] ?? row.kind },
    { key: 'total', label: 'Usos', align: 'right', render: (row) => formatNumber(row.total) },
    { key: 'trend', label: 'vs. anterior', align: 'right', render: trend },
    { key: 'users', label: 'Pessoas', align: 'right', render: (row) => formatNumber(row.users) },
    { key: 'failed', label: 'Falhas', align: 'right', render: (row) => formatPercent(ratio(row.failed, row.total)) },
    { key: 'credits', label: 'Créditos', align: 'right', render: (row) => formatNumber(row.credits) },
  ]
  if (showCost) columns.push({ key: 'cost', label: 'Custo API', align: 'right', render: (row) => formatUsd(row.cost_usd) })
  return columns
}

/** Ferramentas: o que mais se usa, por quem, e como evolui no período. */
export function ToolsSection({ data, stale }: { readonly data: Analytics; readonly stale: boolean }) {
  const { tools } = data
  const showCost = tools.by_tool.some((row) => row.cost_usd !== null)
  const top = tools.by_tool[0]
  return (
    <div className="space-y-8">
      <div className={GRID}>
        <StatTile label="Usos no período" value={formatNumber(tools.total)} change={change(tools.total, tools.previous_total)} />
        <StatTile label="Mais usada" value={top?.name ?? '–'} hint={top ? `${formatNumber(top.total)} usos, ${formatNumber(top.users)} pessoas` : undefined} />
        <StatTile label="Ferramentas em uso" value={formatNumber(tools.by_tool.length)} />
        <StatTile label="Exportações do Multiplicador" value={formatNumber(tools.multiplier_exports)} />
      </div>

      <Section title="Uso por dia" description="Gerações por tipo. A tabela do gráfico traz cada dia.">
        <ColumnChart
          title="Gerações por tipo"
          integer
          stale={stale}
          format={formatNumber}
          series={[
            { key: 'image', label: 'Imagem', color: VIOLET },
            { key: 'video', label: 'Vídeo', color: GOLD },
            { key: 'text', label: 'Texto', color: SKY },
          ]}
          points={tools.series.map((day) => ({ day: day.day, values: { image: day.image, video: day.video, text: day.text } }))}
        />
      </Section>

      <Section title="Ranking de ferramentas" description="Comparado com o período anterior do mesmo tamanho.">
        <DataTable caption="Uso por ferramenta" rows={tools.by_tool} columns={toolColumns(showCost)} rowKey={(row) => row.model_slug} empty="Nenhuma geração no período." />
      </Section>

      <div className="grid gap-3 lg:grid-cols-2">
        <BarList
          title="Pessoas por ferramenta"
          color={VIOLET}
          emptyText="Sem uso no período."
          rows={[...tools.by_tool].sort((a, b) => b.users - a.users).map((row) => ({ key: row.model_slug, label: row.name, value: row.users }))}
        />
        <BarList
          title="Uso por plano (plano atual da conta)"
          color={GOLD}
          emptyText="Sem uso no período."
          rows={tools.by_plan.map((row) => ({
            key: row.plan_slug,
            label: row.plan_slug,
            value: row.total,
            detail: `${formatNumber(row.users)} pessoas · imagem ${formatNumber(row.image)} · vídeo ${formatNumber(row.video)} · texto ${formatNumber(row.text)}`,
          }))}
        />
      </div>

      {tools.by_format.length > 0 && (
        <BarList
          title="Formatos prontos mais usados"
          color={SKY}
          emptyText="Nenhum formato usado."
          rows={tools.by_format.map((row) => ({ key: row.slug, label: row.slug, value: row.total, detail: `${formatNumber(row.users)} pessoas` }))}
        />
      )}
    </div>
  )
}
