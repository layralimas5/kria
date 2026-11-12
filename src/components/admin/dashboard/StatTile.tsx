import clsx from 'clsx'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import type { ReactNode } from 'react'

interface StatTileProps {
  readonly label: string
  readonly value: ReactNode
  readonly hint?: ReactNode
  /** Variação contra o período anterior (0,25 = +25%); nula sem base. */
  readonly change?: number | null
  /** Se subir é bom (receita) ou ruim (falhas, cancelamentos). */
  readonly upIsGood?: boolean
  readonly tone?: 'bad' | 'good'
}

export function StatTile({ label, value, hint, change, upIsGood = true, tone }: StatTileProps) {
  const hasChange = change !== undefined && change !== null && Number.isFinite(change) && change !== 0
  const good = hasChange && (change > 0) === upIsGood
  return (
    <div className="min-w-0 card-premium rounded-2xl p-4">
      <p className="text-[12px] font-semibold text-zinc-400">{label}</p>
      <p className={clsx('mt-1.5 truncate text-2xl font-semibold', tone === 'bad' ? 'text-red-300' : tone === 'good' ? 'text-accent-soft' : 'text-zinc-50')}>
        {value}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500">
        {hasChange && (
          <span className={clsx('inline-flex items-center gap-0.5 font-semibold', good ? 'text-emerald-300' : 'text-red-300')}>
            {change > 0 ? <ArrowUpRight className="size-3.5" aria-hidden="true" /> : <ArrowDownRight className="size-3.5" aria-hidden="true" />}
            {change > 0 ? '+' : ''}
            {Math.round(change * 100)}%<span className="sr-only"> contra o período anterior</span>
          </span>
        )}
        {hint && <span>{hint}</span>}
      </div>
    </div>
  )
}
