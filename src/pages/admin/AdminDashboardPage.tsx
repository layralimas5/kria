import { useCallback, useMemo } from 'react'
import { AiSection, AlertsList, BreakdownSection, ChartsSection, Definitions, RevenueSection, UsersSection } from '@/components/admin/dashboard/DashboardSections'
import { PeriodFilter } from '@/components/admin/dashboard/PeriodFilter'
import { Notice } from '@/components/ui/Notice'
import { Spinner } from '@/components/ui/Spinner'
import { buildAlerts } from '@/domain/adminDashboard'
import { useAdminPeriod } from '@/hooks/useAdminPeriod'
import { useQuery } from '@/hooks/useQuery'
import { fetchDashboard } from '@/lib/adminApi'

export function AdminDashboardPage() {
  const { preset, custom, period, setPreset, setCustom } = useAdminPeriod()
  // Período inválido não consulta o banco: o filtro já explica o que corrigir.
  const load = useCallback(() => (period ? fetchDashboard(period) : Promise.resolve(null)), [period])
  const dashboard = useQuery(load, 'Não deu para carregar os números do período.')
  const data = dashboard.data
  const alerts = useMemo(() => (data ? buildAlerts(data) : []), [data])

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div>
          <h1 className="font-headline text-3xl text-zinc-50 md:text-4xl">Dashboard</h1>
          <p className="mt-2 text-sm text-zinc-400">Saúde do Vynkio com dados reais do banco. Onde não há registro, aparece vazio, nunca estimado.</p>
        </div>
        <PeriodFilter key={`${custom.start}:${custom.end}`} preset={preset} custom={custom} invalid={period === null} onPreset={setPreset} onCustom={setCustom} />
      </div>

      {dashboard.error && <Notice tone="error">{dashboard.error}</Notice>}
      {!data && dashboard.loading && (
        <div className="grid place-items-center py-24 text-zinc-500" role="status" aria-label="Carregando">
          <Spinner className="size-6" />
        </div>
      )}

      {data && (
        <>
          <AlertsList alerts={alerts} />
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
