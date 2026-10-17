import clsx from 'clsx'
import { Coins, Images, LogOut, Sparkles, UserRound } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useBalance } from '@/hooks/useBalance'
import { supabase } from '@/lib/supabase'
import { Logo } from './Logo'

const NAV = [
  { to: '/', label: 'Estúdio', icon: Sparkles },
  { to: '/galeria', label: 'Galeria', icon: Images },
  { to: '/personas', label: 'Personas', icon: UserRound },
] as const

function BalancePill() {
  const { balance } = useBalance()
  return (
    <NavLink
      to="/creditos"
      className="flex min-h-9 items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 text-sm transition-colors hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      aria-label={balance === null ? 'Créditos' : `${balance} créditos. Comprar mais`}
    >
      <Coins className="size-4 text-accent" aria-hidden="true" />
      <span className="font-medium tabular-nums text-zinc-100">{balance ?? '...'}</span>
      <span className="hidden text-zinc-500 sm:inline">créditos</span>
    </NavLink>
  )
}

function navClass({ isActive }: { isActive: boolean }) {
  return clsx(
    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
    isActive ? 'bg-white/[0.06] text-zinc-50' : 'text-zinc-400 hover:text-zinc-100',
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
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-zinc-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <NavLink to="/" aria-label="Kria, início" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <Logo />
          </NavLink>
          <nav aria-label="Principal" className="hidden items-center gap-1 md:flex">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} end={to === '/'} className={navClass}>
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <BalancePill />
            <button
              type="button"
              onClick={() => void supabase.auth.signOut()}
              className="grid size-9 place-items-center rounded-lg text-zinc-500 transition-colors hover:bg-white/[0.05] hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label="Sair da conta"
              title="Sair"
            >
              <LogOut className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <main id="conteudo" className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-12">
        <Outlet />
      </main>

      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.06] bg-zinc-950/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        <div className="grid grid-cols-3">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex min-h-16 flex-col items-center justify-center gap-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent',
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
