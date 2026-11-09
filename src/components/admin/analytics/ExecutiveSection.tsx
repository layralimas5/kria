import clsx from 'clsx'
import { AlertTriangle, Download, Info, Sparkles } from 'lucide-react'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { providerLabel } from '@/domain/aiCosts'
import { brtDay, type Period } from '@/domain/adminDashboard'
import type { Analytics } from '@/domain/adminAnalytics'
import {
  buildInsights,
  downloadCsv,
  executiveMetrics,
  planMargin,
  toCsv,
  type Business,
  type CsvValue,
  type ExecutiveMetrics,
  type Insight,
} from '@/domain/business'
import { formatBRL } from '@/domain/format'
import { useQuery } from '@/hooks/useQuery'
import { fetchAdminModels, fetchAdminPlans, fetchBusiness, fetchDashboard } from '@/lib/adminApi'
import { Button } from '../../ui/Button'
import { Notice } from '../../ui/Notice'
import { ALL_SCOPE, ScopeSelect } from '../dashboard/ScopeFilter'
import { StatTile } from '../dashboard/StatTile'
import { formatNumber, formatPercent } from '../finance/format'
import { InfoTip } from '../InfoTip'
import { ExecutiveCharts } from './ExecutiveCharts'
import { ExpensesPanel } from './ExpensesPanel'

const scope = (value: string) => (value === ALL_SCOPE ? null : value)

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

const RESTRICTED = 'Restrito'

function MetricsGrid({ metrics, business }: { readonly metrics: ExecutiveMetrics; readonly business: Business }) {
  const money = metrics.money
  const cents = (value: number | undefined | null) => (value === undefined || value === null ? RESTRICTED : formatBRL(value))
  return (
    <section aria-labelledby="exec-kpis" className="space-y-3">
      <h2 id="exec-kpis" className="font-headline text-xl text-zinc-50">
        Indicadores
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Metric label="Usuários cadastrados" tip="Todas as contas, ou só as do plano filtrado. Foto de agora, não depende do período.">
          <StatTile label="Usuários cadastrados" value={formatNumber(metrics.totalUsers)} />
        </Metric>
        <Metric label="Usuários ativos" tip="Contas que geraram ao menos uma vez no período.">
          <StatTile label="Usuários ativos" value={formatNumber(metrics.activeUsers)} />
        </Metric>
        <Metric label="Novos usuários" tip="Cadastros no período, comparados ao período anterior de mesmo tamanho.">
          <StatTile label="Novos no período" value={formatNumber(metrics.newUsers)} change={metrics.newUsersChange} />
        </Metric>
        <Metric label="Assinantes ativos" tip="Contas com assinatura paga valendo agora (ativa, em atraso até 3 dias ou cancelada com ciclo em curso). Cortesia não conta.">
          <StatTile label="Assinantes ativos" value={formatNumber(metrics.subscribers)} />
        </Metric>
        <Metric label="Assinaturas canceladas" tip="Cancelamentos registrados no período.">
          <StatTile label="Canceladas no período" value={money ? formatNumber(money.cancellations) : RESTRICTED} upIsGood={false} />
        </Metric>
        <Metric label="Usuários Free" tip="Contas sem assinatura paga nem cortesia valendo agora.">
          <StatTile label="Usuários Free" value={formatNumber(metrics.freeUsers)} />
        </Metric>
        <Metric label="Conversão" tip="Cadastros do período que pagaram uma mensalidade até o fim do período. Compara com o período anterior.">
          <StatTile label="Conversão Free → pago" value={formatPercent(metrics.conversion)} change={metrics.conversionChange} />
        </Metric>
        <Metric label="MRR" tip="Soma do valor mensal das assinaturas pagas ativas agora.">
          <StatTile label="MRR" value={cents(money?.mrrCents)} />
        </Metric>
        <Metric label="ARR" tip="MRR × 12.">
          <StatTile label="ARR" value={cents(money?.arrCents)} />
        </Metric>
        <Metric label="Churn" tip="Assinaturas pagas perdidas no período ÷ assinaturas vivas no início do período.">
          <StatTile label="Churn de clientes" value={money ? formatPercent(money.churn) : RESTRICTED} />
        </Metric>
        <Metric label="ARPU" tip="MRR ÷ assinantes ativos: quanto cada pagante gera por mês.">
          <StatTile label="ARPU" value={money ? (money.arpuCents === null ? '–' : formatBRL(money.arpuCents)) : RESTRICTED} />
        </Metric>
        <Metric label="Receita recebida" tip="Pagamentos confirmados no período (mensalidades e pacotes) menos reembolsos.">
          <StatTile label="Receita recebida" value={cents(money?.netReceivedCents)} />
        </Metric>
        <Metric label="Custos de IA" tip="Custo de IA das gerações do período, medido ou estimado pela tarifa. Compara com o período anterior.">
          <StatTile
            label="Custos de IA"
            value={formatBRL(metrics.aiCostCents)}
            change={metrics.aiCostChange}
            upIsGood={false}
            hint={business.ai.unknown_cost > 0 ? `${business.ai.unknown_cost} sem tarifa` : undefined}
          />
        </Metric>
        <Metric label="Margem bruta" tip="(Receita recebida − custo de IA) ÷ receita recebida.">
          <StatTile label="Margem bruta após IA" value={money ? formatPercent(money.grossMargin) : RESTRICTED} />
        </Metric>
        <Metric label="Lucro estimado" tip="Receita recebida − taxa de pagamento − custo de IA − despesas registradas no período. Não inclui premissas nem custo que não foi lançado.">
          <StatTile
            label="Lucro estimado"
            value={cents(money?.profitCents)}
            tone={money ? (money.profitCents < 0 ? 'bad' : 'good') : undefined}
            hint={money ? `despesas ${formatBRL(money.expensesCents)}` : undefined}
          />
        </Metric>
      </div>
    </section>
  )
}

