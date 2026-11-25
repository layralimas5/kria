import { ArrowUpRight, ShieldCheck } from 'lucide-react'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import { SideNavItem } from './SideNav'

/** Atalho para o painel de operação. Só aparece para quem está em `admin_users`. */
export function AdminShortcut({ collapsed }: { readonly collapsed: boolean }) {
  const isAdmin = useIsAdmin()
  if (!isAdmin) return null

  return (
    <SideNavItem
      label="Painel admin"
      accessibleLabel={collapsed ? 'Abrir o painel admin' : undefined}
      icon={ShieldCheck}
      to="/admin"
      collapsed={collapsed}
      iconClassName="text-hot"
      trailing={<ArrowUpRight className="size-3.5 text-zinc-500 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />}
    />
  )
}
