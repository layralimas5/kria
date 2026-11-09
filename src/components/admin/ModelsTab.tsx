import { useCallback, useMemo, useState } from 'react'
import { costAlerts, providerLabel, type CostFilters } from '@/domain/aiCosts'
import { useAdminAccess } from '@/hooks/useAdminAccess'
import { useAdminPeriod } from '@/hooks/useAdminPeriod'
import { useQuery } from '@/hooks/useQuery'
import { fetchAdminModels, fetchAdminPlans, fetchAiCosts, fetchPricing } from '@/lib/adminApi'
import { Notice } from '../ui/Notice'
import { CostCharts } from './costs/CostCharts'
import { CostAlertsList, CostKpis } from './costs/CostOverview'
import { ModelCostTable } from './costs/ModelCostTable'
import { ModelDrawer } from './costs/ModelDrawer'
import { PricingForm } from './costs/ModelForms'
import { PeriodFilter } from './dashboard/PeriodFilter'
import { ScopeSelect } from './dashboard/ScopeFilter'
import { SpendGuardPanel } from './SpendGuardPanel'

const ALL = 'all'
const KIND_OPTIONS = [
  { value: ALL, label: 'Todas' },
  { value: 'image', label: 'Imagem' },
  { value: 'video', label: 'Vídeo' },
  { value: 'text', label: 'Texto' },
]
const STATUS_OPTIONS = [
  { value: ALL, label: 'Todos' },
  { value: 'active', label: 'Ativos' },
  { value: 'inactive', label: 'Inativos' },
]
const pick = (value: string) => (value === ALL ? null : value)

function CostsSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Carregando custos">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 10 }, (_, index) => (
          <div key={index} className="h-[5.5rem] animate-pulse rounded-2xl bg-surface ring-1 ring-white/[0.06]" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-2xl bg-surface ring-1 ring-white/[0.06]" />
    </div>
  )
}

export function ModelsTab() {
  const { can } = useAdminAccess()
  const { preset, custom, period, setPreset, setCustom } = useAdminPeriod()
  const [provider, setProvider] = useState(ALL)
  const [kind, setKind] = useState(ALL)
  const [modelFilter, setModelFilter] = useState(ALL)
  const [status, setStatus] = useState(ALL)
  const [openSlug, setOpenSlug] = useState<string | null>(null)

  const models = useQuery(fetchAdminModels, 'Não deu para carregar os modelos.')
  const plans = useQuery(fetchAdminPlans, 'Não deu para carregar os planos.')
  const pricing = useQuery(fetchPricing, 'Não deu para carregar os parâmetros de preço.')
  const filters = useMemo<CostFilters>(
    () => ({ provider: pick(provider), kind: pick(kind), model: pick(modelFilter), active: status === ALL ? null : status === 'active' }),
    [provider, kind, modelFilter, status],
  )
  const load = useCallback(() => (period ? fetchAiCosts(period, filters) : Promise.resolve(null)), [period, filters])
  const costs = useQuery(load, 'Não deu para carregar os custos de IA.')
  const data = costs.data
  const alerts = useMemo(() => (data ? costAlerts(data) : []), [data])
  const error = costs.error ?? models.error ?? plans.error ?? pricing.error
  const scoped = provider !== ALL || kind !== ALL || modelFilter !== ALL || status !== ALL

  const reloadAll = () => {
    void costs.reload()
    void models.reload()
  }

  return (
    <div className="space-y-8">
      <div className="z-20 -mx-4 border-b border-white/[0.05] bg-canvas/90 px-4 py-3 backdrop-blur-xl lg:sticky lg:top-14 lg:-mx-8 lg:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <PeriodFilter key={`${custom.start}:${custom.end}`} preset={preset} custom={custom} invalid={period === null} onPreset={setPreset} onCustom={setCustom} />
          <ScopeSelect
            label="Provedor"
            value={provider}
            onChange={setProvider}
            options={[{ value: ALL, label: 'Todos' }, ...(data?.providers ?? []).map((item) => ({ value: item, label: providerLabel(item) }))]}
          />
          <ScopeSelect label="Categoria" value={kind} onChange={setKind} options={KIND_OPTIONS} />
          <ScopeSelect
            label="Modelo"
            value={modelFilter}
            onChange={setModelFilter}
            options={[{ value: ALL, label: 'Todos' }, ...(models.data ?? []).map((item) => ({ value: item.slug, label: item.name }))]}
          />
          <ScopeSelect label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
          {scoped && (
            <button
              type="button"
              onClick={() => {
                setProvider(ALL)
                setKind(ALL)
                setModelFilter(ALL)
                setStatus(ALL)
              }}
              className="min-h-10 rounded-xl px-3 text-[13px] font-semibold text-accent-soft hover:text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {error && <Notice tone="error">{error}</Notice>}
      {!data && costs.loading && <CostsSkeleton />}

      {data && (
        <>
          <CostKpis data={data} stale={costs.loading} />
          <CostAlertsList alerts={alerts} onOpen={setOpenSlug} />
          <ModelCostTable data={data} onOpen={setOpenSlug} />
          <CostCharts data={data} stale={costs.loading} />
        </>
      )}

      <section aria-labelledby="cost-params" className="space-y-4">
        <h2 id="cost-params" className="font-headline text-xl text-zinc-50">
          Parâmetros e proteções
        </h2>
        {can('finance.view') && <SpendGuardPanel />}
        {pricing.data && can('pricing.manage') && <PricingForm key={JSON.stringify(pricing.data)} settings={pricing.data} onSaved={() => void pricing.reload()} />}
      </section>

      <ModelDrawer
        model={data?.models.find((item) => item.slug === openSlug) ?? null}
        adminModel={models.data?.find((item) => item.slug === openSlug) ?? null}
        plans={(plans.data ?? []).map((plan) => plan.slug)}
        settings={pricing.data}
        minMargin={data?.min_margin_rate ?? 0}
        onClose={() => setOpenSlug(null)}
        onChanged={reloadAll}
      />
    </div>
  )
}
