import clsx from 'clsx'
import { ChevronDown, KeyRound, LogOut, Settings, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ADMIN_ROLE_LABELS } from '@/domain/adminDashboard'
import { initials } from '@/domain/adminUsers'
import { useAdminAccess } from '@/hooks/useAdminAccess'
import { MediaView } from '../MediaView'
import { Popover } from '../ui/Popover'

const ITEM =
  'flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 text-left text-sm font-semibold text-zinc-300 hover:bg-white/[0.05] hover:text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

export function AdminAvatar({ name, path, className }: { readonly name: string; readonly path: string | null | undefined; readonly className?: string }) {
  if (path) return <MediaView path={path} kind="image" alt="" className={clsx('shrink-0 rounded-full', className)} />
  return (
    <span aria-hidden="true" className={clsx('grid shrink-0 place-items-center rounded-full bg-accent font-bold text-white', className)}>
      <span className="text-[0.8em]">{initials(name)}</span>
    </span>
  )
}

function MenuLink({ to, icon, children, onClick }: { readonly to: string; readonly icon: ReactNode; readonly children: string; readonly onClick: () => void }) {
  return (
    <Link to={to} onClick={onClick} className={ITEM}>
      {icon}
      {children}
    </Link>
  )
}

/** Avatar no topo do admin: quem está logado, papel e atalhos da própria conta. */
export function ProfileMenu({ onSignOut }: { readonly onSignOut: () => void }) {
  const { me } = useAdminAccess()
  const name = me.display_name?.trim() || me.email?.split('@')[0] || 'Admin'

  return (
    <Popover
      label="Menu da conta"
      side="bottom"
      align="end"
      className="w-[min(18rem,calc(100vw-2rem))]"
      trigger={({ open, toggle, controls }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={controls}
          aria-haspopup="dialog"
          aria-label={`Conta de ${name}`}
          className="flex min-h-9 items-center gap-1.5 rounded-full p-0.5 pr-1.5 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <AdminAvatar name={name} path={me.avatar_path} className="size-8 ring-2 ring-white/[0.08]" />
          <ChevronDown className={clsx('size-4 text-zinc-500 transition-transform', open && 'rotate-180')} aria-hidden="true" />
        </button>
      )}
    >
      {(close) => (
        <div className="space-y-1">
          <div className="flex items-center gap-3 px-3 pb-3 pt-2">
            <AdminAvatar name={name} path={me.avatar_path} className="size-10" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-zinc-50">{name}</p>
              {me.email && <p className="truncate text-xs text-zinc-400">{me.email}</p>}
              <span className="mt-1 inline-flex rounded-md bg-accent/15 px-1.5 py-px text-[10px] font-bold uppercase tracking-wider text-accent-soft">
                {ADMIN_ROLE_LABELS[me.role]}
              </span>
            </div>
          </div>
          <div className="h-px bg-white/[0.06]" />
          <MenuLink to="/admin/conta" onClick={close} icon={<UserRound className="size-4" aria-hidden="true" />}>
            Meu perfil
          </MenuLink>
          <MenuLink to="/admin/seguranca" onClick={close} icon={<Settings className="size-4" aria-hidden="true" />}>
            Configurações da conta
          </MenuLink>
          <MenuLink to="/admin/conta#senha" onClick={close} icon={<KeyRound className="size-4" aria-hidden="true" />}>
            Alterar senha
          </MenuLink>
          <div className="h-px bg-white/[0.06]" />
          <button
            type="button"
            onClick={() => {
              close()
              onSignOut()
            }}
            className={clsx(ITEM, 'text-red-300 hover:text-red-200')}
          >
            <LogOut className="size-4" aria-hidden="true" />
            Sair da conta
          </button>
        </div>
      )}
    </Popover>
  )
}
