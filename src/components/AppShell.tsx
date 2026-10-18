import clsx from 'clsx'
import { Coins, Images, LogOut, Sparkles, UserRound } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useBalance } from '@/hooks/useBalance'
import { isDemo, supabase } from '@/lib/supabase'
import { Logo } from './Logo'

const NAV = [
  { to: '/estudio', label: 'Estúdio', icon: Sparkles },
  { to: '/personas', label: 'Personas', icon: UserRound },
  { to: '/galeria', label: 'Galeria', icon: Images },
] as const

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

function CreditsArea() {
  const { balance } = useBalance()
  return (
    <div className="flex items-center gap-1.5">
      <NavLink
        to="/creditos"
        className={clsx(
          'flex min-h-8 items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 text-[13px] font-semibold transition-colors hover:bg-surface-3',
          FOCUS,
        )}
        aria-label={balance === null ? 'Créditos' : `${balance} créditos`}
      >
        <Coins className="size-3.5 text-accent" aria-hidden="true" />
        <span className="tabular-nums text-zinc-100">{balance ?? '...'}</span>
      </NavLink>
      <Link
        to="/creditos"
        className={clsx('btn-lime hidden min-h-8 items-center rounded-lg px-3 text-[13px] font-semibold sm:inline-flex', FOCUS)}
      >
        Comprar créditos
      </Link>
    </div>
  )
}

export function AppShell() {
  return (
    <div className="min-h-dvh pb-20 md:pb-0">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-ink"
      >
        Pular para o conteúdo
      </a>
      <header className="sticky top-0 z-40 bg-canvas/85 backdrop-blur-xl">
        <div className="flex h-14 items-center gap-6 px-4 sm:px-5">
          <NavLink to="/estudio" aria-label="Kria IA, início" className={clsx('shrink-0 rounded-lg', FOCUS)}>
            <Logo />
          </NavLink>
          <nav aria-label="Principal" className="hidden items-center gap-5 md:flex">
            {NAV.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  clsx(
                    'rounded text-[15px] font-semibold transition-colors',
                    FOCUS,
                    isActive ? 'text-accent' : 'text-zinc-400 hover:text-zinc-100',
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {isDemo && (
              <span
                className="hidden rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-200 sm:inline"
                title="Dados de exemplo. Nada é salvo nem cobrado."
              >
                Demo
              </span>
            )}
            <CreditsArea />
            <button
              type="button"
              onClick={() => void supabase.auth.signOut()}
              className={clsx(
                'grid size-8 place-items-center rounded-lg text-zinc-500 transition-colors hover:bg-surface-2 hover:text-zinc-100',
                FOCUS,
              )}
              aria-label="Sair da conta"
              title="Sair"
            >
              <LogOut className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <main id="conteudo" className="px-4 pb-10 pt-4 sm:px-5">
        <Outlet />
      </main>

      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.06] bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        <div className="grid grid-cols-3">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  'flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent',
                  isActive ? 'text-accent' : 'text-zinc-500',
                )
              }
            >
              <Icon className="size-5" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
