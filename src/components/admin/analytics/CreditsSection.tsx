import { formatTokens, LEDGER_REASON_LABELS, ratio, type Analytics } from '@/domain/adminAnalytics'
import { SERIES_COLORS } from '../charts/chartColors'
import { ColumnChart } from '../charts/ColumnChart'
import { GRID, Section } from '../dashboard/DashboardSections'
import { StatTile } from '../dashboard/StatTile'
import { DataTable, type Column } from '../finance/DataTable'
import { formatNumber, formatPercent, formatUsd } from '../finance/format'

const [VIOLET, GOLD, SKY, PINK] = SERIES_COLORS

type Reason = Analytics['credits']['by_reason'][number]
type Spender = NonNullable<Analytics['credits']['top_spenders']>[number]
type TokenModel = Analytics['tokens']['by_model'][number]
type TokenUser = NonNullable<Analytics['tokens']['top_users']>[number]

const REASON_COLUMNS: readonly Column<Reason>[] = [
  { key: 'reason', label: 'Motivo', render: (row) => LEDGER_REASON_LABELS[row.reason] ?? row.reason },
  { key: 'entries', label: 'Lançamentos', align: 'right', render: (row) => formatNumber(row.entries) },
  { key: 'credited', label: 'Entrou', align: 'right', render: (row) => (row.credited ? `+${formatNumber(row.credited)}` : '–') },
  { key: 'debited', label: 'Saiu', align: 'right', render: (row) => (row.debited ? `-${formatNumber(row.debited)}` : '–') },
  { key: 'subscription', label: 'Saldo do plano', align: 'right', render: (row) => formatNumber(row.subscription_net) },
  { key: 'purchased', label: 'Saldo avulso', align: 'right', render: (row) => formatNumber(row.purchased_net) },
]

const SPENDER_COLUMNS: readonly Column<Spender>[] = [
  { key: 'email', label: 'Conta', render: (row) => row.email ?? row.user_id.slice(0, 8) },
  { key: 'spent', label: 'Créditos gastos', align: 'right', render: (row) => formatNumber(row.spent) },
  { key: 'generations', label: 'Gerações', align: 'right', render: (row) => formatNumber(row.generations) },
  { key: 'balance', label: 'Saldo agora', align: 'right', render: (row) => formatNumber(row.balance) },
]

function tokenModelColumns(showCost: boolean): Column<TokenModel>[] {
  const columns: Column<TokenModel>[] = [
    { key: 'name', label: 'Ferramenta de texto', render: (row) => row.name },
    { key: 'requests', label: 'Pedidos', align: 'right', render: (row) => formatNumber(row.requests) },
    { key: 'input', label: 'Tokens de entrada', align: 'right', render: (row) => formatTokens(row.input) },
    { key: 'output', label: 'Tokens de saída', align: 'right', render: (row) => formatTokens(row.output) },
    { key: 'avg', label: 'Média por pedido', align: 'right', render: (row) => (row.requests ? formatTokens(Math.round((row.input + row.output) / row.requests)) : '–') },
  ]
  if (showCost) columns.push({ key: 'cost', label: 'Custo', align: 'right', render: (row) => formatUsd(row.cost_usd) })
  return columns
}

function tokenUserColumns(showCost: boolean): Column<TokenUser>[] {
  const columns: Column<TokenUser>[] = [
    { key: 'email', label: 'Conta', render: (row) => row.email ?? row.user_id.slice(0, 8) },
    { key: 'requests', label: 'Pedidos', align: 'right', render: (row) => formatNumber(row.requests) },
    { key: 'input', label: 'Entrada', align: 'right', render: (row) => formatTokens(row.input) },
    { key: 'output', label: 'Saída', align: 'right', render: (row) => formatTokens(row.output) },
  ]
  if (showCost) columns.push({ key: 'cost', label: 'Custo', align: 'right', render: (row) => formatUsd(row.cost_usd) })
  return columns
}

function Restricted() {
  return <p className="rounded-2xl bg-surface px-4 py-6 text-sm text-zinc-500 ring-1 ring-white/[0.06]">Sua permissão não mostra contas individuais.</p>
}

