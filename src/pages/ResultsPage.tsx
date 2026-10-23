import clsx from 'clsx'
import { BarChart3, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ContextSelect } from '@/components/assistant/ContextSelect'
import { ImportPanel } from '@/components/results/ImportPanel'
import { MetricGrid } from '@/components/results/MetricGrid'
import { EmptyState } from '@/components/ui/EmptyState'
import { Notice } from '@/components/ui/Notice'
import { PageHeader } from '@/components/ui/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { ANALYTICS_PLATFORMS, PLATFORM_LABELS, summarize, topContents, type AnalyticsPlatform } from '@/domain/analytics'
import { addDays } from '@/domain/content'
import { formatDate, formatDateTime } from '@/domain/format'
import { useActiveBrand } from '@/hooks/useActiveBrand'
import { useQuery } from '@/hooks/useQuery'
import { deleteImport, errorMessage, fetchImports, fetchSnapshots } from '@/lib/api'

const PERIODS = [7, 30, 90] as const
type Period = (typeof PERIODS)[number]
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
const SELECT =
  'min-h-11 w-full rounded-xl border border-white/[0.08] bg-surface-2 px-3 text-[15px] text-zinc-100 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20'
const views = new Intl.NumberFormat('pt-BR')
const day = (iso: string) => formatDate(`${iso}T12:00:00`)

