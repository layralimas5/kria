import clsx from 'clsx'
import { Coins, Menu } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useBalance } from '@/hooks/useBalance'
import { UserMenu } from '../account/UserMenu'
import { BrandSwitcher } from '../workspace/BrandSwitcher'
import { SearchTrigger } from '../command/SearchTrigger'
import { Logo } from '../Logo'
import { NotificationsMenu } from './NotificationsMenu'
import { MobileMenuSheet } from './MobileMenuSheet'
import { MOBILE_TABS } from './nav'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
const TAB = 'flex min-h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent'

/** Topo do celular: marca, marca ativa, notificações, saldo (leva a Créditos) e o menu da conta. */
export function MobileTopBar() {
  const { balance } = useBalance()
  return (
    <header className="glass-bar sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-white/[0.04] px-4 md:hidden">
      <Link to="/inicio" aria-label="Vynkio, início" className={clsx('shrink-0 rounded-lg', FOCUS)}>
        <Logo />
      </Link>
      <div className="ml-auto min-w-0">
        <BrandSwitcher compact />
      </div>
      <SearchTrigger compact />
      <NotificationsMenu />
      <Link
        to="/creditos"
        className={clsx('flex min-h-8 shrink-0 items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 text-[13px] font-bold tabular-nums', FOCUS)}
        aria-label={balance === null ? 'Créditos' : `${balance} créditos`}
      >
        <Coins className="size-3.5 text-accent-soft" aria-hidden="true" />
        {balance ?? '...'}
      </Link>
      <UserMenu />
    </header>
  )
}

/** Abas de baixo do celular. */
export function MobileTabBar() {
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.06] bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <ul className="grid grid-cols-5">
        {MOBILE_TABS.map((item) => {
          const active = item.isActive(pathname, params)
          const Icon = item.icon
          return (
            <li key={item.label}>
              <Link to={item.to} aria-current={active ? 'page' : undefined} className={clsx(TAB, active ? 'text-accent-soft' : 'text-zinc-500')}>
                <Icon className="size-5" aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          )
        })}
        <li>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            className={clsx(TAB, menuOpen ? 'text-accent-soft' : 'text-zinc-500')}
          >
            <Menu className="size-5" aria-hidden="true" />
            Menu
          </button>
        </li>
      </ul>
      <MobileMenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} />
    </nav>
  )
}
