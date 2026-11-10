import clsx from 'clsx'
import { Check, ChevronDown } from 'lucide-react'
import { Popover } from '@/components/ui/Popover'

export interface Option {
  readonly value: string
  readonly label: string
  readonly hint?: string
}

interface MultiSelectProps {
  readonly label: string
  readonly options: readonly Option[]
  readonly value: readonly string[]
  readonly onChange: (value: string[]) => void
}

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

/** Filtro de várias escolhas: o botão mostra quantas estão marcadas; vazio = todas. */
export function MultiSelect({ label, options, value, onChange }: MultiSelectProps) {
  const selected = new Set(value)
  const toggle = (item: string) => onChange(selected.has(item) ? value.filter((entry) => entry !== item) : [...value, item])
  const summary = value.length === 0 ? 'Todos' : value.length === 1 ? (options.find((option) => option.value === value[0])?.label ?? value[0]) : `${value.length} selecionados`

  return (
    <Popover
      label={label}
      side="bottom"
      className="w-64"
      trigger={({ open, toggle: toggleOpen, controls }) => (
        <button
          type="button"
          onClick={toggleOpen}
          aria-expanded={open}
          aria-controls={controls}
          aria-haspopup="dialog"
          className={clsx(
            'inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-lg px-3 text-[13px] ring-1 transition-colors',
            FOCUS,
            value.length > 0 ? 'bg-accent/10 text-zinc-50 ring-accent/40' : 'bg-surface text-zinc-300 ring-white/[0.08] hover:ring-white/20',
          )}
        >
          <span className="font-semibold text-zinc-400">{label}:</span>
          <span className="truncate">{summary}</span>
          <ChevronDown className={clsx('size-3.5 shrink-0 transition-transform', open && 'rotate-180')} aria-hidden="true" />
        </button>
      )}
    >
      {() => (
        <div>
          <fieldset className="max-h-72 space-y-0.5 overflow-y-auto">
            <legend className="sr-only">
              {label}
            </legend>
            {options.length === 0 && <p className="px-2 py-1.5 text-sm text-zinc-500">Nada para escolher ainda.</p>}
            {options.map((option) => {
              const checked = selected.has(option.value)
              return (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-zinc-200 hover:bg-white/[0.05] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent"
                >
                  <input type="checkbox" checked={checked} onChange={() => toggle(option.value)} className="peer sr-only" />
                  <span
                    aria-hidden="true"
                    className={clsx('grid size-4 shrink-0 place-items-center rounded border', checked ? 'border-accent bg-accent text-accent-ink' : 'border-white/20')}
                  >
                    {checked && <Check className="size-3" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {option.hint && <span className="shrink-0 text-xs text-zinc-500">{option.hint}</span>}
                </label>
              )
            })}
          </fieldset>
          {value.length > 0 && (
            <button type="button" onClick={() => onChange([])} className={clsx('mt-1 w-full rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-accent-soft hover:bg-white/[0.05]', FOCUS)}>
              Limpar {label.toLowerCase()}
            </button>
          )}
        </div>
      )}
    </Popover>
  )
}
