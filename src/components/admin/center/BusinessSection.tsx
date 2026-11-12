import clsx from 'clsx'
import type { CenterData } from '@/domain/commandCenter'
import { buildInsights } from '@/domain/business'
import { formatBRL } from '@/domain/format'
import { CenterSection, Insufficient } from './CenterLayout'
import { count, money, moneyFromBrl, pct } from './format'
import { InsightsList } from './InsightsList'
import { INSUFFICIENT, MetricCard, MetricGrid } from './MetricCard'
import { ScenarioSimulator } from './ScenarioSimulator'

/** As perguntas de dono, respondidas com os números do período. Sem base, a resposta diz o que falta. */
function answers(data: CenterData): { question: string; answer: string }[] {
  const { summary, unit, plans, features, center } = data
  const bestPlan = [...plans].filter((plan) => plan.margin !== null).sort((a, b) => (b.margin ?? 0) - (a.margin ?? 0))[0]
  const costliest = features[0]
  const topUser = center.ai.top_users[0]
  return [
    {
      question: 'Quanto o Vynkio realmente faturou?',
      answer: summary
        ? `${formatBRL(summary.grossCents)} brutos no período; ${formatBRL(summary.netCents)} líquidos depois de reembolsos e taxas.`
        : INSUFFICIENT,
    },
    { question: 'Quanto gastamos com inteligência artificial?', answer: moneyFromBrl(center.ai.cost_brl) ?? INSUFFICIENT },
    { question: 'Quanto gastamos com taxas de pagamento?', answer: summary ? `${formatBRL(summary.feesCents)} (estimado pela taxa cadastrada)` : INSUFFICIENT },
    {
      question: 'Quanto sobra de lucro operacional estimado?',
      answer: summary ? `${formatBRL(summary.profitCents)} (${pct(summary.profitMargin) ?? 'sem recebimento'} do recebido)` : INSUFFICIENT,
    },
    {
      question: 'Qual plano gera maior margem?',
      answer: bestPlan ? `${bestPlan.name}: ${pct(bestPlan.margin)} de margem sobre ${formatBRL(bestPlan.receivedCents)} recebidos.` : `${INSUFFICIENT}: nenhum plano recebeu no período.`,
    },
    {
      question: 'Qual funcionalidade consome mais dinheiro?',
      answer: costliest && costliest.costBrl > 0 ? `${costliest.label}: ${moneyFromBrl(costliest.costBrl)} em ${count(costliest.generations)} gerações.` : `${INSUFFICIENT}: nenhuma geração cobrada.`,
    },
    {
      question: 'Quem apresenta maior custo operacional?',
      answer: topUser ? `${topUser.email ?? 'Uma conta'} (${topUser.plan_name ?? 'sem plano'}): ${moneyFromBrl(topUser.cost_brl)} em IA.` : `${INSUFFICIENT}: nenhum consumo.`,
    },
    {
      question: 'Qual é o custo médio para atender um assinante?',
      answer: unit && unit.costToServeCents !== null ? `${formatBRL(unit.costToServeCents)} de IA por mês, em média.` : `${INSUFFICIENT}: sem assinante pagante.`,
    },
    {
      question: 'Qual é o ponto de equilíbrio?',
      answer:
        unit && unit.breakEvenSubscribers !== null
          ? `${count(unit.breakEvenSubscribers)} assinantes cobrem ${formatBRL(unit.fixedMonthlyCents)} de custos fixos por mês.`
          : unit && unit.fixedMonthlyCents === 0
            ? `${INSUFFICIENT}: lance as despesas fixas em Financeiro > Despesas.`
            : `${INSUFFICIENT}: falta assinante pagante com contribuição positiva.`,
    },
  ]
}

