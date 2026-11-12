import clsx from 'clsx'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Columns3, Search } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { money } from '@/components/admin/center/format'
import { Popover } from '@/components/ui/Popover'
import {
  formatDateTime,
  methodLabel,
  MOVEMENT_COLUMNS,
  movementCategory,
  signedCents,
  statusLabel,
  typeLabel,
  type Explorer,
  type Movement,
  type MovementColumn,
} from '@/domain/financeExplorer'
import { PAGE_SIZES, type SortKey, type TableState } from '@/hooks/useFinanceExplorer'
import { ExportButtons } from './ExportButtons'
import { MovementDrawer } from './MovementDrawer'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
const COLUMNS_KEY = 'vynkio.finance.columns'
const DEFAULT_COLUMNS: readonly MovementColumn[] = ['occurred_at', 'user', 'description', 'category', 'plan', 'type', 'amount', 'status', 'method']

/** Coluna que o banco sabe ordenar. */
const SORTABLE: Partial<Record<MovementColumn, SortKey>> = {
  occurred_at: 'occurred_at',
  user: 'email',
  plan: 'plan_slug',
  type: 'type',
  amount: 'amount_cents',
  status: 'status',
}

const STATUS_TONES: Readonly<Record<string, string>> = {
  paid: 'bg-emerald-400/10 text-emerald-300',
  pending: 'bg-amber-400/10 text-amber-200',
  overdue: 'bg-red-400/10 text-red-300',
  canceled: 'bg-white/[0.06] text-zinc-400',
  refunded: 'bg-sky-400/10 text-sky-300',
}

/** Colunas escolhidas ficam no navegador de quem escolheu; sem acesso ao armazenamento, vale o padrão. */
function useColumns(): [readonly MovementColumn[], (next: readonly MovementColumn[]) => void] {
  const [columns, setColumns] = useState<readonly MovementColumn[]>(() => {
    try {
      const raw = window.localStorage.getItem(COLUMNS_KEY)
      const parsed: unknown = raw ? JSON.parse(raw) : null
      if (Array.isArray(parsed)) {
        const valid = MOVEMENT_COLUMNS.map((column) => column.id).filter((id) => parsed.includes(id))
        if (valid.length > 0) return valid
      }
    } catch {
      // Navegador sem armazenamento (aba anônima, bloqueio): segue com o padrão.
    }
    return DEFAULT_COLUMNS
  })
  const update = (next: readonly MovementColumn[]) => {
    setColumns(next)
    try {
      window.localStorage.setItem(COLUMNS_KEY, JSON.stringify(next))
    } catch {
      // Sem armazenamento: a escolha vale só nesta visita.
    }
  }
  return [columns, update]
}

function Amount({ row }: { readonly row: Movement }) {
  const signed = signedCents(row)
  if (row.type === 'adjustment') {
    return <span className="text-zinc-400">{row.credits !== null ? `${row.credits > 0 ? '+' : ''}${row.credits} créditos` : '–'}</span>
  }
  return (
    <span className={clsx('font-semibold tabular-nums', signed < 0 ? 'text-red-300' : signed > 0 ? 'text-emerald-300' : 'text-zinc-400')}>
      {signed < 0 ? '−' : signed > 0 ? '+' : ''}
      {money(row.amount_cents)}
    </span>
  )
}

function cell(column: MovementColumn, row: Movement, planName: (slug: string | null) => string): ReactNode {
  switch (column) {
    case 'occurred_at':
      return <span className="whitespace-nowrap tabular-nums">{formatDateTime(row.occurred_at)}</span>
    case 'user':
      return <span className="block max-w-[200px] truncate">{row.email ?? (row.user_id ? `Conta ${row.user_id.slice(0, 8)}` : '–')}</span>
    case 'description':
      return <span className="block max-w-[280px] truncate text-zinc-100">{row.description}</span>
    case 'category':
      return movementCategory(row)
    case 'plan':
      return planName(row.plan_slug)
    case 'type':
      return typeLabel(row.type)
    case 'amount':
      return <Amount row={row} />
    case 'status':
      return <span className={clsx('whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-bold', STATUS_TONES[row.status] ?? 'text-zinc-400')}>{statusLabel(row.status)}</span>
    case 'method':
      return row.method ? methodLabel(row.method) : '–'
    case 'reference':
      return <span className="block max-w-[160px] truncate font-mono text-xs text-zinc-400">{row.reference ?? row.id}</span>
  }
}

