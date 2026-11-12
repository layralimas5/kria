import clsx from 'clsx'
import { useState } from 'react'
import { defaultGranularity, moneySeries, periodDays, type CenterData, type FinancialSummary, type Granularity } from '@/domain/commandCenter'
import { formatBRL } from '@/domain/format'
import { NEUTRAL_COLOR, SERIES_COLORS } from '../charts/chartColors'
import { ComboChart } from '../charts/ComboChart'
import { DonutChart } from '../charts/DonutChart'
import { ExpensesPanel } from '../analytics/ExpensesPanel'
import { LineChart } from '../charts/LineChart'
import { CenterSection, Insufficient } from './CenterLayout'
import { axisBrl, moneyFromBrl, pct } from './format'

const [VIOLET, GOLD, SKY, PINK] = SERIES_COLORS

const GRANULARITY_LABELS: Readonly<Record<Granularity, string>> = { day: 'Dia', week: 'Semana', month: 'Mês' }

function GranularityToggle({ value, onChange }: { readonly value: Granularity; readonly onChange: (value: Granularity) => void }) {
  return (
    <div role="radiogroup" aria-label="Agrupar por" className="flex gap-1 rounded-xl bg-surface p-1 ring-1 ring-white/[0.06] print:hidden">
      {(Object.keys(GRANULARITY_LABELS) as Granularity[]).map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          onClick={() => onChange(option)}
          className={clsx(
            'min-h-8 rounded-lg px-3 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            value === option ? 'bg-white/[0.09] text-zinc-50' : 'text-zinc-400 hover:text-zinc-100',
          )}
        >
          {GRANULARITY_LABELS[option]}
        </button>
      ))}
    </div>
  )
}

/** Faturamento, custos, lucro e margens, com granularidade escolhida pela pessoa. */
export function FinanceSection({ data, onChanged }: { readonly data: CenterData; readonly onChanged: () => void }) {
  const [choice, setChoice] = useState<Granularity | null>(null)
  const granularity = choice ?? defaultGranularity(periodDays(data.center))
  const { summary, dashboard, business } = data

  return (
    <CenterSection
      id="financeiro"
      title="Financeiro"
      question="Quanto o Vynkio faturou, quanto custou para entregar e quanto sobrou."
      actions={summary ? <GranularityToggle value={granularity} onChange={setChoice} /> : undefined}
    >
      {!summary || !dashboard.finance ? (
        <Insufficient title="Financeiro restrito">Receita, custos e lucro aparecem para quem tem acesso ao financeiro.</Insufficient>
      ) : (
        <>
          <Statement summary={summary} />
          <div className="grid gap-4 xl:grid-cols-2">
            <RevenueChart data={data} granularity={granularity} />
            <ComboChart
              title="Receita × custos × lucro"
              lines={[
                { key: 'received', label: 'Receita recebida', color: GOLD },
                { key: 'profit', label: 'Lucro estimado', color: VIOLET },
              ]}
              bars={[
                { key: 'ai', label: 'Custo de IA', color: PINK },
                { key: 'fees', label: 'Taxas de pagamento', color: SKY },
                { key: 'other', label: 'Outros custos', color: NEUTRAL_COLOR },
              ]}
              points={moneySeries(data.center, business, granularity).map((point) => ({
                key: point.key,
                values: { received: point.net + point.fees, profit: point.profit, ai: point.ai, fees: point.fees, other: point.other },
              }))}
              format={axisBrl}
            />
            <DonutChart
              title="Distribuição da receita no período"
              centerLabel="recebido"
              format={(cents) => formatBRL(cents)}
              emptyText="Nenhum pagamento no período."
              slices={[
                ...dashboard.finance.by_plan.map((plan, index) => ({
                  key: plan.slug,
                  label: plan.name,
                  value: plan.received_cents,
                  color: [VIOLET, GOLD, SKY, PINK][index % 4] ?? VIOLET,
                })),
                { key: 'packs', label: 'Pacotes de créditos', value: dashboard.finance.pack_received_cents, color: NEUTRAL_COLOR },
              ]}
            />
            <LineChart
              title="MRR nos últimos 12 meses"
              series={[{ key: 'mrr', label: 'MRR', color: VIOLET }]}
              points={(business.money?.mrr_series ?? []).map((point) => ({ key: point.month, values: { mrr: point.mrr_cents / 100 } }))}
              format={axisBrl}
              area
            />
          </div>
          {business.money && <ExpensesPanel expenses={business.money.expenses} totalCents={business.money.expenses_cents} onChanged={onChanged} />}
        </>
      )}
    </CenterSection>
  )
}

function RevenueChart({ data, granularity }: { readonly data: CenterData; readonly granularity: Granularity }) {
  const points = moneySeries(data.center, data.business, granularity)
  return (
    <LineChart
      title="Evolução da receita"
      tall
      series={[
        { key: 'gross', label: 'Receita bruta', color: GOLD },
        { key: 'net', label: 'Receita líquida', color: VIOLET },
        { key: 'previous', label: 'Bruta no período anterior', color: NEUTRAL_COLOR, dashed: true },
      ]}
      points={points.map((point) => ({ key: point.key, values: { gross: point.gross, net: point.net, previous: point.previous } }))}
      format={axisBrl}
      area
    />
  )
}

function Statement({ summary }: { readonly summary: FinancialSummary }) {
  const received = summary.grossCents - summary.refundsCents
  const rows: { label: string; cents: number; strong?: boolean; hint?: string }[] = [
    { label: 'Receita bruta', cents: summary.grossCents, hint: 'mensalidades e pacotes pagos' },
    { label: '− Reembolsos', cents: -summary.refundsCents },
    { label: '− Taxas de pagamento', cents: -summary.feesCents, hint: 'estimadas pela taxa cadastrada' },
    { label: '= Receita líquida', cents: summary.netCents, strong: true },
    { label: '− Custo de IA', cents: -summary.aiCostCents, hint: 'registrado por geração' },
    { label: '= Margem de contribuição', cents: summary.contributionCents, strong: true, hint: pct(summary.contributionMargin) ?? undefined },
    { label: '− Despesas registradas', cents: -summary.otherCostsCents, hint: 'lançadas em Despesas' },
    { label: '= Lucro operacional estimado', cents: summary.profitCents, strong: true, hint: pct(summary.profitMargin) ?? undefined },
  ]
  return (
    <section aria-labelledby="statement-title" className="card-premium rounded-2xl p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="statement-title" className="text-sm font-bold text-zinc-200">
          Demonstrativo do período
        </h3>
        <p className="text-xs text-zinc-500">
          {received > 0 ? `Cada R$ 100 recebidos deixaram ${moneyFromBrl((summary.profitCents / received) * 100)} de lucro estimado.` : 'Sem recebimento no período.'}
        </p>
      </div>
      <dl className="mt-3 grid gap-x-8 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className={clsx('flex items-baseline justify-between gap-3 border-b border-white/[0.04] py-2', row.strong && 'font-semibold')}>
            <dt className={row.strong ? 'text-zinc-100' : 'text-zinc-400'}>
              {row.label}
              {row.hint && <span className="ml-2 text-[11px] font-normal text-zinc-500">{row.hint}</span>}
            </dt>
            <dd className={clsx('tabular-nums', row.cents < 0 && !row.strong ? 'text-zinc-300' : row.cents < 0 ? 'text-red-300' : 'text-zinc-50')}>
              {formatBRL(row.cents)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
