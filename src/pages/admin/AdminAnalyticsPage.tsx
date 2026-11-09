import clsx from 'clsx'
import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CreditsSection } from '@/components/admin/analytics/CreditsSection'
import { RetentionSection } from '@/components/admin/analytics/RetentionSection'
import { ToolsSection } from '@/components/admin/analytics/ToolsSection'
import { PeriodFilter } from '@/components/admin/dashboard/PeriodFilter'
import { Notice } from '@/components/ui/Notice'
import { Spinner } from '@/components/ui/Spinner'
import { useAdminPeriod } from '@/hooks/useAdminPeriod'
import { useQuery } from '@/hooks/useQuery'
import { fetchAnalytics } from '@/lib/adminApi'

const TABS = [
  { id: 'retencao', label: 'Retenção' },
  { id: 'ferramentas', label: 'Ferramentas' },
  { id: 'creditos', label: 'Créditos e tokens' },
] as const
type TabId = (typeof TABS)[number]['id']

function useTab(): [TabId, (tab: TabId) => void] {
  const [params, setParams] = useSearchParams()
  const tab = TABS.find((item) => item.id === params.get('aba'))?.id ?? 'retencao'
  const setTab = (next: TabId) => {
    const merged = new URLSearchParams(params)
    merged.set('aba', next)
    setParams(merged, { replace: true })
  }
  return [tab, setTab]
}

export function AdminAnalyticsPage() {
  const [tab, setTab] = useTab()
  const { preset, custom, period, setPreset, setCustom } = useAdminPeriod()
  const load = useCallback(() => (period ? fetchAnalytics(period) : Promise.resolve(null)), [period])
  const analytics = useQuery(load, 'Não deu para carregar o analytics do período.')
  const data = analytics.data

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div>
          <h1 className="font-headline text-3xl text-zinc-50 md:text-4xl">Analytics</h1>
          <p className="mt-2 text-sm text-zinc-400">Retenção, ferramentas mais usadas e controle de créditos e tokens, direto do banco.</p>
        </div>
        <div role="tablist" aria-label="Seções do analytics" className="flex gap-1 overflow-x-auto rounded-2xl bg-surface p-1 ring-1 ring-white/[0.06] [scrollbar-width:none]">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={clsx(
                'shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                tab === item.id ? 'bg-white/[0.08] text-zinc-50' : 'text-zinc-400 hover:text-zinc-200',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <PeriodFilter key={`${custom.start}:${custom.end}`} preset={preset} custom={custom} invalid={period === null} onPreset={setPreset} onCustom={setCustom} />
      </div>

      {analytics.error && <Notice tone="error">{analytics.error}</Notice>}
      {!data && analytics.loading && (
        <div className="grid place-items-center py-24 text-zinc-500" role="status" aria-label="Carregando">
          <Spinner className="size-6" />
        </div>
      )}

      {data && (
        <div role="tabpanel" aria-label={TABS.find((item) => item.id === tab)?.label}>
          {tab === 'retencao' && <RetentionSection data={data} stale={analytics.loading} />}
          {tab === 'ferramentas' && <ToolsSection data={data} stale={analytics.loading} />}
          {tab === 'creditos' && <CreditsSection data={data} stale={analytics.loading} />}
        </div>
      )}
    </div>
  )
}