interface MovementsTableProps {
  readonly data: Explorer
  readonly table: TableState
  readonly onTable: (next: TableState) => void
  readonly loading: boolean
  readonly loadAll: () => Promise<{ rows: Movement[]; total: number; data: Explorer } | null>
}

export function MovementsTable({ data, table, onTable, loading, loadAll }: MovementsTableProps) {
  const [columns, setColumns] = useColumns()
  const [open, setOpen] = useState<Movement | null>(null)
  const [search, setSearch] = useState(table.search)
  const captionId = useId()
  const latest = useRef({ table, onTable })
  latest.current = { table, onTable }
  const planName = (slug: string | null) => data.options.plans.find((plan) => plan.slug === slug)?.name ?? slug ?? '–'
  const { total, rows } = data.table
  const pages = Math.max(1, Math.ceil(total / table.pageSize))
  const first = total === 0 ? 0 : (table.page - 1) * table.pageSize + 1
  const last = Math.min(total, table.page * table.pageSize)

  // Busca com pausa: digitação rápida não vira uma consulta por tecla.
  useEffect(() => {
    if (search === latest.current.table.search) return
    const timer = window.setTimeout(() => latest.current.onTable({ ...latest.current.table, search, page: 1 }), 350)
    return () => window.clearTimeout(timer)
  }, [search])

  function sortBy(key: SortKey) {
    const dir = table.sort === key && table.dir === 'desc' ? 'asc' : 'desc'
    onTable({ ...table, sort: key, dir, page: 1 })
  }

  const visible = MOVEMENT_COLUMNS.filter((column) => columns.includes(column.id))

  return (
    <section aria-labelledby="movements-title" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="movements-title" className="font-headline text-2xl text-zinc-50">
            Movimentações
          </h2>
          <p className="mt-1 text-sm text-zinc-400">Cada entrada e saída do recorte. Clique numa linha para ver o detalhe.</p>
        </div>
        <ExportButtons data={data} loadAll={loadAll} planName={planName} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1 sm:max-w-sm">
          <span className="sr-only">Buscar nas movimentações</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            maxLength={120}
            placeholder="Descrição, identificador ou e-mail"
            className="min-h-9 w-full rounded-lg border border-white/[0.08] bg-surface pl-9 pr-3 text-[13px] text-zinc-100 placeholder:text-zinc-500 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </label>
        <Popover
          label="Colunas visíveis"
          side="bottom"
          align="end"
          className="w-60"
          trigger={({ open: isOpen, toggle, controls }) => (
            <button
              type="button"
              onClick={toggle}
              aria-expanded={isOpen}
              aria-controls={controls}
              aria-haspopup="dialog"
              className={clsx('inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-surface px-3 text-[13px] font-semibold text-zinc-200 ring-1 ring-white/[0.08] hover:ring-white/20', FOCUS)}
            >
              <Columns3 className="size-3.5" aria-hidden="true" />
              Colunas
            </button>
          )}
        >
          {() => (
            <fieldset className="space-y-0.5">
              <legend className="px-2 pb-1 text-xs font-semibold text-zinc-400">Mostrar na tabela</legend>
              {MOVEMENT_COLUMNS.map((column) => {
                const checked = columns.includes(column.id)
                return (
                  <label key={column.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-zinc-200 hover:bg-white/[0.05]">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={checked && columns.length === 1}
                      onChange={() => setColumns(checked ? columns.filter((id) => id !== column.id) : [...columns, column.id])}
                      className="size-4 accent-[var(--color-accent)]"
                    />
                    {column.label}
                  </label>
                )
              })}
            </fieldset>
          )}
        </Popover>
      </div>

      {rows.length === 0 ? (
        <p className="card-premium rounded-2xl px-4 py-8 text-center text-sm text-zinc-500">
          {table.search ? 'Nenhuma movimentação com essa busca.' : 'Nenhuma movimentação no recorte. Amplie o período ou limpe os filtros.'}
        </p>
      ) : (
        <div
          role="region"
          aria-labelledby={captionId}
          tabIndex={0}
          className={clsx('relative overflow-x-auto rounded-2xl ring-1 ring-white/[0.06] transition-opacity', FOCUS, loading && 'opacity-60')}
        >
          <table className="w-full min-w-[760px] text-left text-sm">
            <caption id={captionId} className="sr-only">
              Movimentações do recorte, página {table.page} de {pages}
            </caption>
            <thead className="border-b border-white/[0.06] bg-white/[0.025] text-[11px] uppercase tracking-wider text-zinc-500">
              <tr>
                {visible.map((column) => {
                  const key = SORTABLE[column.id]
                  const active = key !== undefined && table.sort === key
                  return (
                    <th
                      key={column.id}
                      scope="col"
                      aria-sort={active ? (table.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                      className={clsx('px-3 py-2.5 font-semibold', column.id === 'amount' && 'text-right')}
                    >
                      {key ? (
                        <button type="button" onClick={() => sortBy(key)} className={clsx('inline-flex items-center gap-1 rounded hover:text-zinc-100', FOCUS, active && 'text-zinc-100')}>
                          {column.label}
                          {active && (table.dir === 'asc' ? <ArrowUp className="size-3" aria-hidden="true" /> : <ArrowDown className="size-3" aria-hidden="true" />)}
                        </button>
                      ) : (
                        column.label
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {rows.map((row) => (
                <tr
                  key={row.id}
                  tabIndex={0}
                  onClick={() => setOpen(row)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setOpen(row)
                    }
                  }}
                  aria-label={`${row.description}, ${formatDateTime(row.occurred_at)}. Abrir detalhe`}
                  className={clsx('cursor-pointer transition-colors hover:bg-white/[0.03] focus-visible:bg-white/[0.05]', FOCUS)}
                >
                  {visible.map((column) => (
                    <td key={column.id} className={clsx('px-3 py-2.5 text-zinc-300', column.id === 'amount' && 'text-right')}>
                      {cell(column.id, row, planName)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <nav aria-label="Páginas das movimentações" className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-zinc-400">
        <p aria-live="polite">
          {total === 0 ? 'Nenhuma linha' : `${first.toLocaleString('pt-BR')}–${last.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')}`}
        </p>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5">
            Por página
            <select
              value={table.pageSize}
              onChange={(event) => onTable({ ...table, pageSize: Number(event.target.value), page: 1 })}
              className="min-h-9 rounded-lg border border-white/[0.08] bg-surface px-2 text-[13px] text-zinc-100 [color-scheme:dark]"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => onTable({ ...table, page: table.page - 1 })}
            disabled={table.page <= 1}
            aria-label="Página anterior"
            className={clsx('grid size-9 place-items-center rounded-lg ring-1 ring-white/[0.08] hover:bg-white/[0.05] disabled:opacity-40', FOCUS)}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <span className="tabular-nums">
            {table.page} / {pages}
          </span>
          <button
            type="button"
            onClick={() => onTable({ ...table, page: table.page + 1 })}
            disabled={table.page >= pages}
            aria-label="Próxima página"
            className={clsx('grid size-9 place-items-center rounded-lg ring-1 ring-white/[0.08] hover:bg-white/[0.05] disabled:opacity-40', FOCUS)}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </nav>

      <MovementDrawer movement={open} planName={planName} onClose={() => setOpen(null)} />
    </section>
  )
}
