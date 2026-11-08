import clsx from 'clsx'
import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertsList } from '@/components/admin/dashboard/DashboardSections'
import { PeriodFilter } from '@/components/admin/dashboard/PeriodFilter'
import { CreditPolicyPanel } from '@/components/admin/finance/CreditPolicyPanel'
import { FinanceSettingsForm } from '@/components/admin/finance/FinanceSettingsForm'
import { ModelProfitTable, MultiplierSection, PlanRevenueTable, ProviderCostTable, StatementSection, UserProfitTable } from '@/components/admin/finance/FinanceOverview'
import { PlanCalculator } from '@/components/admin/finance/PlanCalculator'
import { PlanTargets } from '@/components/admin/finance/PlanTargets'
import { ProfitSimulator } from '@/components/admin/finance/ProfitSimulator'
import { Notice } from '@/components/ui/Notice'
import { Spinner } from '@/components/ui/Spinner'
import { financeAlerts, statementOf } from '@/domain/finance'
import { useAdminAccess } from '@/hooks/useAdminAccess'
import { useAdminPeriod } from '@/hooks/useAdminPeriod'
import { useQuery } from '@/hooks/useQuery'
import { fetchFinance, fetchFinanceSettings, fetchModelQuotes, fetchPlanEconomics, fetchPricing } from '@/lib/adminApi'

const TABS = [
  { id: 'resultado', label: 'Resultado' },
  { id: 'rentabilidade', label: 'Rentabilidade' },
  { id: 'calculadora', label: 'Calculadora de planos' },
  { id: 'simulador', label: 'Simulador' },
  { id: 'creditos', label: 'Preços e créditos' },
] as const
type TabId = (typeof TABS)[number]['id']

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

function useTab(): [TabId, (tab: TabId) => void] {
  const [params, setParams] = useSearchParams()
  const raw = params.get('aba')
  const tab = TABS.find((item) => item.id === raw)?.id ?? 'resultado'
  const setTab = (next: TabId) => {
    const merged = new URLSearchParams(params)
    merged.set('aba', next)
    setParams(merged, { replace: true })
  }
  return [tab, setTab]
}

function Loading() {
  return (
    <div className="grid place-items-center py-24 text-zinc-500" role="status" aria-label="Carregando">
      <Spinner className="size-6" />
    </div>
  )
}

function PeriodTabs({ tab }: { readonly tab: 'resultado' | 'rentabilidade' }) {
  const { can } = useAdminAccess()
  const economics = useQuery(fetchPlanEconomics, 'Não deu para carregar a economia dos planos.')
  const { preset, custom, period, setPreset, setCustom } = useAdminPeriod()
  const load = useCallback(() => (period ? fetchFinance(period) : Promise.resolve(null)), [period])
  const finance = useQuery(load, 'Não deu para carregar o financeiro do período.')
  const data = finance.data
  const statement = useMemo(() => (data ? statementOf(data) : null), [data])
  const alerts = useMemo(() => (data && statement ? financeAlerts(data, statement) : []), [data, statement])

  return (
    <div className="space-y-8">
      <PeriodFilter key={`${custom.start}:${custom.end}`} preset={preset} custom={custom} invalid={period === null} onPreset={setPreset} onCustom={setCustom} />
      {finance.error && <Notice tone="error">{finance.error}</Notice>}
      {!data && finance.loading && <Loading />}
      {data && statement && (
        <>
          <AlertsList alerts={alerts} />
          {tab === 'resultado' ? (
            <>
              <StatementSection finance={data} statement={statement} />
              {economics.data && <PlanTargets economics={economics.data} />}
              <PlanRevenueTable finance={data} />
              <MultiplierSection finance={data} />
              <FinanceSettingsForm key={JSON.stringify(data.settings)} settings={data.settings} canEdit={can('pricing.manage')} onSaved={() => void finance.reload()} />
            </>
          ) : (
            <>
              <UserProfitTable finance={data} />
              <ProviderCostTable finance={data} />
              <ModelProfitTable finance={data} />
            </>
          )}
        </>
      )}
    </div>
  )
}

function SimulatorTab() {
  const settings = useQuery(fetchFinanceSettings, 'Não deu para carregar as premissas.')
  const pricing = useQuery(fetchPricing, 'Não deu para carregar a taxa do gateway.')
  const economics = useQuery(fetchPlanEconomics, 'Não deu para carregar os planos.')
  const error = settings.error ?? pricing.error ?? economics.error
  if (error) return <Notice tone="error">{error}</Notice>
  if (!settings.data || !pricing.data || !economics.data) return <Loading />
  const drafts = economics.data.plans.filter((plan) => plan.line === 'creator' && plan.status === 'draft' && !plan.contact_only)
  const plans = drafts.length > 0 ? drafts : economics.data.plans.filter((plan) => plan.line === 'creator' && plan.status === 'live' && plan.price_cents > 0)
  return <ProfitSimulator settings={settings.data} paymentFeeRate={pricing.data.payment_fee_rate} plans={plans} />
}

function CalculatorTab() {
  const { can } = useAdminAccess()
  const economics = useQuery(fetchPlanEconomics, 'Não deu para carregar a economia dos planos.')
  if (economics.error) return <Notice tone="error">{economics.error}</Notice>
  if (!economics.data) return <Loading />
  return <PlanCalculator economics={economics.data} canSave={can('plans.manage') && can('pricing.manage')} onSaved={() => void economics.reload()} />
}

function CreditsTab() {
  const { can } = useAdminAccess()
  const quotes = useQuery(fetchModelQuotes, 'Não deu para carregar a cotação dos modelos.')
  if (quotes.error) return <Notice tone="error">{quotes.error}</Notice>
  if (!quotes.data) return <Loading />
  return <CreditPolicyPanel quotes={quotes.data} canManage={can('pricing.manage') && can('plans.manage')} onChanged={() => void quotes.reload()} />
}

/** Vynkio Admin → Financeiro e rentabilidade. Faturamento não é lucro: a tela desce camada por camada. */
export function AdminFinancePage() {
  const [tab, setTab] = useTab()
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-3xl text-zinc-50 md:text-4xl">Financeiro e rentabilidade</h1>
        <p className="mt-2 text-sm text-zinc-400">Receita real do Asaas, custo de IA por geração e premissas suas para o resto. O que é estimativa está marcado.</p>
      </div>
      <div role="tablist" aria-label="Seções do financeiro" className="flex flex-wrap gap-1 rounded-xl bg-surface p-1 ring-1 ring-white/[0.06] sm:w-fit">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls="finance-panel"
            onClick={() => setTab(item.id)}
            className={clsx('min-h-9 rounded-lg px-3.5 text-sm font-semibold transition-colors', FOCUS, tab === item.id ? 'bg-white/[0.09] text-zinc-50' : 'text-zinc-400 hover:text-zinc-100')}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div id="finance-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === 'resultado' || tab === 'rentabilidade' ? (
          <PeriodTabs tab={tab} />
        ) : tab === 'calculadora' ? (
          <CalculatorTab />
        ) : tab === 'simulador' ? (
          <SimulatorTab />
        ) : (
          <CreditsTab />
        )}
      </div>
    </div>
  )
}
