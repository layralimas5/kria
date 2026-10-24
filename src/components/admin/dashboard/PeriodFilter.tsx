import clsx from 'clsx'
import { useState, type FormEvent } from 'react'
import { PERIOD_LABELS, PERIOD_PRESETS, type PeriodPreset } from '@/domain/adminDashboard'
import { Button } from '../../ui/Button'

export interface CustomRange {
  readonly start: string
  readonly end: string
}

interface PeriodFilterProps {
  readonly preset: PeriodPreset
  readonly custom: CustomRange
  readonly invalid: boolean
  readonly onPreset: (preset: PeriodPreset) => void
  readonly onCustom: (range: CustomRange) => void
}

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
const DATE_INPUT =
  'min-h-9 rounded-lg border border-white/[0.08] bg-surface-2 px-2.5 text-sm text-zinc-100 [color-scheme:dark] focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20'

/** Uma linha acima de tudo: o período vale para todos os números e gráficos da página. */
export function PeriodFilter({ preset, custom, invalid, onPreset, onCustom }: PeriodFilterProps) {
  const [draft, setDraft] = useState<CustomRange>(custom)

  function apply(event: FormEvent) {
    event.preventDefault()
    onCustom(draft)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div role="radiogroup" aria-label="Período" className="flex flex-wrap gap-1 rounded-xl bg-surface p-1 ring-1 ring-white/[0.06]">
        {PERIOD_PRESETS.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={preset === value}
            onClick={() => onPreset(value)}
            className={clsx(
              'min-h-8 rounded-lg px-3 text-[13px] font-semibold transition-colors',
              FOCUS,
              preset === value ? 'bg-white/[0.09] text-zinc-50' : 'text-zinc-400 hover:text-zinc-100',
            )}
          >
            {PERIOD_LABELS[value]}
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        <form onSubmit={apply} className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-zinc-400">
            De
            <input type="date" required value={draft.start} onChange={(event) => setDraft({ ...draft, start: event.target.value })} className={DATE_INPUT} />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-zinc-400">
            até
            <input type="date" required value={draft.end} onChange={(event) => setDraft({ ...draft, end: event.target.value })} className={DATE_INPUT} />
          </label>
          <Button type="submit" variant="secondary" className="min-h-9">
            Aplicar
          </Button>
          {invalid && (
            <p role="alert" className="w-full text-xs text-red-300">
              Escolha uma data inicial antes da final, com até um ano entre elas.
            </p>
          )}
        </form>
      )}
    </div>
  )
}
