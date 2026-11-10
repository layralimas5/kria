import clsx from 'clsx'
import { motion, useReducedMotion } from 'framer-motion'
import { Activity, Coins, CreditCard, Loader } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Sparkline } from '@/components/admin/charts/Sparkline'
import { SERIES_COLORS } from '@/components/admin/charts/chartColors'
import { formatCredits, formatDate } from '@/domain/format'
import type { Cycle } from '@/domain/home'
import { STATUS_LABELS } from '@/domain/plans'
import type { Usage } from '@/domain/spendGuard'
import type { Plan, Subscription, Wallet } from '@/domain/types'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

function StatCard({ icon, label, to, children, index }: { icon: ReactNode; label: string; to: string | null; children: ReactNode; index: number }) {
  const reduceMotion = useReducedMotion()
  const content = (
    <>
      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500 sm:text-[11px]">
        <span className="grid size-6 place-items-center rounded-lg bg-accent/15 text-accent-soft">{icon}</span>
        {label}
      </p>
      <div className="mt-3 flex flex-1 flex-col sm:mt-4">{children}</div>
    </>
  )
  return (
    <motion.li
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
      className="min-w-0"
    >
      {to ? (
        <Link to={to} className={clsx('card-premium card-hover group flex h-full flex-col rounded-3xl p-4 sm:p-5', FOCUS)}>
          {content}
        </Link>
      ) : (
        <div className="card-premium flex h-full flex-col rounded-3xl p-4 sm:p-5">{content}</div>
      )}
    </motion.li>
  )
}

/** Barra fina de progresso com o texto ao lado; a leitura não depende da cor. */
function Meter({ value, label, tone = 'accent' }: { value: number; label: string; tone?: 'accent' | 'warn' }) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <div className="mt-auto pt-3 sm:pt-4">
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={clsx('h-full rounded-full', tone === 'warn' ? 'bg-hot' : 'bg-gradient-to-r from-accent to-accent-soft')} style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-zinc-500 sm:text-xs">{label}</p>
    </div>
  )
}

interface HomeStatsProps {
  readonly wallet: Pick<Wallet, 'balance' | 'subscription_balance' | 'purchased_balance'> | null
  readonly plan: Pick<Plan, 'name' | 'max_concurrent'> | null
  readonly subscription: (Pick<Subscription, 'current_period_end'> & { readonly status: string }) | null
  readonly usage: Pick<Usage, 'used_month' | 'monthly_limit'> | null
  readonly cycle: Cycle | null
  /** Quantas criações da mais barata o saldo paga. */
  readonly yieldCount: number | null
  readonly running: number
  readonly lastDays: readonly number[]
  /** No "ver como usuário" do admin os cards não levam para as telas do app. */
  readonly linked?: boolean
}

export function HomeStats({ wallet, plan, subscription, usage, cycle, yieldCount, running, lastDays, linked = true }: HomeStatsProps) {
  const link = (to: string) => (linked ? to : null)
  const renewal = subscription?.current_period_end
  const monthShare = usage?.monthly_limit ? usage.used_month / usage.monthly_limit : null
  const created = lastDays.reduce((sum, value) => sum + value, 0)

  return (
    <section aria-label="Resumo da conta">
      <ul className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <StatCard index={0} icon={<Coins className="size-3.5" aria-hidden="true" />} label="Créditos" to={link('/creditos')}>
          <p className="font-headline text-3xl sm:text-4xl tabular-nums text-zinc-50">{wallet ? wallet.balance.toLocaleString('pt-BR') : '...'}</p>
          <p className="mt-1 text-[11px] leading-snug text-zinc-500 sm:text-xs">
            {yieldCount !== null ? `Rende cerca de ${yieldCount.toLocaleString('pt-BR')} ${yieldCount === 1 ? 'imagem' : 'imagens'}` : 'Disponíveis agora'}
            {wallet && wallet.purchased_balance > 0 && ` · ${formatCredits(wallet.purchased_balance)} comprados`}
          </p>
          {monthShare !== null && usage?.monthly_limit && (
            <Meter
              value={monthShare}
              tone={monthShare >= 0.85 ? 'warn' : 'accent'}
              label={`${usage.used_month.toLocaleString('pt-BR')} de ${usage.monthly_limit.toLocaleString('pt-BR')} usados no mês`}
            />
          )}
        </StatCard>

        <StatCard index={1} icon={<CreditCard className="size-3.5" aria-hidden="true" />} label="Plano" to={link('/assinatura')}>
          <p className="font-headline text-3xl sm:text-4xl text-zinc-50">{plan?.name ?? '...'}</p>
          <p className="mt-1 text-[11px] leading-snug text-zinc-500 sm:text-xs">
            {subscription && renewal
              ? subscription.status === 'canceled'
                ? `Cancelado, vale até ${formatDate(renewal)}`
                : subscription.status === 'past_due'
                  ? STATUS_LABELS.past_due
                  : `Renova em ${formatDate(renewal)}`
              : 'Assine e receba créditos todo mês'}
          </p>
          {cycle && subscription?.status !== 'past_due' && (
            <Meter value={cycle.elapsed} label={cycle.daysLeft === 0 ? 'Renova hoje' : `${cycle.daysLeft} ${cycle.daysLeft === 1 ? 'dia' : 'dias'} para ${subscription?.status === 'canceled' ? 'acabar' : 'renovar'}`} />
          )}
        </StatCard>

        <StatCard index={2} icon={<Activity className="size-3.5" aria-hidden="true" />} label="Últimos 14 dias" to={link('/galeria')}>
          <div className="flex items-end justify-between gap-3">
            <p className="font-headline text-3xl sm:text-4xl tabular-nums text-zinc-50">{created}</p>
            {created > 0 && <Sparkline values={lastDays} color={SERIES_COLORS[0]} />}
          </div>
          <p className="mt-1 text-[11px] leading-snug text-zinc-500 sm:text-xs">{created === 1 ? 'criação concluída' : 'criações concluídas'}</p>
        </StatCard>

        <StatCard index={3} icon={<Loader className="size-3.5" aria-hidden="true" />} label="Gerando agora" to={link('/galeria')}>
          <p className="flex items-center gap-3 font-headline text-3xl sm:text-4xl tabular-nums text-zinc-50">
            {running}
            {running > 0 && (
              <span className="relative flex size-2.5" aria-hidden="true">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex size-2.5 rounded-full bg-emerald-400" />
              </span>
            )}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-zinc-500 sm:text-xs">
            {running === 0 ? 'Nada na fila' : `Até ${plan?.max_concurrent ?? '...'} ao mesmo tempo no seu plano`}
          </p>
        </StatCard>
      </ul>
    </section>
  )
}
