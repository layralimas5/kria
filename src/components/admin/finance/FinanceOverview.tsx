import { change } from '@/domain/adminDashboard'
import { userProfitability, usdToCents, type Finance, type FinanceModel, type Statement, type UserProfitability } from '@/domain/finance'
import { formatBRL } from '@/domain/format'
import { GRID, Section } from '../dashboard/DashboardSections'
import { StatTile } from '../dashboard/StatTile'
import { DataTable, type Column } from './DataTable'
import { formatNumber as number, formatPercent as percent } from './format'
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
          <StatTile label="Créditos consumidos" value={number(finance.credits_consumed)} hint="Gerações que deram certo no período" />
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
    {
      key: 'margin',
      label: 'Margem no uso integral',
      align: 'right',
      render: (plan) =>
        plan.full_use_margin === null ? (
          '–'
        ) : (
          <span className={plan.full_use_margin < finance.settings.min_margin_rate ? 'font-semibold text-red-300' : undefined}>{percent(plan.full_use_margin)}</span>
        ),
    },
  ]
  return (
    <Section title="Receita por plano" description="Orçamento de IA é parâmetro interno por assinante no mês, nunca mostrado ao cliente.">
      <DataTable
        caption="Receita por plano"
        rows={finance.by_plan}
        columns={columns}
        rowKey={(plan) => plan.slug}
        rowTone={(plan) => (plan.full_use_margin !== null && plan.full_use_margin < finance.settings.min_margin_rate ? 'bad' : undefined)}
        empty="Nenhum plano com assinante."
      />
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
    { key: 'avg', label: 'Custo por geração', align: 'right', render: (model) => (model.billed > 0 ? formatBRL(Math.round(cost(model) / model.billed)) : '–') },
    { key: 'quoted', label: 'Previsto', align: 'right', render: (model) => formatBRL(usdToCents(model.quoted_cost_usd, finance.usd_brl)) },
    { key: 'cost', label: 'Custo real', align: 'right', render: (model) => formatBRL(cost(model)) },
    { key: 'credits', label: 'Créditos', align: 'right', render: (model) => number(model.credits) },
    {
      key: 'basis',
      label: 'Base do custo',
      render: (model) =>
        model.estimated > 0
          ? `Estimado em ${number(model.estimated)}`
          : model.reconciled > 0
            ? `Real em ${number(model.reconciled)}`
            : model.trusted
              ? 'Tarifa conferida'
              : 'Tarifa a conferir',
    },
    { key: 'deficit', label: 'Deficitárias', align: 'right', render: (model) => number(model.deficit) },
  ]
  return (
    <Section
      title="Rentabilidade por modelo"
      description="Previsto = tarifa × configuração na hora de autorizar. Real = tokens medidos (texto) ou tarifa (foto e vídeo). Deficitária = custo acima do que os créditos cobrados cobrem."
    >
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

/** Custo de IA somado por fornecedor no período. */
export function ProviderCostTable({ finance }: { readonly finance: Finance }) {
  const byProvider = new Map<string, { provider: string; total: number; billed: number; credits: number; costUsd: number }>()
  for (const model of finance.by_model) {
    const row = byProvider.get(model.provider) ?? { provider: model.provider, total: 0, billed: 0, credits: 0, costUsd: 0 }
    byProvider.set(model.provider, { ...row, total: row.total + model.total, billed: row.billed + model.billed, credits: row.credits + model.credits, costUsd: row.costUsd + model.cost_usd })
  }
  const rows = [...byProvider.values()].filter((row) => row.total > 0).sort((a, b) => b.costUsd - a.costUsd)
  const columns: Column<(typeof rows)[number]>[] = [
    { key: 'provider', label: 'Fornecedor', render: (row) => row.provider },
    { key: 'total', label: 'Gerações', align: 'right', render: (row) => number(row.total) },
    { key: 'credits', label: 'Créditos', align: 'right', render: (row) => number(row.credits) },
    { key: 'cost', label: 'Custo', align: 'right', render: (row) => formatBRL(usdToCents(row.costUsd, finance.usd_brl)) },
    { key: 'avg', label: 'Por geração', align: 'right', render: (row) => (row.billed > 0 ? formatBRL(Math.round(usdToCents(row.costUsd, finance.usd_brl) / row.billed)) : '–') },
  ]
  return (
    <Section title="Custo por fornecedor">
      <DataTable caption="Custo por fornecedor" rows={rows} columns={columns} rowKey={(row) => row.provider} empty="Nenhuma geração no período." />
    </Section>
  )
}

const MEGABYTE = 1024 * 1024

/** Multiplicador: montagem no navegador, cota própria. O custo de processamento é o da premissa por exportação. */
export function MultiplierSection({ finance }: { readonly finance: Finance }) {
  const done = finance.exports_done
  const attempts = done + finance.exports_failed
  const resolutions = Object.entries(finance.export_resolutions).sort((a, b) => b[1] - a[1])
  return (
    <Section
      title="Multiplicador"
      description="A montagem roda no navegador da pessoa e o arquivo não sobe: o custo de servidor é zero até existir render próprio. Falha e cancelamento devolvem a exportação."
    >
      <div className={GRID}>
        <StatTile label="Exportações concluídas" value={number(done)} />
        <StatTile
          label="Exportações com falha"
          value={number(finance.exports_failed)}
          tone={attempts > 0 && finance.exports_failed / attempts >= 0.2 ? 'bad' : undefined}
          hint={attempts > 0 ? `${percent(finance.exports_failed / attempts)} das tentativas` : undefined}
        />
        <StatTile label="Montagem média" value={done > 0 ? `${(finance.export_render_ms / done / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} s` : '–'} />
        <StatTile label="Vídeo médio" value={done > 0 ? `${(finance.export_seconds / done).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} s` : '–'} />
        <StatTile label="Arquivos gerados" value={`${(finance.export_bytes / MEGABYTE).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} MB`} hint="Baixados pela pessoa, não armazenados" />
        <StatTile label="Custo operacional estimado" value={formatBRL(done * finance.settings.render_cost_cents_per_export)} hint="Premissa por exportação × concluídas" />
        <StatTile label="Resoluções" value={resolutions.length === 0 ? '–' : resolutions[0]![0]} hint={resolutions.map(([size, total]) => `${size}: ${number(total)}`).join(' · ') || undefined} />
      </div>
    </Section>
  )
}