export function ResultsPage() {
  const snapshots = useQuery(fetchSnapshots, 'Não deu para carregar suas métricas.')
  const imports = useQuery(fetchImports, 'Não deu para carregar suas importações.')
  const { brands, activeBrandId } = useActiveBrand()
  const [platform, setPlatform] = useState<AnalyticsPlatform | null>(null)
  const [brandFilter, setBrandFilter] = useState<string | null>(activeBrandId)
  const [period, setPeriod] = useState<Period>(30)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const rows = useMemo(
    () => (snapshots.data ?? []).filter((row) => (platform === null || row.platform === platform) && (brandFilter === null || row.brand_id === brandFilter)),
    [snapshots.data, platform, brandFilter],
  )
  // O período termina no último dia importado: dado antigo não some só porque o mês virou.
  const end = rows.reduce((latest, row) => (row.metric_date > latest ? row.metric_date : latest), '')
  const start = end ? addDays(end, -(period - 1)) : ''
  const summaries = useMemo(() => (end ? summarize(rows, start, end, addDays(start, -period)) : []), [rows, start, end, period])
  const top = useMemo(() => (end ? topContents(rows, start, end) : []), [rows, start, end])
  const lastImport = imports.data?.[0]

  async function reload() {
    await Promise.all([snapshots.reload(), imports.reload()])
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Remover a importação de ${name}? As métricas desse arquivo saem dos resultados.`)) return
    try {
      setDeleteError(null)
      await deleteImport(id)
      await reload()
    } catch (error) {
      setDeleteError(errorMessage(error))
    }
  }

  const loading = (snapshots.loading && !snapshots.data) || (imports.loading && !imports.data)

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="Resultados" description="O desempenho das suas redes com os números que você exporta delas. Nada aqui é estimado nem inventado." />

      <Notice>
        Por enquanto os dados entram por arquivo CSV exportado da própria rede. A conexão direta com Instagram, TikTok e YouTube depende da aprovação de cada
        plataforma e chega depois.
      </Notice>

      <ImportPanel brands={brands.data ?? []} defaultBrandId={activeBrandId} onImported={reload} />

      {snapshots.error && <Notice tone="error">{snapshots.error}</Notice>}
      {imports.error && <Notice tone="error">{imports.error}</Notice>}
      {deleteError && <Notice tone="error">{deleteError}</Notice>}

      {loading ? (
        <div className="grid place-items-center py-16 text-zinc-500" role="status" aria-label="Carregando">
          <Spinner className="size-6" />
        </div>
      ) : (snapshots.data ?? []).length === 0 ? (
        <EmptyState
          icon={<BarChart3 className="size-5" aria-hidden="true" />}
          title="Nenhuma métrica ainda"
          description="Importe o primeiro CSV acima. Os indicadores aparecem com a origem e a data de cada número."
        />
      ) : (
        <>
          <section aria-labelledby="indicadores-title" className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 id="indicadores-title" className="font-headline text-xl text-zinc-50">
                  Indicadores
                </h2>
                {end ? (
                  <p className="mt-1 text-sm text-zinc-400">
                    De {day(start)} a {day(end)} (último dia importado).
                    {lastImport && (
                      <>
                        {' '}
                        Última importação: {lastImport.file_name}, em {formatDateTime(lastImport.created_at)}, origem: CSV exportado da rede.
                      </>
                    )}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-zinc-400">Nenhum dado para esse filtro.</p>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-3 lg:w-[34rem]">
                <div role="radiogroup" aria-label="Período" className="flex items-end gap-1">
                  {PERIODS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={period === value}
                      onClick={() => setPeriod(value)}
                      className={clsx('min-h-11 flex-1 rounded-xl text-sm font-semibold', FOCUS, period === value ? 'bg-zinc-100 text-zinc-900' : 'bg-surface-2 text-zinc-400 hover:text-zinc-100')}
                    >
                      {value}d
                    </button>
                  ))}
                </div>
                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-semibold text-zinc-300">Rede</span>
                  <select
                    value={platform ?? ''}
                    onChange={(event) => setPlatform(ANALYTICS_PLATFORMS.find((item) => item === event.target.value) ?? null)}
                    className={SELECT}
                  >
                    <option value="">Todas</option>
                    {ANALYTICS_PLATFORMS.map((item) => (
                      <option key={item} value={item}>
                        {PLATFORM_LABELS[item]}
                      </option>
                    ))}
                  </select>
                </label>
                <ContextSelect
                  label="Marca"
                  emptyLabel="Todas as marcas"
                  value={brandFilter}
                  onChange={setBrandFilter}
                  options={(brands.data ?? []).map((brand) => ({ id: brand.id, label: brand.name }))}
                />
              </div>
            </div>
            {end && <MetricGrid summaries={summaries} />}
          </section>

          {top.length > 0 && (
            <section aria-labelledby="top-title" className="space-y-3">
              <h2 id="top-title" className="font-headline text-xl text-zinc-50">
                Conteúdos com mais visualizações
              </h2>
              <ol className="divide-y divide-white/[0.05] rounded-2xl bg-surface ring-1 ring-white/[0.06]">
                {top.map((item, index) => (
                  <li key={item.ref} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <span className="w-5 text-right font-headline tabular-nums text-zinc-500">{index + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-zinc-200">{item.ref}</span>
                    <span className="tabular-nums text-zinc-400">{views.format(item.views)} visualizações</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}

      {(imports.data ?? []).length > 0 && (
        <section aria-labelledby="importacoes-title" className="space-y-3">
          <h2 id="importacoes-title" className="font-headline text-xl text-zinc-50">
            Importações
          </h2>
          <ul className="divide-y divide-white/[0.05] rounded-2xl bg-surface ring-1 ring-white/[0.06]">
            {imports.data?.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <span className="min-w-0 flex-1 truncate font-semibold text-zinc-200">{item.file_name}</span>
                <span className="text-zinc-400">{PLATFORM_LABELS[item.platform]}</span>
                <span className="text-zinc-400">
                  {day(item.period_start)} a {day(item.period_end)} · {item.row_count} linhas
                </span>
                <span className="text-zinc-500">Importado em {formatDateTime(item.created_at)}</span>
                <button
                  type="button"
                  onClick={() => void remove(item.id, item.file_name)}
                  aria-label={`Remover importação ${item.file_name}`}
                  className={clsx('grid size-8 place-items-center rounded-lg text-zinc-500 hover:bg-white/[0.06] hover:text-red-300', FOCUS)}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
