import { useId } from 'react'

interface SelectFieldProps<T extends string> {
  readonly label: string
  readonly value: T
  readonly onChange: (value: T) => void
  readonly options: readonly { readonly value: T; readonly label: string }[]
  readonly hint?: string
  readonly disabled?: boolean
}

export function SelectField<T extends string>({ label, value, onChange, options, hint, disabled }: SelectFieldProps<T>) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-zinc-300">
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(event) => {
          const chosen = options.find((option) => option.value === event.target.value)
          if (chosen) onChange(chosen.value)
        }}
        className="min-h-11 w-full rounded-xl border border-white/[0.08] bg-surface-2 px-3 text-[15px] text-zinc-100 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-60"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-zinc-500">
          {hint}
        </p>
      )}
    </div>
  )
}
