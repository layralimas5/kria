import clsx from 'clsx'
import { Download, Printer, RefreshCw } from 'lucide-react'
import { AiSection } from '@/components/admin/center/AiSection'
import { BusinessSection } from '@/components/admin/center/BusinessSection'
import { CenterSkeleton, SectionNav } from '@/components/admin/center/CenterLayout'
import { FinanceSection } from '@/components/admin/center/FinanceSection'
import { OperationsSection } from '@/components/admin/center/OperationsSection'
import { OverviewSection } from '@/components/admin/center/OverviewSection'
import { PulseHero } from '@/components/admin/center/PulseHero'
import { SubscriptionsSection } from '@/components/admin/center/SubscriptionsSection'
import { UsersSection } from '@/components/admin/center/UsersSection'
import { PeriodFilter } from '@/components/admin/dashboard/PeriodFilter'
import { Notice } from '@/components/ui/Notice'
import { brtDay, PERIOD_LABELS } from '@/domain/adminDashboard'
import { downloadCsv, toCsv } from '@/domain/business'
import { centerCsvRows, DAILY_CSV_HEADER, type CenterData } from '@/domain/commandCenter'
import { useAdminAccess } from '@/hooks/useAdminAccess'
import { useAdminPeriod } from '@/hooks/useAdminPeriod'
import { useCommandCenter } from '@/hooks/useCommandCenter'

const ACTION =
  'inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold text-zinc-300 ring-1 ring-white/[0.08] transition-colors hover:bg-white/[0.05] hover:text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40'

function exportCsv(data: CenterData) {
  const { indicators, daily } = centerCsvRows(data)
  const content = `${toCsv(['Seção', 'Indicador', 'Valor'], indicators)}\r\n\r\n${toCsv([...DAILY_CSV_HEADER], daily).replace(/^﻿/, '')}`
  downloadCsv(`vynkio-central-${brtDay(new Date(data.center.period.from))}-a-${brtDay(new Date(Date.parse(data.center.period.to) - 1))}.csv`, content)
}

/**
 * Central de comando do admin: em poucos segundos, quanto entrou, quanto saiu, quanto sobrou, o que
 * custa mais e se o crescimento é saudável. Um período vale para a página inteira; cada seção tem
 * âncora própria e os cards levam ao detalhe nas outras telas.
 */
export function AdminDashboardPage() {
  const { preset, custom, period, setPreset, setCustom } = useAdminPeriod()
  const center = useCommandCenter(period)
  const data = center.data
  const { me } = useAdminAccess()
  const firstName = me.display_name?.trim().split(/\s+/)[0] ?? null

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-soft">Vynkio · {PERIOD_LABELS[preset]}</p>
          <h1 className="mt-1 font-headline text-3xl text-zinc-50 md:text-4xl">Central de comando</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Receita, custos de IA, lucro, base e operação com dados reais do banco. Onde não há registro suficiente, a tela diz o que falta em vez de estimar.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <button type="button" onClick={() => void center.reload()} disabled={center.loading} className={ACTION}>
            <RefreshCw className={clsx('size-4', center.loading && 'animate-spin motion-reduce:animate-none')} aria-hidden="true" />
            Atualizar
          </button>
          <button type="button" onClick={() => data && exportCsv(data)} disabled={!data} className={ACTION}>
            <Download className="size-4" aria-hidden="true" />
            CSV
          </button>
          <button type="button" onClick={() => window.print()} disabled={!data} className={ACTION}>
            <Printer className="size-4" aria-hidden="true" />
            PDF
          </button>
        </div>
      </header>

      {data && <PulseHero data={data} name={firstName} />}

      {/* Período e atalhos presos no topo (no computador): continuam à mão enquanto a página rola. */}
      <div className="glass-bar z-20 -mx-4 space-y-3 border-y border-white/[0.05] px-4 py-3 print:hidden lg:sticky lg:top-14 lg:-mx-8 lg:px-8">
        <PeriodFilter key={`${custom.start}:${custom.end}`} preset={preset} custom={custom} invalid={period === null} onPreset={setPreset} onCustom={setCustom} />
        {data && <SectionNav />}
      </div>

      {center.error && <Notice tone="error">{center.error}</Notice>}
      {!data && center.loading && <CenterSkeleton />}

      {data && (
        <div className={clsx('space-y-14 transition-opacity duration-300', center.loading && 'opacity-60')} aria-busy={center.loading}>
          <OverviewSection data={data} />
          <FinanceSection data={data} onChanged={() => void center.reload()} />
          <AiSection data={data} />
          <SubscriptionsSection data={data} />
          <UsersSection data={data} />
          <BusinessSection data={data} />
          <OperationsSection data={data} />
          <p className="text-xs text-zinc-500">
            Períodos em dias inteiros de Brasília; variações comparam com o período anterior de mesmo tamanho. Custo de IA vem do registro de cada geração (tokens medidos ou tarifa × uso, no câmbio do dia).
            Taxa de pagamento é estimada pela taxa cadastrada. Lucro só desconta despesas lançadas.
          </p>
        </div>
      )}
    </div>
  )
}
