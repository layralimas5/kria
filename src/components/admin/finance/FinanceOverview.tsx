import { change } from '@/domain/adminDashboard'
import { userProfitability, usdToCents, type Finance, type FinanceModel, type Statement, type UserProfitability } from '@/domain/finance'
import { formatBRL } from '@/domain/format'
import { GRID, Section } from '../dashboard/DashboardSections'
import { StatTile } from '../dashboard/StatTile'
import { DataTable, type Column } from './DataTable'

const percent = (value: number | null) => (value === null ? '–' : `${(value * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`)
const number = (value: number) => value.toLocaleString('pt-BR')
const tone = (cents: number) => (cents < 0 ? 'bad' : undefined)

const STATUS_LABEL = { draft: 'Rascunho', live: 'À venda', legacy: 'Antigo' } as const

/** Do faturamento ao distribuível, sem pular camada. */
export function StatementSection({ finance, statement }: { readonly finance: Finance; readonly statement: Statement }) {
  const estimated = finance.api_cost_estimated_count > 0
  return (
    <>
      <Section title="Receita" description="Faturamento é o que o Asaas confirmou no período. Receita recorrente é o contratado hoje. Nenhum dos dois é lucro.">
        <div className={GRID}>
          <StatTile label="Faturamento no período" value={formatBRL(finance.revenue_cents)} change={change(finance.revenue_cents, finance.revenue_previous_cents)} />
          <StatTile label="Receita recorrente (MRR)" value={formatBRL(finance.mrr_cents)} hint={`${number(finance.active_subscriptions)} assinaturas ativas`} />
          <StatTile label="Reembolsos" value={formatBRL(finance.refunds_cents)} tone={finance.refunds_cents > 0 ? 'bad' : undefined} />
          <StatTile label="Receita líquida" value={formatBRL(statement.netRevenueCents)} />
        </div>
      </Section>

      <Section
        title="Custos variáveis"
        description={`Custo de API usa o custo cadastrado do modelo${estimated ? '; o que não tem custo entra no pior caso' : ''}. Gateway e tributos são as taxas configuradas.`}
      >
        <div className={GRID}>
          <StatTile
            label="Custo das APIs"
            value={formatBRL(statement.apiCostCents)}
            change={change(finance.api_cost_usd, finance.api_cost_previous_usd)}
            upIsGood={false}
            hint={estimated ? `${number(finance.api_cost_estimated_count)} operações estimadas` : undefined}
          />
          <StatTile
            label="Renderização"
            value={formatBRL(statement.renderCents)}
            hint={`${number(finance.exports_done)} exportações · montagem no navegador`}
          />
          <StatTile label="Gateway de pagamento" value={formatBRL(statement.gatewayCents)} hint={`${percent(finance.payment_fee_rate)} da receita`} />
          <StatTile label="Tributos estimados" value={formatBRL(statement.taxesCents)} hint={`${percent(finance.settings.tax_rate)} da receita`} />
        </div>
      </Section>

      <Section title="Resultado" description="Custos mensais (fixos, infraestrutura, armazenamento, pró-labore) entram proporcionais aos dias do período.">
        <div className={GRID}>
          <StatTile
            label="Margem de contribuição"
            value={formatBRL(statement.contributionCents)}
            tone={tone(statement.contributionCents)}
            hint={`${percent(statement.contributionRate)} da receita líquida`}
          />
          <StatTile label="Despesas fixas" value={formatBRL(statement.fixedCents)} hint="Fixos, infraestrutura e armazenamento" />
          <StatTile label="Resultado operacional" value={formatBRL(statement.operatingCents)} tone={tone(statement.operatingCents)} />
          <StatTile label="Pró-labore" value={formatBRL(statement.proLaboreCents)} />
          <StatTile label="Resultado após pró-labore" value={formatBRL(statement.afterProLaboreCents)} tone={tone(statement.afterProLaboreCents)} />
          <StatTile label="Reserva financeira" value={formatBRL(statement.reserveCents)} hint={`${percent(finance.settings.reserve_rate)} do resultado positivo`} />
          <StatTile
            label="Lucro potencialmente distribuível"
            value={formatBRL(statement.distributableCents)}
            tone={statement.distributableCents > 0 ? 'good' : undefined}
            hint="Depois da reserva. Confirme com a contabilidade antes de distribuir."
          />
        </div>
      </Section>
    </>
  )
}

