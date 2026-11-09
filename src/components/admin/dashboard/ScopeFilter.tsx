import { useId } from 'react'

export const ALL_SCOPE = 'all'

export interface ScopeOption {
  readonly value: string
  readonly label: string
}

interface ScopeSelectProps {
  readonly label: string
  readonly value: string
  readonly options: readonly ScopeOption[]
  readonly onChange: (value: string) => void
}

/** Seletor compacto para a barra de filtros: cabe na mesma linha do período. */
export function ScopeSelect({ label, value, options, onChange }: ScopeSelectProps) {
  const id = useId()
  return (
    <label htmlFor={id} className="flex items-center gap-2 rounded-xl bg-surface px-3 ring-1 ring-white/[0.06]">
      <span className="text-[12px] font-semibold text-zinc-500">{label}</span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-10 max-w-[12rem] bg-transparent text-[13px] font-semibold text-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent [&>option]:bg-surface-2"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
