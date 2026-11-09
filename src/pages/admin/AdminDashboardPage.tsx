import { useCallback, useMemo, useState } from 'react'
import { AiSection, AlertsList, BreakdownSection, ChartsSection, Definitions, RevenueSection, UsersSection } from '@/components/admin/dashboard/DashboardSections'
import { PeriodFilter } from '@/components/admin/dashboard/PeriodFilter'
import { ALL_SCOPE, ScopeSelect } from '@/components/admin/dashboard/ScopeFilter'
import { Notice } from '@/components/ui/Notice'
import { Spinner } from '@/components/ui/Spinner'
import { buildAlerts } from '@/domain/adminDashboard'
import { useAdminPeriod } from '@/hooks/useAdminPeriod'
import { useQuery } from '@/hooks/useQuery'
import { fetchAdminModels, fetchAdminPlans, fetchDashboard } from '@/lib/adminApi'

const scopeValue = (value: string) => (value === ALL_SCOPE ? null : value)

export function AdminDashboardPage() {
  const { preset, custom, period, setPreset, setCustom } = useAdminPeriod()
  const [plan, setPlan] = useState(ALL_SCOPE)
  const [model, setModel] = useState(ALL_SCOPE)
  const plans = useQuery(fetchAdminPlans, 'Não deu para carregar os planos.')
  const models = useQuery(fetchAdminModels, 'Não deu para carregar as ferramentas.')
  // Período inválido não consulta o banco: o filtro já explica o que corrigir.
  const load = useCallback(
    () => (period ? fetchDashboard(period, { plan: scopeValue(plan), model: scopeValue(model) }) : Promise.resolve(null)),
    [period, plan, model],
  )
  const dashboard = useQuery(load, 'Não deu para carregar os números do período.')
  const data = dashboard.data
  const alerts = useMemo(() => (data ? buildAlerts(data) : []), [data])
  const planOptions = useMemo(
    () => [{ value: ALL_SCOPE, label: 'Todos' }, ...(plans.data ?? []).filter((item) => item.status !== 'draft').map((item) => ({ value: item.slug, label: item.name }))],
    [plans.data],
  )
  const modelOptions = useMemo(() => [{ value: ALL_SCOPE, label: 'Todas' }, ...(models.data ?? []).map((item) => ({ value: item.slug, label: item.name }))], [models.data])
  const scoped = plan !== ALL_SCOPE || model !== ALL_SCOPE

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-3xl text-zinc-50 md:text-4xl">Dashboard</h1>
        <p className="mt-2 text-sm text-zinc-400">Saúde do Vynkio com dados reais do banco. Onde não há registro, aparece vazio, nunca estimado.</p>
      </div>

      {/* Filtros presos no topo (no computador): continuam à mão enquanto a página rola. */}
      <div className="z-20 -mx-4 border-b border-white/[0.05] bg-canvas/90 px-4 py-3 backdrop-blur-xl lg:sticky lg:top-14 lg:-mx-8 lg:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <PeriodFilter key={`${custom.start}:${custom.end}`} preset={preset} custom={custom} invalid={period === null} onPreset={setPreset} onCustom={setCustom} />
          <ScopeSelect label="Plano" value={plan} options={planOptions} onChange={setPlan} />
          <ScopeSelect label="Ferramenta" value={model} options={modelOptions} onChange={setModel} />
          {scoped && (
            <button
              type="button"
              onClick={() => {
                setPlan(ALL_SCOPE)
                setModel(ALL_SCOPE)
              }}
              className="min-h-10 rounded-xl px-3 text-[13px] font-semibold text-accent-soft hover:text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {dashboard.error && <Notice tone="error">{dashboard.error}</Notice>}
      {!data && dashboard.loading && (
        <div className="grid place-items-center py-24 text-zinc-500" role="status" aria-label="Carregando">
          <Spinner className="size-6" />
        </div>
      )}

      {data && (
        <>
          {!scoped && <AlertsList alerts={alerts} />}
          <UsersSection data={data} />
          {data.finance && <RevenueSection finance={data.finance} />}
          <AiSection data={data} />
          <ChartsSection data={data} stale={dashboard.loading} />
          <BreakdownSection data={data} />
          <Definitions />
        </>
      )}
    </div>
  )
}
