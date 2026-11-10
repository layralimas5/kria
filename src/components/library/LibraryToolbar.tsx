import clsx from 'clsx'
import { LayoutGrid, Rows3, Search, X } from 'lucide-react'
import { useId } from 'react'
import { EMPTY_QUERY, isFiltered, type LibraryKind, type LibraryQuery, type LibrarySort, type LibraryStatus } from '@/domain/library'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
const SELECT = clsx('min-h-10 rounded-xl border border-white/[0.08] bg-surface-2 px-3 text-[13px] font-semibold text-zinc-200 hover:border-white/15', FOCUS)

export type Density = 'comfortable' | 'compact'

const KINDS: readonly { value: LibraryKind; label: string }[] = [
  { value: 'all', label: 'Tudo' },
  { value: 'image', label: 'Imagens' },
  { value: 'video', label: 'Vídeos' },
]

const STATUSES: readonly { value: LibraryStatus; label: string }[] = [
  { value: 'all', label: 'Qualquer status' },
  { value: 'ready', label: 'Prontas' },
  { value: 'running', label: 'Em produção' },
  { value: 'failed', label: 'Com falha' },
]

const SORTS: readonly { value: LibrarySort; label: string }[] = [
  { value: 'newest', label: 'Mais recentes' },
  { value: 'oldest', label: 'Mais antigas' },
]

interface LibraryToolbarProps {
  readonly query: LibraryQuery
  readonly onChange: (query: LibraryQuery) => void
  readonly counts: Readonly<Record<LibraryKind, number>>
  readonly models: readonly { readonly slug: string; readonly name: string }[]
  readonly density: Density
  readonly onDensity: (density: Density) => void
}

function pick<T extends string>(options: readonly { value: T }[], raw: string): T | undefined {
  return options.find((option) => option.value === raw)?.value
}

export function LibraryToolbar({ query, onChange, counts, models, density, onDensity }: LibraryToolbarProps) {
  const searchId = useId()
  const set = (patch: Partial<LibraryQuery>) => onChange({ ...query, ...patch })

  return (
    <div className="glass-bar sticky top-0 z-20 md:top-14 -mx-4 space-y-3 border-b border-white/[0.05] px-4 py-3 sm:-mx-5 sm:px-5 lg:mx-0 lg:rounded-2xl lg:border lg:border-white/[0.06] lg:px-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-60">
          <label htmlFor={searchId} className="sr-only">
            Buscar pelo pedido
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
          <input
            id={searchId}
            type="search"
            value={query.search}
            onChange={(event) => set({ search: event.target.value })}
            placeholder="Buscar pelo pedido: café, praia, produto..."
            className="min-h-10 w-full rounded-xl border border-white/[0.08] bg-surface-2 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>

        <div role="radiogroup" aria-label="Tipo" className="inline-flex rounded-xl bg-surface-2 p-1 ring-1 ring-white/[0.06]">
          {KINDS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={query.kind === value}
              onClick={() => set({ kind: value })}
              className={clsx(
                'inline-flex min-h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold transition-colors',
                FOCUS,
                query.kind === value ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-400 hover:text-zinc-100',
              )}
            >
              {label}
              <span className="tabular-nums opacity-60">{counts[value]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Modelo" value={query.model ?? ''} onChange={(event) => set({ model: event.target.value || null })} className={SELECT}>
          <option value="">Todos os modelos</option>
          {models.map((model) => (
            <option key={model.slug} value={model.slug}>
              {model.name}
            </option>
          ))}
        </select>
        <select aria-label="Status" value={query.status} onChange={(event) => set({ status: pick(STATUSES, event.target.value) ?? 'all' })} className={SELECT}>
          {STATUSES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select aria-label="Ordem" value={query.sort} onChange={(event) => set({ sort: pick(SORTS, event.target.value) ?? 'newest' })} className={SELECT}>
          {SORTS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {isFiltered(query) && (
          <button type="button" onClick={() => onChange(EMPTY_QUERY)} className={clsx('inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100', FOCUS)}>
            <X className="size-3.5" aria-hidden="true" /> Limpar
          </button>
        )}

        <div role="radiogroup" aria-label="Tamanho das miniaturas" className="ml-auto hidden rounded-xl bg-surface-2 p-1 ring-1 ring-white/[0.06] sm:inline-flex">
          {(
            [
              { value: 'comfortable', label: 'Miniaturas grandes', icon: LayoutGrid },
              { value: 'compact', label: 'Miniaturas pequenas', icon: Rows3 },
            ] as const
          ).map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={density === value}
              aria-label={label}
              title={label}
              onClick={() => onDensity(value)}
              className={clsx('grid size-8 place-items-center rounded-lg transition-colors', FOCUS, density === value ? 'bg-white/[0.1] text-zinc-50' : 'text-zinc-500 hover:text-zinc-200')}
            >
              <Icon className="size-4" aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
