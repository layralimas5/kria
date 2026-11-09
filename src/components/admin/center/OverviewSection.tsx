import { change, ratio } from '@/domain/adminDashboard'
import { subscriptionMetrics, type CenterData } from '@/domain/commandCenter'
import { SERIES_COLORS } from '../charts/chartColors'
import { CenterAlerts, CenterSection } from './CenterLayout'
import { count, money, pct } from './format'
import { MetricCard, MetricGrid } from './MetricCard'

const [VIOLET, GOLD, SKY, PINK] = SERIES_COLORS

/** Primeira dobra: quanto entrou, quanto saiu, quanto sobrou e se a base cresce. */
export function OverviewSection({ data }: { readonly data: CenterData }) {
  const { summary, dashboard, business } = data
  const subs = subscriptionMetrics(dashboard, business)
  const finance = dashboard.finance
  const mrrSpark = business.money?.mrr_series.map((point) => point.mrr_cents) ?? []
  const profitSpark = (business.money?.revenue_series ?? []).map((day) => day.revenue_cents / 100 - day.ai_cost_brl)
  const signupSpark = dashboard.series.map((day) => day.signups)

  return (
    <CenterSection id="visao-geral" title="Visão geral" question="Quanto entrou, quanto saiu, quanto sobrou e se a base está crescendo.">
      <CenterAlerts alerts={data.alerts} />
      {summary && finance ? (
        <MetricGrid>
          <MetricCard
            label="Receita total acumulada"
            value={money(summary.lifetimeNetCents)}
            info="Tudo o que já foi pago desde o início (mensalidades e pacotes), menos reembolsos. Não desconta taxas."
            to="/admin/financeiro"
          />
          <MetricCard
            label="MRR"
            value={money(finance.mrr_cents)}
            info="Receita recorrente mensal: soma do preço contratado das assinaturas ativas e em atraso que já pagaram."
            spark={mrrSpark}
            to="/admin/assinaturas"
          />
          <MetricCard label="ARR" value={money(finance.mrr_cents * 12)} info="Receita recorrente anualizada: MRR × 12." spark={mrrSpark} sparkColor={GOLD} />
          <MetricCard
            label="Recebido no mês"
            value={money(summary.monthReceivedCents)}
            info="Pagamentos confirmados desde o dia 1º deste mês (horário de Brasília), sem reembolsados. Não depende do filtro de período."
          />
          <MetricCard
            label="Receita prevista"
            value={money(summary.projectedNextMonthCents)}
            badge="Projeção"
            hint={summary.atRiskCents > 0 ? `${money(summary.atRiskCents)} em atraso, fora da conta` : 'Renovações das assinaturas ativas'}
            info="Projeção: soma das mensalidades das assinaturas ativas que não pediram cancelamento. Supõe que todas renovam; atraso e pacotes avulsos ficam de fora."
          />
          <MetricCard
            label="Lucro líquido estimado"
            value={money(summary.profitCents)}
            badge="Estimado"
            tone={summary.profitCents < 0 ? 'bad' : summary.profitCents > 0 ? 'good' : undefined}
            spark={profitSpark}
            sparkColor={SKY}
            info="Recebido no período − reembolsos − taxa de pagamento estimada − custo de IA − despesas registradas no período. Custo que não foi lançado em Despesas não entra."
          />
          <MetricCard
            label="Margem de lucro"
            value={pct(summary.profitMargin)}
            tone={summary.profitMargin !== null && summary.profitMargin < 0 ? 'bad' : undefined}
            info="Lucro líquido estimado ÷ recebido líquido de reembolsos, no período."
          />
          <MetricCard
            label="Custos operacionais"
            value={money(summary.totalCostsCents)}
            upIsGood={false}
            hint={`IA ${money(summary.aiCostCents)} · taxas ${money(summary.feesCents)} · outros ${money(summary.otherCostsCents)}`}
            info="Taxa de pagamento estimada + custo de IA registrado + despesas lançadas no período."
          />
        </MetricGrid>
      ) : (
        <p className="rounded-2xl bg-surface px-4 py-3 text-sm text-zinc-400 ring-1 ring-white/[0.06]">
          Os números de dinheiro aparecem para quem tem acesso ao financeiro.
        </p>
      )}

      <MetricGrid>
        <MetricCard
          label="Usuários cadastrados"
          value={count(subs.total)}
          hint={`${count(dashboard.users.new_in_period)} novos no período`}
          change={change(dashboard.users.new_in_period, dashboard.users.new_previous)}
          spark={signupSpark}
          info="Todas as contas criadas, de qualquer plano. A variação compara os cadastros do período com os do período anterior."
          to="/admin/usuarios"
        />
        <MetricCard
          label="Assinantes ativos"
          value={count(subs.paying)}
          hint={`${pct(ratio(subs.paying, subs.total)) ?? '–'} da base`}
          info="Contas com plano pago valendo agora (assinatura ativa ou em atraso dentro da tolerância). Cortesia do admin não conta."
          to="/admin/assinaturas"
          sparkColor={VIOLET}
        />
        <MetricCard label="Usuários gratuitos" value={count(subs.free)} info="Contas sem plano pago valendo agora." />
        <MetricCard
          label="Novos assinantes"
          value={count(subs.newSubscriptions)}
          info="Assinaturas que fizeram o primeiro pagamento no período."
          spark={dashboard.series.map((day) => day.new_subscriptions)}
        />
        <MetricCard
          label="Assinaturas canceladas"
          value={count(subs.cancellations)}
          upIsGood={false}
          change={finance ? change(finance.cancellations, finance.cancellations_previous) : null}
          info="Assinaturas pagas canceladas no período."
          spark={dashboard.series.map((day) => day.cancellations)}
          sparkColor={PINK}
        />
        <MetricCard
          label="Churn"
          value={finance ? pct(subs.churn) : null}
          tone={subs.churn !== null && subs.churn >= 0.1 ? 'bad' : undefined}
          info="Assinaturas pagas perdidas no período ÷ assinaturas pagas no início do período. Troca de plano não conta."
        />
        <MetricCard
          label="Conversão grátis → pago"
          value={pct(subs.conversion)}
          change={subs.conversionChange}
          hint={`${count(business.conversion.converted)} de ${count(business.conversion.signups)} cadastros`}
          info="Cadastros do período que pagaram uma mensalidade até o fim do período."
        />
        <MetricCard
          label="Ticket médio por assinante"
          value={money(subs.ticketCents)}
          info="MRR ÷ assinantes ativos: quanto cada assinante paga por mês, em média."
        />
      </MetricGrid>
    </CenterSection>
  )
}
