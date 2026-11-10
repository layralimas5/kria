import { TriangleAlert } from 'lucide-react'
import { MetricCard, MetricGrid } from '@/components/admin/center/MetricCard'
import { SERIES_COLORS } from '@/components/admin/charts/chartColors'
import { money, pct } from '@/components/admin/center/format'
import { change, provisionalOf, resultOf, type Explorer } from '@/domain/financeExplorer'

const points = (now: number | null, before: number | null) =>
  now === null || before === null ? null : `${now >= before ? '+' : ''}${((now - before) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} p.p.`

/** Os dez números do topo, todos no recorte dos filtros e comparados com o período equivalente. */
export function KpiSection({ data }: { readonly data: Explorer }) {
  const now = resultOf(data.totals)
  const before = resultOf(data.previous)
  const { provisional, reasons } = provisionalOf(data)
  const compareText = data.period.compare === 'year' ? 'contra o mesmo período do ano passado' : 'contra o período anterior'
  const spark = (pick: (point: Explorer['series'][number]) => number) => data.series.map((point) => pick(point) / 100)
  const reconciled = data.totals.reconciled_gross_cents
  const mrr = data.mrr.now_cents

  return (
    <section aria-labelledby="kpi-title" className="space-y-3">
      <h2 id="kpi-title" className="sr-only">
        Indicadores do recorte
      </h2>
      <MetricGrid>
        <MetricCard
          label="Receita bruta"
          value={money(now.gross)}
          change={change(now.gross, before.gross)}
          info={`Pagamentos confirmados no recorte (mensalidades e pacotes), inclusive os estornados depois. Pedido criado e não pago não entra. Variação ${compareText}.`}
          spark={spark((point) => point.gross_cents)}
          hint={`${data.totals.paid_count.toLocaleString('pt-BR')} pagamentos`}
        />
        <MetricCard
          label="Receita líquida"
          value={money(now.netRevenue)}
          change={change(now.netRevenue, before.netRevenue)}
          badge={data.totals.fees_estimated_cents > 0 ? 'Estimado' : undefined}
          info="Bruto menos reembolsos e taxas do gateway. Onde o Asaas informou o valor líquido, a taxa é a real; no resto, a taxa cadastrada no painel."
          hint={reconciled > 0 ? `Conciliada: ${money(data.totals.reconciled_net_cents)} de ${money(reconciled)} brutos` : 'Nenhum pagamento conciliado no Asaas ainda'}
        />
        <MetricCard
          label="MRR"
          value={money(mrr)}
          change={change(mrr, data.mrr.start_cents)}
          info="Receita recorrente ativa agora: soma do preço das assinaturas pagas e não canceladas, no recorte de plano e cliente. Pacote de crédito e cobrança pontual não entram. Variação contra o início do período."
          hint="Assinaturas ativas"
          spark={undefined}
        />
        <MetricCard
          label="ARR"
          value={money(mrr * 12)}
          change={change(mrr, data.mrr.start_cents)}
          info="MRR atual vezes 12: o que a base recorrente de hoje fatura em um ano se ninguém entrar nem sair."
          badge="Projeção"
        />
        <MetricCard
          label="Despesas totais"
          value={money(now.expenses)}
          change={change(now.expenses, before.expenses)}
          upIsGood={false}
          info="Custo de IA, taxas do gateway e despesas lançadas no painel (infraestrutura, ferramentas, serviços e outras)."
          spark={spark((point) => point.expenses_cents)}
          sparkColor={SERIES_COLORS[1]}
        />
        <MetricCard
          label="Custo das APIs de IA"
          value={money(now.ai)}
          change={change(now.ai, before.ai)}
          upIsGood={false}
          badge={data.totals.ai_estimated_cents > 0 ? 'Estimado' : undefined}
          info="Custo do fornecedor por geração: medido quando o fornecedor informa o uso, estimado pela tabela de preço quando não informa. Geração sem custo cadastrado conta zero e aparece no aviso."
          hint={data.totals.ai_unknown_events > 0 ? `${data.totals.ai_unknown_events} gerações sem custo cadastrado` : undefined}
          spark={spark((point) => point.ai_cents)}
          sparkColor={SERIES_COLORS[2]}
        />
        <MetricCard
          label="Lucro líquido"
          value={money(now.profit)}
          change={change(now.profit, before.profit)}
          tone={now.profit < 0 ? 'bad' : undefined}
          badge={provisional ? 'Provisório' : undefined}
          info="Receita bruta menos reembolsos e todas as despesas registradas. Fica marcado como provisório enquanto faltar custo registrado (veja o aviso abaixo)."
          spark={data.series.map((point) => (point.gross_cents - point.refunds_cents - point.expenses_cents) / 100)}
        />
        <MetricCard
          label="Margem de lucro"
          value={pct(now.margin)}
          info="Lucro líquido sobre a receita depois dos reembolsos."
          hint={points(now.margin, before.margin) ?? undefined}
          tone={now.margin !== null && now.margin < 0 ? 'bad' : undefined}
          badge={provisional ? 'Provisório' : undefined}
        />
        <MetricCard
          label="Pagamentos pendentes"
          value={money(now.pending)}
          change={change(now.pending, before.pending)}
          upIsGood={false}
          info="Checkouts abertos e não pagos, mais renovações vencidas. Não entram na receita até o Asaas confirmar."
          hint={data.totals.overdue_cents > 0 ? `${money(data.totals.overdue_cents)} vencidos` : 'Nada vencido'}
        />
        <MetricCard
          label="Reembolsos"
          value={money(now.refunds)}
          change={change(now.refunds, before.refunds)}
          upIsGood={false}
          info="Estornos no recorte, na data em que o Asaas avisou (ou na data do pagamento, quando o aviso não trouxe a data)."
          hint={now.gross > 0 ? `${((now.refunds / now.gross) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% da receita bruta` : undefined}
        />
      </MetricGrid>
      {provisional && (
        <div role="note" className="flex gap-3 rounded-2xl bg-amber-400/[0.06] p-4 text-sm ring-1 ring-amber-300/20">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-300" aria-hidden="true" />
          <div>
            <p className="font-semibold text-amber-100">Lucro e margem ainda não são definitivos</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-amber-100/80">
              {reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  )
}
