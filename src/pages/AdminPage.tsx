import clsx from 'clsx'
import { useSearchParams } from 'react-router-dom'
import { AuditTab } from '@/components/admin/AuditTab'
import { ModelsTab } from '@/components/admin/ModelsTab'
import { OverviewTab } from '@/components/admin/OverviewTab'
import { PlansTab } from '@/components/admin/PlansTab'
import { UsersTab } from '@/components/admin/UsersTab'
import { Notice } from '@/components/ui/Notice'
import { PageHeader } from '@/components/ui/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { useAccount } from '@/hooks/useAccount'

const TABS = [
  { value: 'visao-geral', label: 'Visão geral', Panel: OverviewTab },
  { value: 'usuarios', label: 'Usuários', Panel: UsersTab },
  { value: 'planos', label: 'Planos', Panel: PlansTab },
  { value: 'modelos', label: 'Modelos e preços', Panel: ModelsTab },
  { value: 'auditoria', label: 'Auditoria', Panel: AuditTab },
] as const

/** Painel da operação. A rota só aparece para admin, e cada ação é conferida de novo no banco. */
export function AdminPage() {
  const { loading, isAdmin } = useAccount()
  const [params, setParams] = useSearchParams()
  const current = TABS.find((tab) => tab.value === params.get('aba')) ?? TABS[0]

  if (loading) {
    return (
      <div className="grid place-items-center py-24 text-zinc-500" role="status" aria-label="Carregando">
        <Spinner className="size-6" />
      </div>
    )
  }
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-xl pt-10">
        <Notice tone="error">Esta área é só para a administração da Kria.</Notice>
      </div>
    )
  }

  const Panel = current.Panel
  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10 pt-4">
      <PageHeader title="Admin" description="Assinaturas, custos, usuários, planos e modelos." />
      <div role="tablist" aria-label="Seções do admin" className="flex gap-1 overflow-x-auto border-b border-white/[0.06] scrollbar-none">
        {TABS.map((tab) => {
          const selected = tab.value === current.value
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              id={`tab-${tab.value}`}
              aria-selected={selected}
              aria-controls={`panel-${tab.value}`}
              onClick={() => setParams({ aba: tab.value }, { replace: true })}
              className={clsx(
                '-mb-px min-h-10 shrink-0 border-b-2 px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent',
                selected ? 'border-accent text-zinc-50' : 'border-transparent text-zinc-400 hover:text-zinc-100',
              )}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
      <div role="tabpanel" id={`panel-${current.value}`} aria-labelledby={`tab-${current.value}`}>
        <Panel />
      </div>
    </div>
  )
}
