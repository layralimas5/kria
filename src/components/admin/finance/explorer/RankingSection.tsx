import clsx from 'clsx'
import { Link } from 'react-router-dom'
import { money, pct } from '@/components/admin/center/format'
import { formatPointKey } from '@/components/admin/charts/LineChart'
import { DataTable } from '@/components/admin/finance/DataTable'
import { monthRows, planResults, type Explorer, type MonthRow, type PlanResult } from '@/domain/financeExplorer'

const variation = (value: number | null) =>
  value === null ? <span className="text-zinc-500">–</span> : (
    <span className={value >= 0 ? 'text-emerald-300' : 'text-red-300'}>
      {value > 0 ? '+' : ''}
      {(value * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
    </span>
  )

const signed = (cents: number) => <span className={clsx('font-semibold', cents < 0 ? 'text-red-300' : 'text-zinc-100')}>{money(cents)}</span>

function Heading({ id, title, question }: { readonly id: string; readonly title: string; readonly question: string }) {
  return (
    <div>
      <h3 id={id} className="text-base font-bold text-zinc-100">
        {title}
      </h3>
      <p className="mt-0.5 text-sm text-zinc-400">{question}</p>
    </div>
  )
}

/** Comparativo mensal, rentabilidade por plano e resultado por cliente. */
export function RankingSection({ data }: { readonly data: Explorer }) {
  const months = monthRows(data.monthly)
  const plans = planResults(data.by_plan)
  const planName = (slug: string | null) => data.options.plans.find((plan) => plan.slug === slug)?.name ?? slug ?? '–'
  const best = plans.filter((plan) => plan.margin !== null).sort((a, b) => (b.margin ?? 0) - (a.margin ?? 0))[0]

  return (
    <section aria-labelledby="ranking-title" className="space-y-6">
      <div>
        <h2 id="ranking-title" className="font-headline text-2xl text-zinc-50">
          Rentabilidade
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          Que planos e clientes dão resultado, e como cada mês se compara ao anterior.
          {best && ` Melhor margem no recorte: ${best.name} (${pct(best.margin)}).`}
        </p>
      </div>

      <div className="space-y-3" role="group" aria-labelledby="months-title">
        <Heading id="months-title" title="Comparativo mensal" question="Pelo menos os últimos seis meses até o fim do período, com os mesmos filtros." />
        <DataTable<MonthRow>
          caption="Comparativo mensal"
          rows={months}
          rowKey={(row) => row.key}
          empty="Sem meses para comparar."
          rowTone={(row) => (row.profit < 0 ? 'bad' : undefined)}
          columns={[
            { key: 'month', label: 'Mês', render: (row) => <span className="font-semibold capitalize text-zinc-100">{formatPointKey(row.key)}</span> },
            { key: 'revenue', label: 'Receita', align: 'right', render: (row) => money(row.revenue) },
            { key: 'revenue_change', label: 'vs. mês anterior', align: 'right', render: (row) => variation(row.revenueChange) },
            { key: 'expenses', label: 'Despesas', align: 'right', render: (row) => money(row.expenses) },
            { key: 'profit', label: 'Lucro', align: 'right', render: (row) => signed(row.profit) },
            { key: 'profit_change', label: 'vs. mês anterior', align: 'right', render: (row) => variation(row.profitChange) },
            { key: 'margin', label: 'Margem', align: 'right', render: (row) => pct(row.margin) ?? '–' },
          ]}
        />
      </div>

      <div className="space-y-3" role="group" aria-labelledby="plans-title">
        <Heading id="plans-title" title="Resultado por plano" question="Receita depois dos reembolsos menos IA, taxas e despesas do plano. O grátis mostra quanto custa." />
        <DataTable<PlanResult>
          caption="Resultado por plano"
          rows={plans}
          rowKey={(row) => row.slug}
          empty="Nenhum movimento ligado a plano no recorte."
          rowTone={(row) => (row.result < 0 ? 'bad' : undefined)}
          columns={[
            { key: 'name', label: 'Plano', render: (row) => <span className="font-semibold text-zinc-100">{row.name}</span> },
            { key: 'revenue', label: 'Receita', align: 'right', render: (row) => money(row.revenue) },
            { key: 'costs', label: 'Custos', align: 'right', render: (row) => money(row.costs) },
            { key: 'result', label: 'Resultado', align: 'right', render: (row) => signed(row.result) },
            { key: 'margin', label: 'Margem', align: 'right', render: (row) => pct(row.margin) ?? '–' },
            { key: 'paying', label: 'Pagantes', align: 'right', render: (row) => row.payingUsers.toLocaleString('pt-BR') },
            { key: 'users', label: 'Contas com movimento', align: 'right', render: (row) => row.users.toLocaleString('pt-BR') },
          ]}
        />
      </div>

      <div className="space-y-3" role="group" aria-labelledby="users-title">
        <Heading id="users-title" title="Resultado por cliente" question="Os 20 clientes com mais receita no recorte, com o custo que geraram." />
        <DataTable<Explorer['by_user'][number]>
          caption="Resultado por cliente"
          rows={data.by_user}
          rowKey={(row) => row.user_id}
          empty="Nenhum cliente com movimento no recorte."
          rowTone={(row) => (row.revenue_cents - row.costs_cents < 0 && row.revenue_cents > 0 ? 'bad' : undefined)}
          columns={[
            {
              key: 'user',
              label: 'Cliente',
              render: (row) => (
                <Link
                  to={`/admin/usuarios?usuario=${row.user_id}`}
                  className="rounded font-medium text-zinc-100 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {row.email ?? `Conta ${row.user_id.slice(0, 8)}`}
                </Link>
              ),
            },
            { key: 'plan', label: 'Plano', render: (row) => planName(row.plan_slug) },
            { key: 'revenue', label: 'Receita', align: 'right', render: (row) => money(row.revenue_cents) },
            { key: 'ai', label: 'Custo de IA', align: 'right', render: (row) => money(row.ai_cents) },
            { key: 'costs', label: 'Custos totais', align: 'right', render: (row) => money(row.costs_cents) },
            { key: 'result', label: 'Resultado', align: 'right', render: (row) => signed(row.revenue_cents - row.costs_cents) },
          ]}
        />
      </div>
    </section>
  )
}
