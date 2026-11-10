import { ArrowDownLeft, ArrowUpRight, Coins, RotateCcw } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatCredits } from '@/domain/format'
import type { ModelYield, MonthSummary } from '@/domain/credits'
import type { Wallet } from '@/domain/types'

const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'America/Sao_Paulo' })

/** Barra dividida entre o balde do plano e o comprado; a legenda carrega os números, não só a cor. */
function Buckets({ wallet }: { readonly wallet: Pick<Wallet, 'balance' | 'subscription_balance' | 'purchased_balance'> }) {
  const total = Math.max(1, wallet.subscription_balance + wallet.purchased_balance)
  const planShare = (wallet.subscription_balance / total) * 100
  return (
    <div className="mt-6">
      <div className="flex h-2 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden="true">
        <div className="h-full bg-gradient-to-r from-accent to-accent-soft" style={{ width: `${planShare}%` }} />
        <div className="h-full bg-galaxy/80" style={{ width: `${100 - planShare}%` }} />
      </div>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div className="flex items-start gap-2">
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent-soft" aria-hidden="true" />
          <div>
            <dt className="text-zinc-400">Do plano</dt>
            <dd className="font-semibold tabular-nums text-zinc-100">{formatCredits(wallet.subscription_balance)}</dd>
            <dd className="text-xs text-zinc-500">Renova a cada ciclo e não acumula</dd>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-galaxy" aria-hidden="true" />
          <div>
            <dt className="text-zinc-400">Comprados e bônus</dt>
            <dd className="font-semibold tabular-nums text-zinc-100">{formatCredits(wallet.purchased_balance)}</dd>
            <dd className="text-xs text-zinc-500">Não expiram. O plano é usado primeiro</dd>
          </div>
        </div>
      </dl>
    </div>
  )
}

function YieldLine({ yields }: { readonly yields: readonly ModelYield[] }) {
  // O melhor de cada tipo (a lista já vem do que rende mais para o que rende menos).
  const top = (['image', 'video'] as const).flatMap((kind) => yields.filter((item) => item.kind === kind && item.count > 0).slice(0, 1))
  if (top.length === 0) return <p className="mt-2 text-sm text-zinc-400">Ainda não dá para uma criação. Compre um pacote abaixo.</p>
  return (
    <p className="mt-2 text-sm text-zinc-400">
      Rende até{' '}
      {top.map((item, index) => (
        <span key={item.slug}>
          {index > 0 && <span className="text-zinc-500"> ou </span>}
          <strong className="font-semibold text-zinc-100 tabular-nums">{item.count.toLocaleString('pt-BR')}</strong> {item.kind === 'video' ? 'vídeos' : 'imagens'} {item.name}
        </span>
      ))}
    </p>
  )
}

function MonthRow({ icon, label, value, hint }: { readonly icon: ReactNode; readonly label: string; readonly value: string; readonly hint?: string }) {
  return (
    <li className="flex items-center gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/[0.04] ring-1 ring-white/[0.06]">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-zinc-400">{label}</p>
        {hint && <p className="text-xs text-zinc-500">{hint}</p>}
      </div>
      <p className="font-semibold tabular-nums text-zinc-100">{value}</p>
    </li>
  )
}

interface BalanceHeroProps {
  readonly wallet: Pick<Wallet, 'balance' | 'subscription_balance' | 'purchased_balance'> | null
  readonly yields: readonly ModelYield[]
  readonly month: MonthSummary | null
  readonly now: Date
}

export function BalanceHero({ wallet, yields, month, now }: BalanceHeroProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <section aria-labelledby="balance-title" className="card-premium relative overflow-hidden rounded-3xl p-6 sm:p-7">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-accent/25 blur-3xl" />
        <p id="balance-title" className="relative flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">
          <span className="grid size-6 place-items-center rounded-lg bg-accent/15 text-accent-soft">
            <Coins className="size-3.5" aria-hidden="true" />
          </span>
          Seu saldo
        </p>
        <div className="relative">
          {wallet ? (
            <>
              <p className="mt-4 flex items-baseline gap-2">
                <span className="font-headline text-6xl tabular-nums tracking-tight text-zinc-50 sm:text-7xl">{wallet.balance.toLocaleString('pt-BR')}</span>
                <span className="text-sm font-semibold text-zinc-400">{wallet.balance === 1 ? 'crédito' : 'créditos'}</span>
              </p>
              <YieldLine yields={yields} />
              <Buckets wallet={wallet} />
            </>
          ) : (
            <div className="mt-4 h-28 animate-pulse rounded-2xl bg-white/[0.04]" aria-label="Carregando saldo" role="status" />
          )}
        </div>
      </section>

      <section aria-labelledby="month-title" className="card-premium rounded-3xl p-6">
        <h2 id="month-title" className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">
          Movimento de {monthName.format(now)}
        </h2>
        {month ? (
          <ul className="mt-5 space-y-4">
            <MonthRow icon={<ArrowDownLeft className="size-4 text-emerald-300" aria-hidden="true" />} label="Entraram" hint="Plano, compras e bônus" value={`+${month.received.toLocaleString('pt-BR')}`} />
            <MonthRow
              icon={<ArrowUpRight className="size-4 text-accent-soft" aria-hidden="true" />}
              label="Usados em criações"
              hint={`${month.generations.toLocaleString('pt-BR')} ${month.generations === 1 ? 'geração' : 'gerações'}`}
              value={`−${month.spent.toLocaleString('pt-BR')}`}
            />
            <MonthRow icon={<RotateCcw className="size-4 text-zinc-300" aria-hidden="true" />} label="Devolvidos por falha" value={month.refunded.toLocaleString('pt-BR')} />
          </ul>
        ) : (
          <div className="mt-5 h-36 animate-pulse rounded-2xl bg-white/[0.04]" aria-hidden="true" />
        )}
      </section>
    </div>
  )
}
