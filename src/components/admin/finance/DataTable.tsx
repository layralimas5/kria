import clsx from 'clsx'
import { useId, type ReactNode } from 'react'

export interface Column<T> {
  readonly key: string
  readonly label: string
  readonly align?: 'left' | 'right'
  readonly render: (row: T) => ReactNode
}

interface DataTableProps<T> {
  readonly caption: string
  readonly rows: readonly T[]
  readonly columns: readonly Column<T>[]
  readonly rowKey: (row: T) => string
  readonly empty: string
  readonly rowTone?: (row: T) => 'bad' | undefined
}

/** Tabela com rolagem horizontal própria no celular (a página não rola para o lado). */
export function DataTable<T>({ caption, rows, columns, rowKey, empty, rowTone }: DataTableProps<T>) {
  const captionId = useId()
  if (rows.length === 0) return <p className="rounded-2xl bg-surface px-4 py-6 text-sm text-zinc-500 ring-1 ring-white/[0.06]">{empty}</p>
  return (
    <div role="region" aria-labelledby={captionId} tabIndex={0} className="overflow-x-auto rounded-2xl ring-1 ring-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
      <table className="w-full min-w-[640px] text-left text-sm">
        <caption id={captionId} className="sr-only">
          {caption}
        </caption>
        <thead className="bg-surface-2 text-[12px] text-zinc-400">
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={clsx('px-3 py-2.5 font-semibold', column.align === 'right' && 'text-right')}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.05] bg-surface">
          {rows.map((row) => (
            <tr key={rowKey(row)} className={clsx(rowTone?.(row) === 'bad' && 'bg-red-500/[0.06]')}>
              {columns.map((column) => (
                <td key={column.key} className={clsx('px-3 py-2.5 text-zinc-300', column.align === 'right' && 'text-right tabular-nums')}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
