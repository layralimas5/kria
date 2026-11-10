import clsx from 'clsx'
import { RotateCcw, SlidersHorizontal } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { PeriodFilter } from '@/components/admin/dashboard/PeriodFilter'
import { type Granularity } from '@/domain/commandCenter'
import {
  ALL_FEATURES,
  CATEGORY_LABELS,
  EXPENSE_CATEGORIES,
  activeFilterCount,
  clearFilters,
  featureName,
  METHOD_LABELS,
  MOVEMENT_TYPES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  REVENUE_SOURCES,
  SOURCE_LABELS,
  STATUS_LABELS,
  TYPE_LABELS,
  type Explorer,
  type ExplorerFilters,
  type ListKey,
} from '@/domain/financeExplorer'
import { MultiSelect, type Option } from './MultiSelect'
import { SavedFilters } from './SavedFilters'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
const INPUT =
  'min-h-9 w-full rounded-lg border border-white/[0.08] bg-surface px-3 text-[13px] text-zinc-100 placeholder:text-zinc-500 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20'

const GRANULARITIES: readonly { value: Granularity; label: string }[] = [
  { value: 'day', label: 'Diário' },
  { value: 'week', label: 'Semanal' },
  { value: 'month', label: 'Mensal' },
]

const fromLabels = <K extends string>(keys: readonly K[], labels: Readonly<Record<K, string>>): Option[] => keys.map((key) => ({ value: key, label: labels[key] }))

/** Texto digitado vira filtro depois de uma pausa: não consulta o banco a cada tecla. */
function useDebounced(value: string, onCommit: (value: string) => void, delay = 400) {
  const [draft, setDraft] = useState(value)
  const commit = useRef(onCommit)
  commit.current = onCommit
  useEffect(() => setDraft(value), [value])
  useEffect(() => {
    if (draft === value) return
    const timer = window.setTimeout(() => commit.current(draft), delay)
    return () => window.clearTimeout(timer)
  }, [draft, value, delay])
  return [draft, setDraft] as const
}

interface FilterBarProps {
  readonly filters: ExplorerFilters
  readonly onChange: (filters: ExplorerFilters) => void
  readonly options: Explorer['options'] | null
  readonly invalidPeriod: boolean
  readonly invalidRange: string | null
}

