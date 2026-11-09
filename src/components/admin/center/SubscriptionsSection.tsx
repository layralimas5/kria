import { ratio } from '@/domain/adminDashboard'
import { bucketKey, defaultGranularity, periodDays, subscriptionMetrics, type CenterData } from '@/domain/commandCenter'
import { formatBRL } from '@/domain/format'
import { BarList } from '../charts/BarList'
import { SERIES_COLORS } from '../charts/chartColors'
import { ComboChart } from '../charts/ComboChart'
import { CenterSection, Insufficient } from './CenterLayout'
import { count, money, pct } from './format'
import { MetricCard, MetricGrid } from './MetricCard'

const [VIOLET, GOLD, , PINK] = SERIES_COLORS

/** Novos, cancelados e crescimento líquido no mesmo agrupamento da receita. */
function growthPoints(data: CenterData) {
  const granularity = defaultGranularity(periodDays(data.center))
  const buckets = new Map<string, { added: number; lost: number }>()
  for (const day of data.dashboard.series) {
    const key = bucketKey(day.day, granularity)
    const current = buckets.get(key) ?? { added: 0, lost: 0 }
    buckets.set(key, { added: current.added + day.new_subscriptions, lost: current.lost + day.cancellations })
  }
  let net = 0
  return [...buckets.entries()].map(([key, value]) => {
    net += value.added - value.lost
    return { key, values: { added: value.added, lost: value.lost, net } }
  })
}

export function SubscriptionsSection({ data }: { readonly data: CenterData }) {
  const { dashboard, business, unit } = data
  const finance = dashboard.finance
  const subs = subscriptionMetrics(dashboard, business)

  return (
    <CenterSection id="assinaturas" title="Assinaturas" question="Como a base pagante entra, fica e sai, plano a plano.">
      {!finance ? (
        <Insufficient title="Assinaturas restritas">Recorrência, churn e receita por plano aparecem para quem tem acesso ao financeiro.</Insufficient>
      ) : (
        <>
          <MetricGrid>
            <MetricCard label="Assinantes ativos" value={count(subs.paying)} info="Contas com plano pago valendo agora." to="/admin/assinaturas" />
            <MetricCard
              label="Crescimento líquido"
              value={`${subs.newSubscriptions - subs.cancellations > 0 ? '+' : ''}${count(subs.newSubscriptions - subs.cancellations)}`}
              tone={subs.newSubscriptions - subs.cancellations < 0 ? 'bad' : undefined}
              hint={`${count(subs.newSubscriptions)} novas · ${count(subs.cancellations)} canceladas`}
              info="Novas assinaturas pagas menos cancelamentos no período."
            />
            <MetricCard
              label="Churn de clientes"
              value={pct(subs.churn)}
              hint={finance.churn_base > 0 ? `${finance.churn_lost} de ${finance.churn_base} do início do período` : undefined}
              info="Assinaturas pagas perdidas no período ÷ pagas no início dele."
            />
            <MetricCard
              label="Churn de receita"
              value={pct(unit?.revenueChurn ?? null)}
              tone={unit?.revenueChurn !== null && unit?.revenueChurn !== undefined && unit.revenueChurn >= 0.1 ? 'bad' : undefined}
              info="MRR das assinaturas que saíram no período ÷ MRR do início do período. Mostra o peso, em dinheiro, de quem cancelou."
            />
            <MetricCard
              label="Conversão grátis → pago"
              value={pct(subs.conversion)}
              change={subs.conversionChange}
              info="Cadastros do período que pagaram uma mensalidade até o fim do período."
            />
            <MetricCard label="Ticket médio" value={money(subs.ticketCents)} info="MRR ÷ assinantes ativos." />
            <MetricCard
              label="Em atraso"
              value={count(finance.past_due)}
              tone={finance.past_due > 0 ? 'bad' : undefined}
              hint={data.summary && data.summary.atRiskCents > 0 ? `${money(data.summary.atRiskCents)} por mês em risco` : undefined}
              info="Assinaturas com pagamento vencido e não confirmado pelo Asaas."
              to="/admin/assinaturas"
            />
            <MetricCard label="MRR" value={money(finance.mrr_cents)} info="Soma do preço contratado das assinaturas pagas vivas." spark={business.money?.mrr_series.map((point) => point.mrr_cents)} />
          </MetricGrid>

          <div className="grid gap-4 xl:grid-cols-2">
            <ComboChart
              title="Crescimento de assinantes"
              bars={[{ key: 'added', label: 'Novos assinantes', color: VIOLET }]}
              lines={[
                { key: 'lost', label: 'Cancelamentos', color: PINK },
                { key: 'net', label: 'Crescimento líquido acumulado', color: GOLD },
              ]}
              points={growthPoints(data)}
              format={count}
            />
            <BarList
              title="Receita recorrente por plano"
              color={VIOLET}
              emptyText="Nenhuma assinatura paga."
              rows={finance.by_plan
                .filter((plan) => plan.subscribers > 0 || plan.mrr_cents > 0)
                .map((plan) => ({
                  key: plan.slug,
                  label: plan.name,
                  value: plan.mrr_cents,
                  display: formatBRL(plan.mrr_cents),
                  detail: `${count(plan.subscribers)} assinantes · ${pct(ratio(plan.mrr_cents, finance.mrr_cents)) ?? '–'} do MRR · ${formatBRL(plan.received_cents)} recebidos no período`,
                }))}
            />
          </div>
        </>
      )}
    </CenterSection>
  )
}
