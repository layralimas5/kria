import clsx from 'clsx'
import { Coins, Menu } from 'lucide-react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useAccount } from '@/hooks/useAccount'
import { useBalance } from '@/hooks/useBalance'
import { UserMenu } from '../account/UserMenu'
import { BrandSwitcher } from '../workspace/BrandSwitcher'
import { Logo } from '../Logo'
import { Popover } from '../ui/Popover'
import { MOBILE_TABS, navGroupsFor } from './nav'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
const TAB = 'flex min-h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent'

/** Topo do celular: marca, marca ativa, saldo (leva a Créditos) e o menu da conta. */
export function MobileTopBar() {
  const { balance } = useBalance()
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-2 bg-canvas/90 px-4 backdrop-blur-xl md:hidden">
      <Link to="/inicio" aria-label="Vynkio, início" className={clsx('shrink-0 rounded-lg', FOCUS)}>
        <Logo />
      </Link>
      <div className="ml-auto min-w-0">
        <BrandSwitcher compact />
      </div>
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

/** Todas as áreas do menu, para o celular. "Breve" aparece sem link, como na barra lateral. */
function FullMenu({ onNavigate }: { readonly onNavigate: () => void }) {
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const { plan } = useAccount()
  return (
    <nav aria-label="Todas as áreas" className="max-h-[70dvh] w-[min(88vw,20rem)] space-y-3 overflow-y-auto p-1">
      {navGroupsFor(plan).map((group) => (
        <div key={group.title}>
          <p className="px-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-zinc-500">{group.title}</p>
          <ul>
            {group.items.map((item) => {
              const Icon = item.icon
              if (item.soon) {
                return (
                  <li key={item.label} aria-disabled="true" className="flex min-h-10 items-center gap-3 px-2 text-sm font-semibold text-zinc-600">
                    <Icon className="size-4" aria-hidden="true" />
                    <span className="flex-1">{item.label}</span>
                    <span className="rounded-md bg-white/[0.05] px-1 text-[9px] font-bold uppercase text-zinc-500">Breve</span>
                  </li>
                )
              }
              const active = item.isActive(pathname, params)
              return (
                <li key={item.label}>
                  <Link
                    to={item.to}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={clsx(
                      'flex min-h-10 items-center gap-3 rounded-lg px-2 text-sm font-semibold',
                      FOCUS,
                      active ? 'bg-white/[0.07] text-zinc-50' : 'text-zinc-300 hover:bg-white/[0.04]',
                    )}
                  >
                    <Icon className={clsx('size-4', active && 'text-accent-soft')} aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

/** Abas de baixo do celular. */
export function MobileTabBar() {
  const { pathname } = useLocation()
  const [params] = useSearchParams()
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
          <Popover
            label="Menu"
            align="end"
            trigger={({ open, toggle, controls }) => (
              <button type="button" onClick={toggle} aria-expanded={open} aria-controls={controls} className={clsx(TAB, open ? 'text-accent-soft' : 'text-zinc-500')}>
                <Menu className="size-5" aria-hidden="true" />
                Menu
              </button>
            )}
          >
            {(close) => <FullMenu onNavigate={close} />}
          </Popover>
        </li>
      </ul>
    </nav>
  )
}
