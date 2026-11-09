import { KIND_LABELS, ratio, type Analytics } from '@/domain/adminAnalytics'
import type { Dashboard } from '@/domain/adminDashboard'
import type { Business } from '@/domain/business'
import { formatBRL } from '@/domain/format'
import { BarList } from '../charts/BarList'
import { SERIES_COLORS } from '../charts/chartColors'
import { ColumnChart } from '../charts/ColumnChart'
import { LineChart } from '../charts/LineChart'
import { formatBrlValue, formatNumber, formatPercent } from '../finance/format'

interface ExecutiveChartsProps {
  readonly dashboard: Dashboard
  readonly business: Business
  readonly analytics: Analytics | null
  readonly stale: boolean
}

const count = (value: number) => formatNumber(Math.round(value))

/** Os oito gráficos do executivo. Uso e retenção são da base inteira (sem o filtro de plano). */
export function ExecutiveCharts({ dashboard, business, analytics, stale }: ExecutiveChartsProps) {
  const activeByDay = new Map((analytics?.tools.series ?? []).map((point) => [point.day, point.users]))
  const money = business.money

  return (
    <section aria-labelledby="exec-charts" className="space-y-4">
      <h2 id="exec-charts" className="font-headline text-xl text-zinc-50">
        Gráficos
      </h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <LineChart
          title="Crescimento de usuários"
          series={[
            { key: 'signups', label: 'Cadastros', color: SERIES_COLORS[0] },
            { key: 'active', label: 'Usuários ativos', color: SERIES_COLORS[2] },
          ]}
          points={dashboard.series.map((point) => ({ key: point.day, values: { signups: point.signups, active: activeByDay.get(point.day) ?? 0 } }))}
          format={count}
          stale={stale}
        />
        {money ? (
          <LineChart
            title="Receita recorrente (MRR), últimos 12 meses"
            series={[{ key: 'mrr', label: 'MRR', color: SERIES_COLORS[0] }]}
            points={money.mrr_series.map((point) => ({ key: point.month, values: { mrr: point.mrr_cents } }))}
            format={formatBRL}
            stale={stale}
            area
          />
        ) : (
          <RestrictedCard title="Receita recorrente (MRR)" />
        )}
        <BarList
          title="Distribuição por plano"
          color={SERIES_COLORS[0]}
          emptyText="Nenhuma conta ainda."
          rows={dashboard.plan_distribution.filter((plan) => plan.users > 0).map((plan) => ({
            key: plan.slug,
            label: plan.name,
            value: plan.users,
            display: `${formatNumber(plan.users)} · ${formatPercent(ratio(plan.users, dashboard.users.total))}`,
          }))}
        />
        <ColumnChart
          title="Utilização da plataforma"
          series={[
            { key: 'image', label: KIND_LABELS.image ?? 'Imagem', color: SERIES_COLORS[0] },
            { key: 'video', label: KIND_LABELS.video ?? 'Vídeo', color: SERIES_COLORS[1] },
            { key: 'text', label: KIND_LABELS.text ?? 'Texto', color: SERIES_COLORS[2] },
          ]}
          points={(analytics?.tools.series ?? []).map((point) => ({ day: point.day, values: { image: point.image, video: point.video, text: point.text } }))}
          format={count}
          stale={stale}
          integer
        />
        <LineChart
          title={`Consumo de créditos · ${formatNumber(business.credits.available)} disponíveis nas carteiras`}
          series={[
            { key: 'distributed', label: 'Distribuídos', color: SERIES_COLORS[1] },
            { key: 'consumed', label: 'Consumidos', color: SERIES_COLORS[0] },
          ]}
          points={business.credit_series.map((point) => ({ key: point.day, values: { distributed: point.distributed, consumed: point.consumed } }))}
          format={count}
          stale={stale}
        />
        {money ? (
          <LineChart
            title="Receita recebida × custo de IA"
            series={[
              { key: 'revenue', label: 'Receita', color: SERIES_COLORS[2] },
              { key: 'cost', label: 'Custo de IA', color: SERIES_COLORS[3] },
            ]}
            points={money.revenue_series.map((point) => ({ key: point.day, values: { revenue: point.revenue_cents / 100, cost: point.ai_cost_brl } }))}
            format={formatBrlValue}
            stale={stale}
          />
        ) : (
          <RestrictedCard title="Receita × custo de IA" />
        )}
        <BarList
          title="Retenção: voltaram depois de N dias"
          color={SERIES_COLORS[2]}
          emptyText="Ainda não há contas antigas o bastante para medir retorno."
          rows={(analytics?.retention.returning ?? []).map((row) => ({
            key: String(row.day),
            label: `Dia ${row.day}`,
            value: ratio(row.returned, row.eligible) ?? 0,
            display: `${formatPercent(ratio(row.returned, row.eligible))} de ${formatNumber(row.eligible)}`,
          }))}
        />
        <BarList
          title="Funções mais utilizadas"
          color={SERIES_COLORS[0]}
          emptyText="Nenhum uso no período."
          rows={[...(analytics?.tools.by_tool ?? [])]
            .sort((a, b) => b.total - a.total)
            .slice(0, 8)
            .map((tool) => ({ key: tool.model_slug, label: tool.name, value: tool.total, display: `${formatNumber(tool.total)} usos · ${formatNumber(tool.users)} pessoas` }))}
        />
      </div>
    </section>
  )
}

function RestrictedCard({ title }: { readonly title: string }) {
  return (
    <div className="grid min-h-48 place-items-center rounded-2xl bg-surface p-4 text-center ring-1 ring-white/[0.06]">
      <div>
        <p className="text-sm font-bold text-zinc-200">{title}</p>
        <p className="mt-1 text-xs text-zinc-500">Visível para quem tem acesso ao financeiro.</p>
      </div>
    </div>
  )
}
