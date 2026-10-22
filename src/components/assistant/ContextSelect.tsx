import { useId } from 'react'

interface ContextSelectProps {
  readonly label: string
  readonly emptyLabel: string
  readonly value: string | null
  readonly onChange: (value: string | null) => void
  readonly options: readonly { readonly id: string; readonly label: string }[]
}

/** Escolha de marca ou projeto: o vazio é uma opção de verdade, não um erro. */
export function ContextSelect({ label, emptyLabel, value, onChange, options }: ContextSelectProps) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-zinc-300">
        {label}
      </label>
      <select
        id={id}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value || null)}
        className="min-h-11 w-full rounded-xl border border-white/[0.08] bg-surface-2 px-3 text-[15px] text-zinc-100 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
      >
        <option value="">{emptyLabel}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
