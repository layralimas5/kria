import clsx from 'clsx'
import type { FormatField } from '@/domain/formats'

interface ChoicePillsProps {
  readonly field: FormatField
  readonly value: string | undefined
  readonly onChange: (value: string) => void
}

/** Uma opção do formato como grupo de rádio em pílulas. */
export function ChoicePills({ field, value, onChange }: ChoicePillsProps) {
  return (
    <fieldset>
      <legend className="mb-2 text-[13px] font-semibold text-zinc-300">{field.label}</legend>
      <div className="flex flex-wrap gap-2">
        {field.choices.map((choice) => {
          const checked = value === choice.value
          return (
            <label key={choice.value} className="cursor-pointer">
              <input
                type="radio"
                name={field.key}
                checked={checked}
                onChange={() => onChange(choice.value)}
                className="peer sr-only"
              />
              <span
                className={clsx(
                  'inline-flex min-h-9 items-center rounded-full px-3.5 text-sm ring-1 transition-colors',
                  'peer-focus-visible:ring-2 peer-focus-visible:ring-accent',
                  checked ? 'bg-accent/15 text-accent-soft ring-accent/50' : 'bg-surface-2 text-zinc-400 ring-white/[0.08] hover:text-zinc-100',
                )}
              >
                {choice.label}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
