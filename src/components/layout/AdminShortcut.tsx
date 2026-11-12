import clsx from 'clsx'
import { ArrowUpRight, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useIsAdmin } from '@/hooks/useIsAdmin'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

/** Atalho para o painel de operação. Só aparece para quem está em `admin_users`. */
export function AdminShortcut({ collapsed }: { readonly collapsed: boolean }) {
  const isAdmin = useIsAdmin()
  if (!isAdmin) return null

  if (collapsed) {
    return (
      <Link
        to="/admin"
        title="Painel admin"
        aria-label="Abrir o painel admin"
        className={clsx('grid min-h-10 place-items-center rounded-xl bg-amber-400/10 text-amber-300 ring-1 ring-amber-300/25 transition-colors hover:bg-amber-400/15', FOCUS)}
      >
        <ShieldCheck className="size-4" aria-hidden="true" />
      </Link>
    )
  }

  return (
    <Link
      to="/admin"
      className={clsx(
        'group flex min-h-10 items-center gap-2.5 rounded-xl bg-amber-400/[0.08] px-3 text-[13px] font-semibold text-amber-200 ring-1 ring-amber-300/20 transition-colors hover:bg-amber-400/15',
        FOCUS,
      )}
    >
      <ShieldCheck className="size-4 shrink-0 text-amber-300" aria-hidden="true" />
      <span className="flex-1">Painel admin</span>
      <ArrowUpRight className="size-3.5 text-amber-300/70 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  )
}
