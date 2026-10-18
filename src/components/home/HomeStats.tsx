import clsx from 'clsx'
import { Coins, CreditCard, Loader } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { formatCredits, formatDate } from '@/domain/format'
import { STATUS_LABELS } from '@/domain/plans'
import type { Plan, Subscription, Wallet } from '@/domain/types'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

function StatCard({ icon, label, to, children }: { icon: ReactNode; label: string; to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className={clsx('group rounded-3xl bg-surface p-5 ring-1 ring-white/[0.06] transition-colors hover:bg-surface-2', FOCUS)}
    >
      <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
        <span className="text-accent">{icon}</span>
        {label}
      </p>
      <div className="mt-3">{children}</div>
    </Link>
  )
}

interface HomeStatsProps {
  readonly wallet: Wallet | null
  readonly plan: Plan | null
  readonly subscription: Subscription | null
  readonly running: number
}

export function HomeStats({ wallet, plan, subscription, running }: HomeStatsProps) {
  const renewal = subscription?.current_period_end
  return (
    <section aria-label="Resumo da conta" className="grid gap-3 sm:grid-cols-3">
      <StatCard icon={<Coins className="size-4" aria-hidden="true" />} label="Créditos disponíveis" to="/creditos">
        <p className="font-headline text-4xl tabular-nums text-zinc-50">{wallet ? wallet.balance.toLocaleString('pt-BR') : '...'}</p>
        {wallet && wallet.subscription_balance > 0 && (
          <p className="mt-1 text-xs text-zinc-500">
            {formatCredits(wallet.subscription_balance)} do plano · {formatCredits(wallet.purchased_balance)} comprados
          </p>
        )}
      </StatCard>

      <StatCard icon={<CreditCard className="size-4" aria-hidden="true" />} label="Plano atual" to="/assinatura">
        <p className="font-headline text-4xl text-zinc-50">{plan?.name ?? '...'}</p>
        <p className="mt-1 text-xs text-zinc-500">
          {subscription && renewal
            ? subscription.status === 'canceled'
              ? `Cancelado, vale até ${formatDate(renewal)}`
              : subscription.status === 'past_due'
                ? STATUS_LABELS.past_due
                : `Renova em ${formatDate(renewal)}`
            : 'Assine e receba créditos todo mês'}
        </p>
      </StatCard>

      <StatCard icon={<Loader className="size-4" aria-hidden="true" />} label="Em andamento" to="/galeria">
        <p className="font-headline text-4xl tabular-nums text-zinc-50">{running}</p>
        <p className="mt-1 text-xs text-zinc-500">
          {running === 0 ? 'Nada gerando agora' : `Até ${plan?.max_concurrent ?? '...'} ao mesmo tempo no seu plano`}
        </p>
      </StatCard>
    </section>
  )
}
