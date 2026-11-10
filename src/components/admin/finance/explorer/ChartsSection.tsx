import { useMemo } from 'react'
import { axisBrl, money } from '@/components/admin/center/format'
import { BarList } from '@/components/admin/charts/BarList'
import { NEUTRAL_COLOR, SERIES_COLORS } from '@/components/admin/charts/chartColors'
import { ComboChart } from '@/components/admin/charts/ComboChart'
import { DonutChart } from '@/components/admin/charts/DonutChart'
import { LineChart } from '@/components/admin/charts/LineChart'
import { categoryLabel, chartPoints, methodLabel, sourceLabel, type Explorer } from '@/domain/financeExplorer'

const brl = (value: number) => axisBrl(value)
const percent = (value: number) => `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
const CATEGORY_COLORS = [SERIES_COLORS[0], SERIES_COLORS[1], SERIES_COLORS[2], SERIES_COLORS[3], NEUTRAL_COLOR] as const

/** Evolução, composição e concentração do recorte. Todo gráfico tem os valores escritos ao lado. */
export function ChartsSection({ data, stale }: { readonly data: Explorer; readonly stale: boolean }) {
  const points = useMemo(() => chartPoints(data.series), [data.series])
  const grouping = data.period.granularity === 'month' ? 'por mês' : data.period.granularity === 'week' ? 'por semana' : 'por dia'

  // Quatro maiores categorias com cor própria; o resto vira "Demais".
  const categories = data.by_category.filter((row) => row.cents > 0)
  const slices = categories.slice(0, 4).map((row, index) => ({ key: row.category, label: categoryLabel(row.category), value: row.cents / 100, color: CATEGORY_COLORS[index] ?? NEUTRAL_COLOR }))
  const rest = categories.slice(4).reduce((sum, row) => sum + row.cents, 0)
  if (rest > 0) slices.push({ key: 'rest', label: 'Demais', value: rest / 100, color: NEUTRAL_COLOR })

  return (
    <section aria-labelledby="charts-title" className="space-y-4">
      <div>
        <h2 id="charts-title" className="font-headline text-2xl text-zinc-50">
          Evolução e composição
        </h2>
        <p className="mt-1 text-sm text-zinc-400">Quanto entra, quanto sai e de onde vem cada parte, {grouping}.</p>
      </div>

      <ComboChart
        title={`Receitas e despesas ${grouping}`}
        bars={[
          { key: 'ai', label: 'Custo de IA', color: SERIES_COLORS[2] },
          { key: 'other', label: 'Outras despesas', color: NEUTRAL_COLOR },
        ]}
        lines={[
          { key: 'revenue', label: 'Receita (após reembolsos)', color: SERIES_COLORS[0] },
          { key: 'profit', label: 'Lucro', color: SERIES_COLORS[1] },
        ]}
        points={points}
        format={brl}
        stale={stale}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <LineChart title={`Lucro ${grouping}`} series={[{ key: 'profit', label: 'Lucro', color: SERIES_COLORS[1] }]} points={points} format={brl} stale={stale} area />
        <LineChart title="Evolução da margem de lucro (acumulada no período)" series={[{ key: 'margin', label: 'Margem acumulada', color: SERIES_COLORS[3] }]} points={points} format={percent} stale={stale} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BarList
          title="Receita por plano (após reembolsos)"
          color={SERIES_COLORS[0]}
          emptyText="Nenhuma receita no recorte."
          rows={data.by_plan
            .filter((row) => row.gross_cents - row.refunds_cents > 0)
            .map((row) => ({
              key: row.slug,
              label: row.name,
              value: row.gross_cents - row.refunds_cents,
              display: money(row.gross_cents - row.refunds_cents) ?? '–',
              detail: `${row.paying_users} ${row.paying_users === 1 ? 'pagante' : 'pagantes'}`,
            }))}
        />
        <DonutChart title="Despesas por categoria" slices={slices} format={(value) => money(Math.round(value * 100)) ?? '–'} emptyText="Nenhuma despesa no recorte." centerLabel="em despesas" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BarList
          title="Custo de IA por modelo"
          color={SERIES_COLORS[2]}
          emptyText="Nenhum custo de IA no recorte."
          rows={data.ai_by_model.slice(0, 10).map((row) => ({
            key: `${row.provider}:${row.model}`,
            label: row.name,
            value: row.cents,
            display: money(row.cents) ?? '–',
            detail: `${row.provider} · ${row.events.toLocaleString('pt-BR')} gerações${row.unknown_events > 0 ? ` · ${row.unknown_events} sem custo` : ''}${row.estimated_cents > 0 ? ' · estimado' : ''}`,
          }))}
        />
        <BarList
          title="Custo de IA por provedor"
          color={SERIES_COLORS[2]}
          emptyText="Nenhum custo de IA no recorte."
          rows={data.ai_by_provider.map((row) => ({
            key: row.provider,
            label: row.provider,
            value: row.cents,
            display: money(row.cents) ?? '–',
            detail: `${row.events.toLocaleString('pt-BR')} gerações`,
          }))}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BarList
          title="Receita por origem"
          color={SERIES_COLORS[0]}
          emptyText="Nenhuma receita no recorte."
          rows={data.by_source.map((row) => ({ key: row.source, label: sourceLabel(row.source), value: row.cents, display: money(row.cents) ?? '–', detail: `${row.count} pagamentos` }))}
        />
        <BarList
          title="Receita por forma de pagamento"
          color={SERIES_COLORS[0]}
          emptyText="Nenhuma receita no recorte."
          rows={data.by_method.map((row) => ({ key: row.method, label: methodLabel(row.method), value: row.cents, display: money(row.cents) ?? '–', detail: `${row.count} pagamentos` }))}
        />
      </div>
    </section>
  )
}
