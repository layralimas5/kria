import type { ReactNode } from 'react'

export interface BarRow {
  readonly key: string
  readonly label: string
  readonly value: number
  /** Texto à direita; por padrão, o próprio valor. */
  readonly display?: string
  readonly detail?: ReactNode
}

interface BarListProps {
  readonly title: string
  readonly rows: readonly BarRow[]
  readonly color: string
  readonly emptyText: string
}

/** Barras horizontais com o valor escrito em cada linha: comparação de tamanho sem depender de tooltip. */
export function BarList({ title, rows, color, emptyText }: BarListProps) {
  const max = Math.max(0, ...rows.map((row) => row.value))
  return (
    <section aria-label={title} className="min-w-0 card-premium rounded-2xl p-4">
      <h3 className="text-sm font-bold text-zinc-200">{title}</h3>
      {rows.length === 0 || max === 0 ? (
        <p className="py-8 text-center text-xs text-zinc-500">{emptyText}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {rows.map((row) => (
            <li key={row.key} className="text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate font-semibold text-zinc-200">{row.label}</span>
                <span className="shrink-0 tabular-nums text-zinc-300">{row.display ?? row.value.toLocaleString('pt-BR')}</span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-white/[0.04]" aria-hidden="true">
                <div className="h-2 rounded-r-[4px]" style={{ width: `${(row.value / max) * 100}%`, backgroundColor: color }} />
              </div>
              {row.detail && <p className="mt-1 text-xs text-zinc-500">{row.detail}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
