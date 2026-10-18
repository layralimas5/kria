import clsx from 'clsx'
import { Coins, LogOut } from 'lucide-react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useBalance } from '@/hooks/useBalance'
import { isDemo, supabase } from '@/lib/supabase'
import { Logo } from '../Logo'
import { MOBILE_TABS } from './nav'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

/** Topo do celular: marca, saldo (leva a Créditos) e sair. */
export function MobileTopBar() {
  const { balance } = useBalance()
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-2 bg-canvas/90 px-4 backdrop-blur-xl md:hidden">
      <Link to="/estudio?modo=imagem" aria-label="Kria IA, início" className={clsx('rounded-lg', FOCUS)}>
        <Logo />
      </Link>
      {isDemo && (
        <span className="rounded-md border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-200">
          Demo
        </span>
      )}
      <Link
        to="/creditos"
        className={clsx('ml-auto flex min-h-8 items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 text-[13px] font-bold tabular-nums', FOCUS)}
        aria-label={balance === null ? 'Créditos' : `${balance} créditos`}
      >
        <Coins className="size-3.5 text-accent" aria-hidden="true" />
        {balance ?? '...'}
      </Link>
      <button
        type="button"
        onClick={() => void supabase.auth.signOut()}
        className={clsx('grid size-8 place-items-center rounded-lg text-zinc-500', FOCUS)}
        aria-label="Sair da conta"
      >
        <LogOut className="size-4" aria-hidden="true" />
      </button>
    </header>
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
      <ul className="grid grid-cols-4">
        {MOBILE_TABS.map((item) => {
          const active = item.isActive(pathname, params)
          const Icon = item.icon
          return (
            <li key={item.label}>
              <Link
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent',
                  active ? 'text-accent' : 'text-zinc-500',
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