/** Créditos (o que entrou, saiu e está em carteira) e tokens das ferramentas de texto. */
export function CreditsSection({ data, stale }: { readonly data: Analytics; readonly stale: boolean }) {
  const { credits, tokens } = data
  const showTokenCost = tokens.cost_usd !== null
  const measured = ratio(tokens.measured, tokens.measured + tokens.unmeasured)
  return (
    <div className="space-y-8">
      <Section title="Créditos no período" description="Entrou = plano, boas-vindas, pacote e ajuste. Gasto = gerações menos estornos de falha.">
        <div className={GRID}>
          <StatTile label="Entraram" value={formatNumber(credits.granted)} />
          <StatTile label="Gastos" value={formatNumber(credits.spent)} hint={`${formatPercent(ratio(credits.spent, credits.granted))} do que entrou`} />
          <StatTile label="Expiraram" value={formatNumber(credits.expired)} hint="sobra do plano no fim do ciclo" />
          <StatTile label="Reservados agora" value={formatNumber(credits.held)} hint="em gerações abertas" />
        </div>
        <ColumnChart
          title="Créditos que entraram e que foram gastos"
          integer
          stale={stale}
          format={formatNumber}
          series={[
            { key: 'granted', label: 'Entraram', color: GOLD },
            { key: 'spent', label: 'Gastos', color: VIOLET },
          ]}
          points={credits.series.map((day) => ({ day: day.day, values: { granted: day.granted, spent: day.spent } }))}
        />
      </Section>

      <Section title="Em carteira agora" description="Créditos que as contas ainda podem gastar: é o compromisso de custo de IA em aberto.">
        <div className={GRID}>
          <StatTile label="Total em carteira" value={formatNumber(credits.outstanding)} hint={`${formatNumber(credits.wallets_with_balance)} contas com saldo`} />
          <StatTile label="Do plano" value={formatNumber(credits.outstanding_subscription)} hint="expira no fim do ciclo" />
          <StatTile label="Avulsos" value={formatNumber(credits.outstanding_purchased)} hint="não expiram" />
        </div>
      </Section>

      <Section title="Extrato por motivo">
        <DataTable caption="Movimento de créditos por motivo" rows={credits.by_reason} columns={REASON_COLUMNS} rowKey={(row) => row.reason} empty="Nenhum lançamento no período." />
      </Section>

      <Section title="Quem mais gastou créditos">
        {credits.top_spenders === null ? <Restricted /> : <DataTable caption="Maiores consumidores" rows={credits.top_spenders} columns={SPENDER_COLUMNS} rowKey={(row) => row.user_id} empty="Ninguém gastou no período." />}
      </Section>

      <Section title="Tokens de IA (texto)" description="Medidos na resposta da Anthropic em cada pedido de roteiro, copy, ideias e Multiplicador.">
        <div className={GRID}>
          <StatTile label="Tokens de entrada" value={formatTokens(tokens.input)} />
          <StatTile label="Tokens de saída" value={formatTokens(tokens.output)} />
          <StatTile label="Custo do texto" value={showTokenCost ? formatUsd(tokens.cost_usd) : '–'} hint={showTokenCost ? undefined : 'só com permissão do financeiro'} />
          <StatTile label="Pedidos medidos" value={formatPercent(measured)} hint={tokens.unmeasured > 0 ? `${formatNumber(tokens.unmeasured)} sem medição` : 'todos medidos'} tone={tokens.unmeasured > 0 ? 'bad' : undefined} />
        </div>
        <ColumnChart
          title="Tokens por dia"
          stale={stale}
          format={formatTokens}
          series={[
            { key: 'input', label: 'Entrada', color: SKY },
            { key: 'output', label: 'Saída', color: PINK },
          ]}
          points={tokens.series.map((day) => ({ day: day.day, values: { input: day.input, output: day.output } }))}
        />
        <DataTable caption="Tokens por ferramenta" rows={tokens.by_model} columns={tokenModelColumns(showTokenCost)} rowKey={(row) => row.model_slug} empty="Nenhum pedido de texto no período." />
      </Section>

      <Section title="Quem mais usou tokens">
        {tokens.top_users === null ? <Restricted /> : <DataTable caption="Maiores usuários de tokens" rows={tokens.top_users} columns={tokenUserColumns(showTokenCost)} rowKey={(row) => row.user_id} empty="Nenhum pedido medido no período." />}
      </Section>
    </div>
  )
}
