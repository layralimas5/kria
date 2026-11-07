import clsx from 'clsx'
import { guardLevel, usedShare, type GuardLevel } from '@/domain/spendGuard'

const BAR: Record<GuardLevel, string> = {
  unlimited: 'bg-accent',
  ok: 'bg-accent',
  warning: 'bg-hot',
  reached: 'bg-red-400',
}

interface UsageMeterProps {
  readonly label: string
  readonly used: number
  readonly limit: number | null
  readonly alertRatio: number
  readonly format: (value: number) => string
  readonly footnote?: string
}

/** Barra de consumo contra um limite. Sem limite, mostra só o usado. */
export function UsageMeter({ label, used, limit, alertRatio, format, footnote }: UsageMeterProps) {
  const level = guardLevel(used, limit, alertRatio)
  const share = usedShare(used, limit)
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-semibold text-zinc-300">{label}</span>
        <span className={clsx('tabular-nums', level === 'reached' ? 'font-bold text-red-300' : 'text-zinc-400')}>
          {format(used)}
          {limit !== null && <span className="text-zinc-500"> de {format(limit)}</span>}
        </span>
      </div>
      {limit === null ? (
        <p className="text-xs text-zinc-500">Sem limite</p>
      ) : (
        <div
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-valuenow={Math.min(used, limit)}
          aria-valuetext={`${format(used)} de ${format(limit)}`}
          className="h-2 overflow-hidden rounded-full bg-white/[0.06]"
        >
          <div className={clsx('h-full rounded-full transition-[width] motion-reduce:transition-none', BAR[level])} style={{ width: `${share * 100}%` }} />
        </div>
      )}
      {footnote && <p className="text-xs text-zinc-500">{footnote}</p>}
    </div>
  )
}