export function PlanRevenueTable({ finance }: { readonly finance: Finance }) {
  const columns: Column<Finance['by_plan'][number]>[] = [
    { key: 'name', label: 'Plano', render: (plan) => plan.name },
    { key: 'status', label: 'Situação', render: (plan) => STATUS_LABEL[plan.status] },
    { key: 'subscribers', label: 'Assinantes', align: 'right', render: (plan) => number(plan.subscribers) },
    { key: 'mrr', label: 'MRR', align: 'right', render: (plan) => formatBRL(plan.mrr_cents) },
    { key: 'revenue', label: 'Faturado no período', align: 'right', render: (plan) => formatBRL(plan.revenue_cents) },
    { key: 'budget', label: 'Orçamento de IA', align: 'right', render: (plan) => (plan.ai_budget_cents === null ? '–' : formatBRL(plan.ai_budget_cents)) },
  ]
  return (
    <Section title="Receita por plano" description="Orçamento de IA é parâmetro interno por assinante no mês, nunca mostrado ao cliente.">
      <DataTable caption="Receita por plano" rows={finance.by_plan} columns={columns} rowKey={(plan) => plan.slug} empty="Nenhum plano com assinante." />
    </Section>
  )
}

export function UserProfitTable({ finance }: { readonly finance: Finance }) {
  const rows = userProfitability(finance)
  const columns: Column<UserProfitability>[] = [
    { key: 'email', label: 'Conta', render: (row) => <span className="block max-w-[14rem] truncate">{row.user.email ?? row.user.user_id}</span> },
    { key: 'plan', label: 'Plano', render: (row) => row.user.plan_slug },
    { key: 'revenue', label: 'Receita', align: 'right', render: (row) => formatBRL(row.user.revenue_cents) },
    { key: 'credits', label: 'Créditos', align: 'right', render: (row) => number(row.user.credits) },
    { key: 'cost', label: 'Custo de IA', align: 'right', render: (row) => formatBRL(row.costCents) },
    { key: 'exports', label: 'Exportações', align: 'right', render: (row) => number(row.user.exports) },
    { key: 'margin', label: 'Margem', align: 'right', render: (row) => formatBRL(row.marginCents) },
    {
      key: 'budget',
      label: 'Orçamento usado',
      align: 'right',
      render: (row) => (row.budgetUse === null ? '–' : <span className={row.budgetUse >= 0.8 ? 'font-semibold text-red-300' : undefined}>{percent(row.budgetUse)}</span>),
    },
  ]
  return (
    <Section title="Rentabilidade por assinante" description="As 50 contas que mais custaram no período. Receita é o que a conta pagou no período.">
      <DataTable
        caption="Rentabilidade por assinante"
        rows={rows}
        columns={columns}
        rowKey={(row) => row.user.user_id}
        rowTone={(row) => (row.marginCents < 0 ? 'bad' : undefined)}
        empty="Nenhum consumo no período."
      />
    </Section>
  )
}

export function ModelProfitTable({ finance }: { readonly finance: Finance }) {
  const rows = finance.by_model.filter((model) => model.total > 0)
  const cost = (model: FinanceModel) => usdToCents(model.cost_usd, finance.usd_brl)
  const columns: Column<FinanceModel>[] = [
    { key: 'name', label: 'Modelo', render: (model) => model.name },
    { key: 'provider', label: 'Provedor', render: (model) => model.provider },
    { key: 'total', label: 'Gerações', align: 'right', render: (model) => `${number(model.total)}${model.failed > 0 ? ` (${number(model.failed)} ${model.failed === 1 ? 'falha' : 'falhas'})` : ''}` },
    { key: 'avg', label: 'Custo médio', align: 'right', render: (model) => (model.billed > 0 ? formatBRL(Math.round(cost(model) / model.billed)) : '–') },
    { key: 'cost', label: 'Custo total', align: 'right', render: (model) => formatBRL(cost(model)) },
    { key: 'credits', label: 'Créditos', align: 'right', render: (model) => number(model.credits) },
    {
      key: 'basis',
      label: 'Base do custo',
      render: (model) => (model.estimated > 0 ? `Estimado em ${number(model.estimated)}` : model.stale ? 'Cadastrado, conferir' : 'Conferido'),
    },
    { key: 'deficit', label: 'Deficitárias', align: 'right', render: (model) => number(model.deficit) },
  ]
  return (
    <Section title="Rentabilidade por modelo" description="Deficitária = o custo da operação passou do que os créditos cobrados cobrem.">
      <DataTable
        caption="Rentabilidade por modelo"
        rows={rows}
        columns={columns}
        rowKey={(model) => model.slug}
        rowTone={(model) => (model.deficit > 0 ? 'bad' : undefined)}
        empty="Nenhuma geração no período."
      />
    </Section>
  )
}
