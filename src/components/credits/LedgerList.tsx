import clsx from 'clsx'
import { CalendarClock, CreditCard, Gift, type LucideIcon, RotateCcw, Sparkles, SlidersHorizontal, Wand2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { filterLedger, REASON_LABELS, type LedgerFilter } from '@/domain/credits'
import { groupByBucket } from '@/domain/timeline'
import type { LedgerEntry, LedgerReason } from '@/domain/types'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
const time = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })

const ICONS: Record<LedgerReason, LucideIcon> = {
  signup_bonus: Gift,
  purchase: CreditCard,
  generation: Wand2,
  generation_refund: RotateCcw,
  adjustment: SlidersHorizontal,
  subscription_grant: Sparkles,
  subscription_expire: CalendarClock,
}

const FILTERS: readonly { value: LedgerFilter; label: string }[] = [
  { value: 'all', label: 'Tudo' },
  { value: 'in', label: 'Entradas' },
  { value: 'out', label: 'Saídas' },
]

const PAGE = 30

interface LedgerListProps {
  readonly entries: readonly LedgerEntry[] | null
  readonly now: Date
}

export function LedgerList({ entries, now }: LedgerListProps) {
  const [filter, setFilter] = useState<LedgerFilter>('all')
  const [shown, setShown] = useState(PAGE)
  const filtered = useMemo(() => filterLedger(entries ?? [], filter), [entries, filter])
  const groups = useMemo(() => groupByBucket(filtered.slice(0, shown), (entry) => entry.created_at, now), [filtered, shown, now])

  return (
    <section aria-labelledby="ledger-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="ledger-title" className="font-headline text-lg text-zinc-100">
            Extrato
          </h2>
          <p className="text-sm text-zinc-500">Cada crédito que entrou ou saiu, com o saldo depois.</p>
        </div>
        <div role="radiogroup" aria-label="Filtrar extrato" className="inline-flex rounded-xl bg-surface p-1 ring-1 ring-white/[0.06]">
          {FILTERS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={filter === value}
              onClick={() => {
                setFilter(value)
                setShown(PAGE)
              }}
              className={clsx('inline-flex min-h-8 items-center rounded-lg px-3 text-[13px] font-semibold transition-colors', FOCUS, filter === value ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-400 hover:text-zinc-100')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {entries === null ? (
        <div className="card-premium space-y-3 rounded-2xl p-4" aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-10 animate-pulse rounded-xl bg-white/[0.04]" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <p className="card-premium rounded-2xl px-4 py-8 text-center text-sm text-zinc-500">{filter === 'all' ? 'Sem movimentos ainda.' : 'Nenhum movimento desse tipo.'}</p>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.label}>
              <h3 className="mb-2 px-1 text-xs font-semibold first-letter:uppercase text-zinc-500">{group.label}</h3>
              <ul className="card-premium divide-y divide-white/[0.05] overflow-hidden rounded-2xl">
                {group.items.map((entry) => {
                  const Icon = ICONS[entry.reason]
                  const credit = entry.delta > 0
                  return (
                    <li key={entry.id} className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-white/[0.02]">
                      <span className={clsx('grid size-9 shrink-0 place-items-center rounded-xl ring-1 ring-white/[0.06]', credit ? 'bg-emerald-400/10 text-emerald-300' : 'bg-white/[0.04] text-zinc-300')}>
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-zinc-200">
                          {REASON_LABELS[entry.reason]}
                          {entry.note && <span className="font-normal text-zinc-500"> · {entry.note}</span>}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {time.format(new Date(entry.created_at))}
                          {entry.balance_after !== null && ` · saldo ${entry.balance_after.toLocaleString('pt-BR')}`}
                        </p>
                      </div>
                      <span className={clsx('shrink-0 font-bold tabular-nums', credit ? 'text-emerald-300' : 'text-zinc-300')}>
                        {credit ? '+' : '−'}
                        {Math.abs(entry.delta).toLocaleString('pt-BR')}
                        <span className="sr-only"> créditos</span>
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
          {filtered.length > shown && (
            <button type="button" onClick={() => setShown((count) => count + PAGE)} className={clsx('w-full rounded-xl py-2.5 text-sm font-semibold text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100', FOCUS)}>
              Mostrar mais {Math.min(PAGE, filtered.length - shown)}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