export function FilterBar({ filters, onChange, options, invalidPeriod, invalidRange }: FilterBarProps) {
  const set = (patch: Partial<ExplorerFilters>) => onChange({ ...filters, ...patch })
  const setList = (key: ListKey) => (value: string[]) => onChange({ ...filters, [key]: value })
  const [user, setUser] = useDebounced(filters.user, (value) => set({ user: value }))
  const [min, setMin] = useDebounced(filters.minBrl, (value) => set({ minBrl: value.trim() }))
  const [max, setMax] = useDebounced(filters.maxBrl, (value) => set({ maxBrl: value.trim() }))
  const active = activeFilterCount(filters)
  const [expanded, setExpanded] = useState(false)
  const advancedId = useId()

  const planOptions: Option[] = (options?.plans ?? []).map((plan) => ({ value: plan.slug, label: plan.name, hint: plan.status === 'live' ? undefined : 'antigo' }))
  const modelOptions: Option[] = (options?.ai_models ?? [])
    .filter((model) => filters.aiProviders.length === 0 || filters.aiProviders.includes(model.provider))
    .map((model) => ({ value: model.slug, label: model.name, hint: model.provider }))

  return (
    <section aria-label="Filtros" className="space-y-3 rounded-2xl bg-surface/60 p-3 ring-1 ring-white/[0.06] sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PeriodFilter
          key={`${filters.start}:${filters.end}`}
          preset={filters.preset}
          custom={{ start: filters.start, end: filters.end }}
          invalid={invalidPeriod}
          onPreset={(preset) => set({ preset })}
          onCustom={(range) => set({ preset: 'custom', start: range.start, end: range.end })}
        />
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-[13px] text-zinc-400">
            Comparar com
            <select
              value={filters.compare}
              onChange={(event) => set({ compare: event.target.value === 'year' ? 'year' : 'previous' })}
              className={clsx(INPUT, 'w-auto [color-scheme:dark]')}
            >
              <option value="previous">período anterior</option>
              <option value="year">mesmo período do ano passado</option>
            </select>
          </label>
          <div role="radiogroup" aria-label="Agrupar gráficos" className="flex gap-1 rounded-xl bg-surface p-1 ring-1 ring-white/[0.06]">
            {GRANULARITIES.map((item) => (
              <button
                key={item.value}
                type="button"
                role="radio"
                aria-checked={filters.granularity === item.value}
                onClick={() => set({ granularity: item.value })}
                className={clsx(
                  'min-h-8 rounded-lg px-3 text-[13px] font-semibold transition-colors',
                  FOCUS,
                  filters.granularity === item.value ? 'bg-white/[0.09] text-zinc-50' : 'text-zinc-400 hover:text-zinc-100',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-controls={advancedId}
        className={clsx('inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-surface text-[13px] font-semibold text-zinc-200 ring-1 ring-white/[0.08] md:hidden', FOCUS)}
      >
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        {expanded ? 'Esconder filtros' : 'Filtros'}
        {active > 0 && <span className="rounded-md bg-accent/20 px-1.5 text-xs text-accent-soft">{active}</span>}
      </button>

      <div id={advancedId} className={clsx('space-y-3 md:block', expanded ? 'block' : 'hidden')}>
        <div className="flex flex-wrap items-center gap-2">
          <MultiSelect label="Tipo" options={fromLabels(MOVEMENT_TYPES, TYPE_LABELS)} value={filters.types} onChange={setList('types')} />
          <MultiSelect label="Status" options={fromLabels(PAYMENT_STATUSES, STATUS_LABELS)} value={filters.statuses} onChange={setList('statuses')} />
          <MultiSelect label="Plano" options={planOptions} value={filters.plans} onChange={setList('plans')} />
          <MultiSelect label="Origem" options={fromLabels(REVENUE_SOURCES, SOURCE_LABELS)} value={filters.sources} onChange={setList('sources')} />
          <MultiSelect label="Despesa" options={fromLabels(EXPENSE_CATEGORIES, CATEGORY_LABELS)} value={filters.categories} onChange={setList('categories')} />
          <MultiSelect label="Provedor" options={(options?.ai_providers ?? []).map((provider) => ({ value: provider, label: provider }))} value={filters.aiProviders} onChange={setList('aiProviders')} />
          <MultiSelect label="Modelo" options={modelOptions} value={filters.aiModels} onChange={setList('aiModels')} />
          <MultiSelect label="Funcionalidade" options={ALL_FEATURES.map((feature) => ({ value: feature, label: featureName(feature) }))} value={filters.aiFeatures} onChange={setList('aiFeatures')} />
          <MultiSelect label="Pagamento" options={fromLabels(PAYMENT_METHODS, METHOD_LABELS)} value={filters.methods} onChange={setList('methods')} />
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)_minmax(0,0.6fr)_auto]">
          <label className="block">
            <span className="sr-only">Cliente</span>
            <input
              type="search"
              value={user}
              onChange={(event) => setUser(event.target.value)}
              placeholder={options && !options.can_filter_user ? 'Busca por cliente exige acesso a usuários' : 'Cliente (parte do e-mail)'}
              disabled={options ? !options.can_filter_user : false}
              maxLength={120}
              className={INPUT}
            />
          </label>
          <label className="block">
            <span className="sr-only">Valor mínimo em reais</span>
            <input inputMode="decimal" value={min} onChange={(event) => setMin(event.target.value)} placeholder="Valor mín. (R$)" className={INPUT} />
          </label>
          <label className="block">
            <span className="sr-only">Valor máximo em reais</span>
            <input inputMode="decimal" value={max} onChange={(event) => setMax(event.target.value)} placeholder="Valor máx. (R$)" className={INPUT} />
          </label>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-1">
            <SavedFilters filters={filters} onApply={onChange} />
            <button
              type="button"
              onClick={() => onChange(clearFilters(filters))}
              disabled={active === 0}
              className={clsx(
                'inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                FOCUS,
                'text-zinc-300 hover:bg-white/[0.06] hover:text-zinc-50',
              )}
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Limpar filtros{active > 0 ? ` (${active})` : ''}
            </button>
          </div>
        </div>
      </div>
      {invalidRange && (
        <p role="alert" className="text-xs text-red-300">
          {invalidRange}
        </p>
      )}
      <p className="text-xs text-zinc-500">
        Os filtros valem juntos para indicadores, gráficos e tabela. Filtro de uma dimensão tira as linhas que não a têm: escolher um plano, por exemplo, deixa de fora as despesas fixas.
      </p>
    </section>
  )
}