const INSIGHT_ICONS: Readonly<Record<Insight['tone'], ReactNode>> = {
  warning: <AlertTriangle className="size-4 text-amber-300" aria-hidden="true" />,
  info: <Info className="size-4 text-sky-300" aria-hidden="true" />,
  good: <Sparkles className="size-4 text-emerald-300" aria-hidden="true" />,
}

function InsightsList({ insights }: { readonly insights: readonly Insight[] }) {
  return (
    <section aria-labelledby="exec-insights" className="space-y-3">
      <h2 id="exec-insights" className="font-headline text-xl text-zinc-50">
        Inteligência de negócio
      </h2>
      {insights.length === 0 ? (
        <p className="rounded-2xl bg-surface p-5 text-sm text-zinc-400 ring-1 ring-white/[0.06]">
          Nada fora da curva no período. Os sinais aparecem aqui quando custo, conversão, uso ou margem mudam com volume suficiente.
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {insights.map((insight) => (
            <li key={insight.id} className="flex gap-3 rounded-2xl bg-surface p-4 ring-1 ring-white/[0.06]">
              <span className="mt-0.5">{INSIGHT_ICONS[insight.tone]}</span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-zinc-100">{insight.title}</p>
                <p className="mt-0.5 text-sm text-zinc-400">{insight.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-zinc-500">Regras fixas sobre os dados reais do período, sem IA. Só disparam com volume mínimo (10 usos ou 5 cadastros).</p>
    </section>
  )
}

function PlanTable({ business }: { readonly business: Business }) {
  const money = business.money
  if (!money) return null
  return (
    <section aria-labelledby="exec-plans" className="space-y-3">
      <h2 id="exec-plans" className="font-headline text-xl text-zinc-50">
        Rentabilidade por plano
      </h2>
      <div className="overflow-x-auto rounded-2xl bg-surface ring-1 ring-white/[0.06]">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <caption className="sr-only">Receita, custo de IA e margem por plano no período</caption>
          <thead className="text-[11px] uppercase tracking-wider text-zinc-500">
            <tr>
              {['Plano', 'Contas', 'Recebido', 'Custo de IA', 'Créditos usados', 'Margem'].map((label, index) => (
                <th key={label} scope="col" className={clsx('px-3 py-3 font-bold', index > 0 && 'text-right')}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {money.plans.map((plan) => {
              const margin = planMargin(plan)
              return (
                <tr key={plan.slug}>
                  <th scope="row" className="px-3 py-2.5 text-left font-semibold text-zinc-100">{plan.name}</th>
                  <td className="px-3 py-2.5 text-right tabular-nums text-zinc-300">{formatNumber(plan.users)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-zinc-300">{formatBRL(plan.received_cents)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-zinc-300">{formatBRL(Math.round(plan.ai_cost_brl * 100))}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-zinc-300">{formatNumber(plan.credits)}</td>
                  <td className={clsx('px-3 py-2.5 text-right font-semibold tabular-nums', margin !== null && margin < money.min_margin_rate ? 'text-red-300' : 'text-zinc-100')}>
                    {margin === null ? 'sem receita' : formatPercent(margin)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">
        Contas = plano em vigor agora. Margem de contribuição = (recebido − custo de IA de quem está no plano) ÷ recebido, no período. Meta {formatPercent(money.min_margin_rate)}.
      </p>
    </section>
  )
}

function exportReport(period: Period, metrics: ExecutiveMetrics, business: Business, filters: Record<string, string>) {
  const money = metrics.money
  const rows: CsvValue[][] = [
    ['Filtros', 'Período', 'De', brtDay(period.from)],
    ['Filtros', 'Período', 'Até', brtDay(new Date(period.to.getTime() - 1))],
    ...Object.entries(filters).map(([key, value]): CsvValue[] => ['Filtros', key, 'valor', value]),
    ['Indicadores', 'Usuários', 'cadastrados', metrics.totalUsers],
    ['Indicadores', 'Usuários', 'ativos no período', metrics.activeUsers],
    ['Indicadores', 'Usuários', 'novos no período', metrics.newUsers],
    ['Indicadores', 'Usuários', 'assinantes ativos', metrics.subscribers],
    ['Indicadores', 'Usuários', 'free', metrics.freeUsers],
    ['Indicadores', 'Conversão', 'free para pago', metrics.conversion],
    ['Indicadores', 'IA', 'custo (R$)', metrics.aiCostCents / 100],
    ['Indicadores', 'Créditos', 'distribuídos', business.credits.distributed],
    ['Indicadores', 'Créditos', 'consumidos', business.credits.consumed],
    ['Indicadores', 'Créditos', 'disponíveis', business.credits.available],
  ]
  if (money) {
    rows.push(
      ['Indicadores', 'Receita', 'MRR (R$)', money.mrrCents / 100],
      ['Indicadores', 'Receita', 'ARR (R$)', money.arrCents / 100],
      ['Indicadores', 'Receita', 'ARPU (R$)', money.arpuCents === null ? null : money.arpuCents / 100],
      ['Indicadores', 'Receita', 'churn', money.churn],
      ['Indicadores', 'Receita', 'canceladas', money.cancellations],
      ['Indicadores', 'Receita', 'recebida (R$)', money.netReceivedCents / 100],
      ['Indicadores', 'Resultado', 'taxas de pagamento (R$)', money.paymentFeesCents / 100],
      ['Indicadores', 'Resultado', 'despesas registradas (R$)', money.expensesCents / 100],
      ['Indicadores', 'Resultado', 'margem bruta após IA', money.grossMargin],
      ['Indicadores', 'Resultado', 'lucro estimado (R$)', money.profitCents / 100],
    )
    for (const plan of business.money?.plans ?? []) {
      rows.push(
        ['Planos', plan.name, 'contas', plan.users],
        ['Planos', plan.name, 'recebido (R$)', plan.received_cents / 100],
        ['Planos', plan.name, 'custo de IA (R$)', plan.ai_cost_brl],
        ['Planos', plan.name, 'margem', planMargin(plan)],
      )
    }
    for (const day of business.money?.revenue_series ?? []) {
      rows.push(['Diário', day.day, 'receita (R$)', day.revenue_cents / 100], ['Diário', day.day, 'custo de IA (R$)', day.ai_cost_brl])
    }
  }
  for (const day of business.credit_series) {
    rows.push(['Diário', day.day, 'créditos distribuídos', day.distributed], ['Diário', day.day, 'créditos consumidos', day.consumed])
  }
  downloadCsv(`vynkio-relatorio-${brtDay(period.from)}-a-${brtDay(new Date(period.to.getTime() - 1))}.csv`, toCsv(['Seção', 'Item', 'Métrica', 'Valor'], rows))
}

function Definitions() {
  return (
    <details className="rounded-2xl bg-surface p-4 text-sm ring-1 ring-white/[0.06]">
      <summary className="cursor-pointer font-bold text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">Como cada número é calculado</summary>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-zinc-400">
        <li>Período: dias no fuso de Brasília; comparações usam o período anterior de mesmo tamanho.</li>
        <li>Usuários cadastrados, assinantes, Free e MRR são foto de agora; os demais seguem o período.</li>
        <li>Plano filtrado = plano em vigor da conta agora (assinatura paga, depois cortesia, depois Grátis).</li>
        <li>Custo de IA: registro por geração cobrada pelo fornecedor, em reais pelo câmbio da hora da geração. Sem tarifa, fica fora e aparece como “sem tarifa”.</li>
        <li>Receita recebida: pagamentos confirmados menos reembolsos. Lucro estimado só desconta taxa, IA e despesas lançadas.</li>
        <li>Uso, retenção e funções mais usadas são da base inteira no período (o filtro de plano não se aplica a eles).</li>
      </ul>
    </details>
  )
}

/** Visão executiva: o painel que responde quanto entrou, quanto a IA custou e o que sobrou. */
export function ExecutiveSection({ period, analytics, stale }: { readonly period: Period; readonly analytics: Analytics | null; readonly stale: boolean }) {
  const [plan, setPlan] = useState(ALL_SCOPE)
  const [model, setModel] = useState(ALL_SCOPE)
  const [provider, setProvider] = useState(ALL_SCOPE)
  const plans = useQuery(fetchAdminPlans, 'Não deu para carregar os planos.')
  const models = useQuery(fetchAdminModels, 'Não deu para carregar as ferramentas.')
  const loadDashboard = useCallback(() => fetchDashboard(period, { plan: scope(plan), model: scope(model) }), [period, plan, model])
  const loadBusiness = useCallback(
    () => fetchBusiness(period, { plan: scope(plan), model: scope(model), provider: scope(provider) }),
    [period, plan, model, provider],
  )
  const dashboard = useQuery(loadDashboard, 'Não deu para carregar os números do período.')
  const business = useQuery(loadBusiness, 'Não deu para carregar receita e custos.')

  const metrics = useMemo(() => (dashboard.data && business.data ? executiveMetrics(dashboard.data, business.data) : null), [dashboard.data, business.data])
  const insights = useMemo(
    () => (business.data ? buildInsights(business.data, analytics?.tools ?? null, business.data.money?.min_margin_rate ?? 0.4) : []),
    [business.data, analytics],
  )
  const providers = useMemo(() => [...new Set((models.data ?? []).map((item) => item.provider))], [models.data])
  const scoped = plan !== ALL_SCOPE || model !== ALL_SCOPE || provider !== ALL_SCOPE
  const loading = dashboard.loading || business.loading
  const labelOf = (options: readonly { value: string; label: string }[], value: string) => options.find((option) => option.value === value)?.label ?? 'Todos'

  const planOptions = [{ value: ALL_SCOPE, label: 'Todos' }, ...(plans.data ?? []).filter((item) => item.status !== 'draft').map((item) => ({ value: item.slug, label: item.name }))]
  const modelOptions = [{ value: ALL_SCOPE, label: 'Todas' }, ...(models.data ?? []).map((item) => ({ value: item.slug, label: item.name }))]
  const providerOptions = [{ value: ALL_SCOPE, label: 'Todos' }, ...providers.map((item) => ({ value: item, label: providerLabel(item) }))]

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end gap-3">
        <ScopeSelect label="Plano" value={plan} options={planOptions} onChange={setPlan} />
        <ScopeSelect label="Ferramenta" value={model} options={modelOptions} onChange={setModel} />
        <ScopeSelect label="Provedor de IA" value={provider} options={providerOptions} onChange={setProvider} />
        {scoped && (
          <button
            type="button"
            onClick={() => {
              setPlan(ALL_SCOPE)
              setModel(ALL_SCOPE)
              setProvider(ALL_SCOPE)
            }}
            className="min-h-10 rounded-xl px-3 text-[13px] font-semibold text-accent-soft hover:text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Limpar filtros
          </button>
        )}
        <div className="ml-auto">
          <Button
            variant="secondary"
            disabled={!metrics || !business.data}
            onClick={() =>
              metrics &&
              business.data &&
              exportReport(period, metrics, business.data, {
                Plano: labelOf(planOptions, plan),
                Ferramenta: labelOf(modelOptions, model),
                Provedor: labelOf(providerOptions, provider),
              })
            }
          >
            <Download className="size-4" aria-hidden="true" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {(dashboard.error ?? business.error) && <Notice tone="error">{dashboard.error ?? business.error}</Notice>}
      {!metrics && loading && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" role="status" aria-label="Carregando indicadores">
          {Array.from({ length: 15 }, (_, index) => (
            <div key={index} className="h-[5.5rem] animate-pulse rounded-2xl bg-surface ring-1 ring-white/[0.06]" />
          ))}
        </div>
      )}

      {metrics && dashboard.data && business.data && (
        <div className={clsx('space-y-10 transition-opacity', loading && 'opacity-60')}>
          <MetricsGrid metrics={metrics} business={business.data} />
          <InsightsList insights={insights} />
          <ExecutiveCharts dashboard={dashboard.data} business={business.data} analytics={analytics} stale={stale || loading} />
          <PlanTable business={business.data} />
          {business.data.money && (
            <ExpensesPanel expenses={business.data.money.expenses} totalCents={business.data.money.expenses_cents} onChanged={() => void business.reload()} />
          )}
          <Definitions />
        </div>
      )}
    </div>
  )
}
