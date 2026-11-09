import { AlertTriangle, Gauge, TrendingUp, HelpCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { change } from '@/domain/adminAnalytics'
import { summarizeCosts, type AiCosts, type CostAlert, type CostAlertKind } from '@/domain/aiCosts'
import { StatTile } from '../dashboard/StatTile'
import { formatBrlValue, formatNumber, formatPercent } from '../finance/format'
import { InfoTip } from '../InfoTip'

const brlPrecise = (value: number | null) =>
  value === null ? '–' : `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`

function Metric({ label, tip, children }: { readonly label: string; readonly tip: string; readonly children: ReactNode }) {
  return (
    <div className="relative">
      <span className="absolute right-3 top-3 z-10">
        <InfoTip label={label}>{tip}</InfoTip>
      </span>
      {children}
    </div>
  )
}

/** Os dez indicadores da aba, com a base do custo sempre à vista. */
export function CostKpis({ data, stale }: { readonly data: AiCosts; readonly stale: boolean }) {
  const { kpis } = data
  const summary = summarizeCosts(data)
  return (
    <section aria-labelledby="cost-kpis" className={stale ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
      <h2 id="cost-kpis" className="sr-only">
        Indicadores de custo
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Metric label="Custo hoje" tip="Soma do custo de IA desde 00h (Brasília), com os filtros de provedor, categoria e modelo.">
          <StatTile label="Custo hoje" value={formatBrlValue(kpis.cost_today_brl)} />
        </Metric>
        <Metric label="Últimos 7 dias" tip="Custo de IA das últimas 168 horas.">
          <StatTile label="Últimos 7 dias" value={formatBrlValue(kpis.cost_7d_brl)} />
        </Metric>
        <Metric label="No mês" tip="Custo de IA desde o dia 1 do mês corrente.">
          <StatTile label="No mês" value={formatBrlValue(kpis.cost_month_brl)} />
        </Metric>
        <Metric label="Acumulado" tip="Todo o custo de IA registrado desde que o registro começou (migration 0025).">
          <StatTile label="Acumulado" value={formatBrlValue(kpis.cost_total_brl)} />
        </Metric>
        <Metric label="Custo médio por geração" tip="Custo do período dividido pelas gerações que o fornecedor cobrou (inclui falhas cobradas).">
          <StatTile label="Médio por geração" value={brlPrecise(summary.avgPerGeneration)} />
        </Metric>
        <Metric label="Custo por usuário ativo" tip="Custo do período dividido por quem gerou ao menos uma vez no período.">
          <StatTile label="Por usuário ativo" value={brlPrecise(summary.avgPerActiveUser)} hint={`${formatNumber(kpis.active_users)} ativos`} />
        </Metric>
        <Metric label="Gerações" tip="Gerações cobradas pelo fornecedor no período: sucesso e falha cobrada.">
          <StatTile
            label="Gerações"
            value={formatNumber(kpis.generations)}
            change={change(kpis.generations, kpis.generations_previous)}
            hint={kpis.failed_billed > 0 ? `${kpis.failed_billed} falhas cobradas` : undefined}
          />
        </Metric>
        <Metric label="Créditos consumidos" tip="Créditos do Vynkio descontados das pessoas. Não é a unidade do fornecedor (imagem, segundo, token).">
          <StatTile label="Créditos consumidos" value={formatNumber(kpis.credits)} change={change(kpis.credits, kpis.credits_previous)} />
        </Metric>
        <Metric
          label="Receita estimada"
          tip={`Créditos consumidos × valor de referência do crédito (R$ ${data.credit_value_brl.toLocaleString('pt-BR')}). É estimativa: o recebido de fato está no Analytics.`}
        >
          <StatTile label="Receita estimada" value={kpis.revenue_estimated_brl === null ? 'Restrito' : formatBrlValue(kpis.revenue_estimated_brl)} hint="estimada" />
        </Metric>
        <Metric label="Margem bruta estimada" tip="(Receita estimada − custo de IA) ÷ receita estimada, no período.">
          <StatTile
            label="Margem bruta estimada"
            value={summary.grossMargin === null ? '–' : formatPercent(summary.grossMargin)}
            tone={summary.grossMargin !== null && summary.grossMargin < data.min_margin_rate ? 'bad' : undefined}
            hint={`meta ${formatPercent(data.min_margin_rate)}`}
          />
        </Metric>
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        Base do custo no período: <strong className="text-zinc-300">{formatNumber(kpis.metered)} medidas</strong> (unidades reais da resposta × tarifa),{' '}
        <strong className="text-zinc-300">{formatNumber(kpis.estimated)} estimadas</strong> (tarifa × configuração do modelo)
        {kpis.unknown > 0 && (
          <>
            {' '}e <strong className="text-red-300">{formatNumber(kpis.unknown)} sem tarifa</strong> (fora dos totais)
          </>
        )}
        . Nenhum fornecedor devolve hoje o valor cobrado por pedido; quando devolver, ele passa na frente.
      </p>
    </section>
  )
}

const ALERT_ICONS: Readonly<Record<CostAlertKind, ReactNode>> = {
  margin: <Gauge className="size-4" aria-hidden="true" />,
  cost: <AlertTriangle className="size-4" aria-hidden="true" />,
  spike: <TrendingUp className="size-4" aria-hidden="true" />,
  unknown: <HelpCircle className="size-4" aria-hidden="true" />,
}

export function CostAlertsList({ alerts, onOpen }: { readonly alerts: readonly CostAlert[]; readonly onOpen: (slug: string) => void }) {
  if (alerts.length === 0) return null
  return (
    <section aria-labelledby="cost-alerts" className="rounded-2xl bg-amber-500/[0.06] p-4 ring-1 ring-amber-400/20">
      <h2 id="cost-alerts" className="text-sm font-bold text-amber-200">
        {alerts.length} alerta{alerts.length > 1 ? 's' : ''} nos modelos
      </h2>
      <ul className="mt-3 space-y-2">
        {alerts.map((alert) => (
          <li key={`${alert.slug}:${alert.kind}`} className="flex items-start gap-2.5 text-sm">
            <span className="mt-0.5 text-amber-300">{ALERT_ICONS[alert.kind]}</span>
            <p className="min-w-0 flex-1 text-zinc-300">
              <button
                type="button"
                onClick={() => onOpen(alert.slug)}
                className="font-semibold text-zinc-50 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {alert.model}
              </button>{' '}
              {alert.message}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
