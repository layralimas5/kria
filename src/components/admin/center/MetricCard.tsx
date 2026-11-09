import clsx from 'clsx'
import { ArrowDownRight, ArrowUpRight, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { InfoTip } from '../InfoTip'
import { SERIES_COLORS } from '../charts/chartColors'
import { Sparkline } from '../charts/Sparkline'

export const INSUFFICIENT = 'Dados insuficientes'

interface MetricCardProps {
  readonly label: string
  /** Nulo quando não há base: o card escreve "Dados insuficientes" em vez de um número. */
  readonly value: string | null
  /** Variação contra o período anterior (0,25 = +25%); nula sem base anterior. */
  readonly change?: number | null
  readonly upIsGood?: boolean
  readonly hint?: ReactNode
  /** Definição do número, aberta pelo ícone de informação. */
  readonly info: string
  readonly spark?: readonly number[]
  readonly sparkColor?: string
  readonly tone?: 'good' | 'bad'
  /** Selo para o que não é fato registrado: "Projeção", "Estimado". */
  readonly badge?: string
  /** Detalhe do número em outra tela. */
  readonly to?: string
}

export function MetricCard({ label, value, change, upIsGood = true, hint, info, spark, sparkColor = SERIES_COLORS[0], tone, badge, to }: MetricCardProps) {
  const hasChange = change !== undefined && change !== null && Number.isFinite(change) && change !== 0
  const good = hasChange && (change > 0) === upIsGood
  return (
    <div className="group relative flex min-w-0 flex-col rounded-2xl bg-surface p-4 ring-1 ring-white/[0.06] transition-colors hover:ring-white/[0.12]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate text-[12px] font-semibold text-zinc-400">{label}</p>
          <InfoTip label={label}>{info}</InfoTip>
        </div>
        {badge && <span className="shrink-0 rounded-md bg-hot/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-hot">{badge}</span>}
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        {value === null ? (
          <p className="text-sm font-semibold text-zinc-500">{INSUFFICIENT}</p>
        ) : (
          <p className={clsx('truncate text-2xl font-semibold tabular-nums tracking-tight', tone === 'bad' ? 'text-red-300' : tone === 'good' ? 'text-emerald-300' : 'text-zinc-50')}>
            {value}
          </p>
        )}
        {spark && <Sparkline values={spark} color={sparkColor} />}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500">
        {hasChange && (
          <span className={clsx('inline-flex items-center gap-0.5 rounded-md px-1 font-semibold', good ? 'bg-emerald-400/10 text-emerald-300' : 'bg-red-400/10 text-red-300')}>
            {change > 0 ? <ArrowUpRight className="size-3.5" aria-hidden="true" /> : <ArrowDownRight className="size-3.5" aria-hidden="true" />}
            {change > 0 ? '+' : ''}
            {(change * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%<span className="sr-only"> contra o período anterior</span>
          </span>
        )}
        {hint && <span className="min-w-0">{hint}</span>}
      </div>
      {to && (
        <Link
          to={to}
          className="mt-3 inline-flex items-center gap-0.5 self-start rounded text-[12px] font-semibold text-accent-soft hover:text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Detalhar<span className="sr-only"> {label}</span>
          <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      )}
    </div>
  )
}

export function MetricGrid({ children }: { readonly children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children}</div>
}
