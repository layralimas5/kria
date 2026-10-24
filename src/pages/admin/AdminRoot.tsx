import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { MfaStep } from '@/components/admin/MfaStep'
import { Logo } from '@/components/Logo'
import { Notice } from '@/components/ui/Notice'
import { Spinner } from '@/components/ui/Spinner'
import { AdminAccessProvider } from '@/hooks/useAdminAccess'
import { useIdleSignOut } from '@/hooks/useIdleSignOut'
import { useQuery } from '@/hooks/useQuery'
import { ToastProvider } from '@/hooks/useToast'
import { fetchAdminMe } from '@/lib/adminApi'

/** Sessão da operação cai sozinha depois de meia hora parada. */
const IDLE_MINUTES = 30

function GateFrame({ children }: { readonly children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="flex h-14 items-center border-b border-white/[0.05] px-4">
        <Logo />
        <Link
          to="/inicio"
          className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-zinc-400 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar ao app
        </Link>
      </header>
      <main id="conteudo" className="px-4 py-10">
        {children}
      </main>
    </div>
  )
}

function SignedInAdmin({ children }: { readonly children: ReactNode }) {
  useIdleSignOut(IDLE_MINUTES)
  return <>{children}</>
}

/**
 * Porta da operação. Quem não está em `admin_users` vê só o aviso; quem está, mas entrou
 * sem segundo fator, passa pelo código. O banco recusa tudo fora disso de qualquer jeito.
 */
export function AdminRoot() {
  const me = useQuery(fetchAdminMe, 'Não deu para conferir seu acesso.')

  if (me.loading && me.data === null) {
    return (
      <GateFrame>
        <div className="grid place-items-center py-16 text-zinc-500" role="status" aria-label="Conferindo acesso">
          <Spinner className="size-6" />
        </div>
      </GateFrame>
    )
  }
  if (me.error) {
    return (
      <GateFrame>
        <div className="mx-auto max-w-xl">
          <Notice tone="error">{me.error}</Notice>
        </div>
      </GateFrame>
    )
  }
  if (!me.data) {
    return (
      <GateFrame>
        <div className="mx-auto max-w-xl">
          <Notice>Esta área é só para a operação do Vynkio.</Notice>
        </div>
      </GateFrame>
    )
  }
  if (me.data.aal !== 'aal2') {
    return (
      <GateFrame>
        <MfaStep onVerified={() => void me.reload()} />
      </GateFrame>
    )
  }
  return (
    <SignedInAdmin>
      <AdminAccessProvider me={me.data}>
        <ToastProvider>
          <AdminLayout />
        </ToastProvider>
      </AdminAccessProvider>
    </SignedInAdmin>
  )
}