export function BusinessSection({ data }: { readonly data: CenterData }) {
  const { unit, plans } = data
  const minMargin = data.center.settings.min_margin_rate

  return (
    <CenterSection id="negocio" title="Inteligência de negócio" question="Se o preço, o consumo e o crescimento fecham a conta.">
      {!unit ? (
        <Insufficient title="Inteligência de negócio restrita">Unidade econômica, rentabilidade e simulação aparecem para quem tem acesso ao financeiro.</Insufficient>
      ) : (
        <>
          <section aria-labelledby="answers-title" className="card-premium rounded-2xl p-4">
            <h3 id="answers-title" className="text-sm font-bold text-zinc-200">
              Inteligência financeira
            </h3>
            <dl className="mt-3 grid gap-x-8 gap-y-3 md:grid-cols-2">
              {answers(data).map((item) => (
                <div key={item.question} className="border-b border-white/[0.04] pb-3">
                  <dt className="text-xs font-semibold text-zinc-500">{item.question}</dt>
                  <dd className={clsx('mt-0.5 text-sm', item.answer.startsWith(INSUFFICIENT) ? 'text-zinc-500' : 'text-zinc-100')}>{item.answer}</dd>
                </div>
              ))}
            </dl>
          </section>

          <InsightsList insights={buildInsights(data.business, null, minMargin ?? 0.4)} />

          <MetricGrid>
            <MetricCard label="ARPU" value={money(unit.arpuCents)} info="Receita recorrente média por conta: MRR ÷ todas as contas, inclusive gratuitas." />
            <MetricCard label="ARPPU" value={money(unit.arppuCents)} info="Receita recorrente média por pagante: MRR ÷ assinantes ativos." />
            <MetricCard
              label="LTV estimado"
              value={money(unit.ltvCents)}
              badge="Estimado"
              info="Contribuição mensal por assinante ÷ churn mensal (últimos 30 dias). Sem churn medido, fica sem número em vez de infinito."
            />
            <MetricCard
              label="CAC"
              value={money(unit.cacCents)}
              hint={unit.cacCents === null ? 'Lance o marketing em Despesas para medir' : `LTV/CAC ${unit.ltvToCac?.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) ?? '–'}`}
              info="Despesas de marketing registradas no período ÷ contas que pagaram a primeira mensalidade no período."
            />
            <MetricCard
              label="Churn de receita"
              value={pct(unit.revenueChurn)}
              info="MRR das assinaturas que saíram no período ÷ MRR do início do período."
            />
            <MetricCard
              label="Contribuição por assinante"
              value={money(unit.unitContributionCents)}
              hint={pct(unit.unitContributionMargin) ?? undefined}
              tone={unit.unitContributionCents !== null && unit.unitContributionCents < 0 ? 'bad' : undefined}
              info="ARPPU menos taxa de pagamento e custo médio de IA de um assinante, por mês."
            />
            <MetricCard
              label="Custo para atender um assinante"
              value={money(unit.costToServeCents)}
              info="Custo de IA das contas pagantes no período, levado a 30 dias, ÷ assinantes ativos."
            />
            <MetricCard
              label="Ponto de equilíbrio"
              value={unit.breakEvenSubscribers === null ? null : `${count(unit.breakEvenSubscribers)} assinantes`}
              hint={`Custos fixos ${formatBRL(unit.fixedMonthlyCents)}/mês`}
              info="Assinantes necessários para a contribuição mensal cobrir a média mensal das despesas registradas nos últimos 90 dias."
              to="/admin/financeiro"
            />
          </MetricGrid>

          {plans.length > 0 && (
            <section aria-labelledby="plan-profit" className="space-y-2">
              <h3 id="plan-profit" className="text-sm font-bold text-zinc-200">
                Rentabilidade por plano no período
              </h3>
              <div className="relative overflow-x-auto card-premium rounded-2xl">
                <table className="w-full min-w-[42rem] text-left text-sm">
                  <caption className="sr-only">Recebido, taxas, custo de IA e margem de cada plano</caption>
                  <thead className="border-b border-white/[0.06] bg-white/[0.025] text-[11px] uppercase tracking-wider text-zinc-500">
                    <tr>
                      <th scope="col" className="px-3 py-2.5 font-bold">Plano</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-bold">Contas</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-bold">Recebido</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-bold">Taxas</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-bold">Custo de IA</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-bold">Margem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05] tabular-nums">
                    {plans.map((plan) => {
                      const low = plan.margin !== null && (plan.margin < 0 || (minMargin !== null && plan.margin < minMargin))
                      return (
                        <tr key={plan.slug}>
                          <th scope="row" className="px-3 py-2.5 font-semibold text-zinc-100">{plan.name}</th>
                          <td className="px-3 py-2.5 text-right text-zinc-300">{count(plan.users)}</td>
                          <td className="px-3 py-2.5 text-right text-zinc-200">{formatBRL(plan.receivedCents)}</td>
                          <td className="px-3 py-2.5 text-right text-zinc-400">{formatBRL(plan.feesCents)}</td>
                          <td className="px-3 py-2.5 text-right text-zinc-400">{formatBRL(plan.aiCostCents)}</td>
                          <td className={clsx('px-3 py-2.5 text-right font-semibold', plan.margin === null ? 'text-zinc-500' : low ? 'text-red-300' : 'text-emerald-300')}>
                            {plan.margin === null ? (plan.aiCostCents > 0 ? `−${formatBRL(plan.aiCostCents)}` : '–') : pct(plan.margin)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-zinc-500">
                Plano grátis não recebe: a coluna mostra o custo de IA que ele gera. Margem mínima cadastrada: {pct(minMargin) ?? 'não definida'}.
              </p>
            </section>
          )}

          <ScenarioSimulator data={data} />
        </>
      )}
    </CenterSection>
  )
}
