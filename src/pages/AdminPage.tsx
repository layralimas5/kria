import clsx from 'clsx'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { useCallback, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AuditTab } from '@/components/admin/AuditTab'
import { ModelsTab } from '@/components/admin/ModelsTab'
import { OverviewTab } from '@/components/admin/OverviewTab'
import { PlansTab } from '@/components/admin/PlansTab'
import { UsersTab } from '@/components/admin/UsersTab'
import { Logo } from '@/components/Logo'
import { Notice } from '@/components/ui/Notice'
import { Spinner } from '@/components/ui/Spinner'
import { useQuery } from '@/hooks/useQuery'
import { checkIsAdmin } from '@/lib/adminApi'

const TABS = [
  { value: 'visao-geral', label: 'Visão geral', Panel: OverviewTab },
  { value: 'usuarios', label: 'Usuários', Panel: UsersTab },
  { value: 'planos', label: 'Planos', Panel: PlansTab },
  { value: 'modelos', label: 'Modelos e custos', Panel: ModelsTab },
  { value: 'auditoria', label: 'Auditoria', Panel: AuditTab },
] as const

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

/** Moldura da operação: separada do painel do usuário, sem o menu dele. */
function AdminFrame({ children }: { readonly children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-30 border-b border-white/[0.05] bg-canvas/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          <Logo />
          <span className="inline-flex items-center gap-1 rounded-md bg-hot/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-hot">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            Operação
          </span>
          <Link to="/inicio" className={clsx('ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-zinc-400 hover:text-zinc-100', FOCUS)}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Voltar ao app
          </Link>
        </div>
      </header>
      <main id="conteudo" className="mx-auto max-w-7xl px-4 pb-12 pt-6">
        {children}
      </main>
    </div>
  )
}

/**
 * Painel de operação do Vynkio. Não aparece em menu nenhum do app: quem não está em
 * `admin_users` vê só o aviso, e cada ação é conferida de novo no banco (`is_admin()`).
 */
export function AdminPage() {
  const admin = useQuery(useCallback(checkIsAdmin, []), 'Não deu para conferir seu acesso.')
  const [params, setParams] = useSearchParams()
  const current = TABS.find((tab) => tab.value === params.get('aba')) ?? TABS[0]

  if (admin.loading && admin.data === null) {
    return (
      <AdminFrame>
        <div className="grid place-items-center py-24 text-zinc-500" role="status" aria-label="Carregando">
          <Spinner className="size-6" />
        </div>
      </AdminFrame>
    )
  }
  if (admin.data !== true) {
    return (
      <AdminFrame>
        <div className="mx-auto max-w-xl pt-10">
          <Notice tone="error">{admin.error ?? 'Esta área é só para a operação do Vynkio.'}</Notice>
        </div>
      </AdminFrame>
    )
  }

  const Panel = current.Panel
  return (
    <AdminFrame>
      <div className="space-y-6">
        <div>
          <h1 className="font-headline text-4xl text-zinc-50 md:text-5xl">Operação</h1>
          <p className="mt-3 text-sm text-zinc-400 md:text-base">Assinaturas, receita, custo de API, usuários, planos e modelos. Toda mudança fica na auditoria.</p>
        </div>
        <div role="tablist" aria-label="Seções da operação" className="flex gap-1 overflow-x-auto border-b border-white/[0.06] scrollbar-none">
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
    </AdminFrame>
  )
}
