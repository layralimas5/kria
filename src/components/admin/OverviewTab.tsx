import clsx from 'clsx'
import type { ReactNode } from 'react'
import { formatBRL } from '@/domain/format'
import { costInBrl } from '@/domain/pricing'
import { useQuery } from '@/hooks/useQuery'
import { fetchOverview, type Overview } from '@/lib/adminApi'
import { Notice } from '../ui/Notice'
import { Spinner } from '../ui/Spinner'

/** Taxa média do Asaas sobre o recebido (cartão à vista ~3%). Estimativa, ajustar com o extrato real. */
const PAYMENT_FEE_RATE = 0.035

function Kpi({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: 'bad' | 'good' }) {
  return (
    <div className="rounded-2xl bg-surface p-4 ring-1 ring-white/[0.06]">
      <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={clsx('mt-2 text-2xl font-bold tabular-nums', tone === 'bad' ? 'text-red-300' : tone === 'good' ? 'text-accent' : 'text-zinc-50')}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  )
}

function finance(overview: Overview) {
  const revenueCents = overview.subscription_revenue_30d_cents + overview.pack_revenue_30d_cents
  const feesCents = Math.round(revenueCents * PAYMENT_FEE_RATE)
  const apiCostCents = Math.round(costInBrl(overview.api_cost_usd_30d, overview.pricing) * 100)
  const marginCents = revenueCents - feesCents - apiCostCents
  return { revenueCents, feesCents, apiCostCents, marginCents }
}

export function OverviewTab() {
  const overview = useQuery(fetchOverview, 'Não deu para carregar os números.')

  if (overview.loading && !overview.data) {
    return (
      <div className="grid place-items-center py-16 text-zinc-500" role="status" aria-label="Carregando">
        <Spinner className="size-6" />
      </div>
    )
  }
  if (overview.error || !overview.data) return <Notice tone="error">{overview.error ?? 'Sem dados.'}</Notice>

  const data = overview.data
  const money = finance(data)

  return (
    <div className="space-y-8">
      <section aria-label="Assinaturas" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Usuários" value={data.total_users.toLocaleString('pt-BR')} hint={`${data.new_users_30d} novos em 30 dias`} />
        <Kpi label="Assinantes ativos" value={data.active_subscribers} hint={`${data.past_due} em atraso`} />
        <Kpi label="Receita recorrente (MRR)" value={formatBRL(data.mrr_cents)} />
        <Kpi label="Assinaturas / cancelamentos" value={`${data.new_subscriptions_30d} / ${data.cancellations_30d}`} hint="Últimos 30 dias" />
      </section>

      <section aria-labelledby="finance-title" className="space-y-3">
        <h2 id="finance-title" className="font-headline text-lg text-zinc-100">
          Financeiro (30 dias)
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Kpi label="Receita bruta" value={formatBRL(money.revenueCents)} hint={`Planos ${formatBRL(data.subscription_revenue_30d_cents)} · pacotes ${formatBRL(data.pack_revenue_30d_cents)}`} />
          <Kpi label="Taxas de pagamento" value={formatBRL(money.feesCents)} hint={`Estimativa de ${(PAYMENT_FEE_RATE * 100).toFixed(1)}%`} />
          <Kpi
            label="Custo das APIs"
            value={formatBRL(money.apiCostCents)}
            hint={data.api_cost_unknown_30d > 0 ? `${data.api_cost_unknown_30d} gerações sem custo cadastrado` : `US$ ${data.api_cost_usd_30d.toFixed(2)}`}
            tone={data.api_cost_unknown_30d > 0 ? 'bad' : undefined}
          />
          <Kpi label="Margem estimada" value={formatBRL(money.marginCents)} tone={money.marginCents < 0 ? 'bad' : 'good'} hint="Sem armazenamento e custos fixos" />
          <Kpi label="Créditos consumidos" value={data.credits_consumed_30d.toLocaleString('pt-BR')} hint={`${data.generations_30d} gerações, ${data.generations_failed_30d} falharam`} />
        </div>
        {money.marginCents < 0 && <Notice tone="error">Alerta de prejuízo: o custo estimado passou da receita nos últimos 30 dias. Revise preços em Modelos.</Notice>}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="plans-revenue-title">
          <h2 id="plans-revenue-title" className="font-headline mb-3 text-lg text-zinc-100">
            Receita por plano
          </h2>
          <ul className="divide-y divide-white/[0.05] overflow-hidden rounded-2xl bg-surface ring-1 ring-white/[0.06]">
            {data.revenue_by_plan.map((row) => (
              <li key={row.slug} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="font-semibold text-zinc-200">{row.name}</span>
                <span className="tabular-nums text-zinc-400">
                  {row.subscribers} assinantes · <span className="font-bold text-zinc-200">{formatBRL(row.mrr_cents)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="models-usage-title">
          <h2 id="models-usage-title" className="font-headline mb-3 text-lg text-zinc-100">
            Gerações e erros por modelo
          </h2>
          <ul className="divide-y divide-white/[0.05] overflow-hidden rounded-2xl bg-surface ring-1 ring-white/[0.06]">
            {data.by_model.map((row) => {
              const failRate = row.total > 0 ? row.failed / row.total : 0
              return (
                <li key={row.model_slug} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-zinc-200">{row.model_slug}</span>
                    <span className="text-xs text-zinc-500">
                      {row.provider} · {row.credits.toLocaleString('pt-BR')} créditos · US$ {row.cost_usd.toFixed(2)}
                    </span>
                  </span>
                  <span className={clsx('shrink-0 tabular-nums', failRate > 0.2 ? 'text-red-300' : 'text-zinc-400')}>
                    {row.total} · {row.failed} erros
                  </span>
                </li>
              )
            })}
            {data.by_model.length === 0 && <li className="px-4 py-6 text-center text-sm text-zinc-500">Sem gerações nos últimos 30 dias.</li>}
          </ul>
        </section>
      </div>
    </div>
  )
}
