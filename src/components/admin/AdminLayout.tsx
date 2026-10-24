import clsx from 'clsx'
import { ArrowLeft, LogOut, Menu, ShieldCheck, X } from 'lucide-react'
import { Suspense, useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ADMIN_ROLE_LABELS } from '@/domain/adminDashboard'
import { useAdminAccess } from '@/hooks/useAdminAccess'
import { supabase } from '@/lib/supabase'
import { Logo } from '../Logo'
import { Spinner } from '../ui/Spinner'
import { adminNavFor, type AdminNavItem } from './adminNav'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

function NavLink({ item, active }: { readonly item: AdminNavItem; readonly active: boolean }) {
  const Icon = item.icon
  if (!item.to) {
    return (
      <span aria-disabled="true" className="flex min-h-9 cursor-default items-center gap-3 rounded-xl px-3 text-[14px] font-semibold text-zinc-600">
        <Icon className="size-[18px] shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        <span className="rounded-md bg-white/[0.05] px-1 py-px text-[9px] font-bold uppercase tracking-wide text-zinc-500">Breve</span>
      </span>
    )
  }
  return (
    <Link
      to={item.to}
      aria-current={active ? 'page' : undefined}
      className={clsx(
        'relative flex min-h-9 items-center gap-3 rounded-xl px-3 text-[14px] font-semibold transition-colors',
        FOCUS,
        active ? 'bg-white/[0.07] text-zinc-50' : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100',
      )}
    >
      {active && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-accent" />}
      <Icon className={clsx('size-[18px] shrink-0', active && 'text-accent-soft')} aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
    </Link>
  )
}

function AdminNav() {
  const { can } = useAdminAccess()
  const { pathname } = useLocation()
  const isActive = (to: string) => (to === '/admin' ? pathname === '/admin' : pathname.startsWith(to))

  return (
    <nav aria-label="Operação" className="space-y-5">
      {adminNavFor(can).map((group) => (
        <div key={group.label}>
          <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-zinc-500">{group.label}</p>
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.label}>
                <NavLink item={item} active={item.to !== undefined && isActive(item.to)} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function PageFallback() {
  return (
    <div className="grid place-items-center py-24 text-zinc-500" role="status" aria-label="Carregando">
      <Spinner className="size-6" />
    </div>
  )
}

/** Moldura da operação: separada do painel do usuário, com menu próprio por permissão. */
export function AdminLayout() {
  const { me } = useAdminAccess()
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()
  const navigate = useNavigate()

  useEffect(() => setMenuOpen(false), [pathname])

  async function signOut() {
    // Mesmo se o servidor não responder, a sessão local sai e a tela vai para o login.
    const { error } = await supabase.auth.signOut()
    if (error) console.error('sign out', error)
    navigate('/entrar', { replace: true })
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <a href="#conteudo" className={clsx('sr-only rounded-lg bg-surface px-3 py-2 text-sm focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50', FOCUS)}>
        Pular para o conteúdo
      </a>
      <header className="sticky top-0 z-30 border-b border-white/[0.05] bg-canvas/90 backdrop-blur-xl">
        <div className="flex h-14 items-center gap-3 px-4">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="admin-menu"
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            className={clsx('-ml-1 grid size-9 place-items-center rounded-lg text-zinc-300 hover:bg-white/[0.05] lg:hidden', FOCUS)}
          >
            {menuOpen ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
          <Logo />
          <span className="inline-flex items-center gap-1 rounded-md bg-hot/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-hot">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            Operação
          </span>
          <span className="hidden text-xs font-semibold text-zinc-400 sm:inline">{ADMIN_ROLE_LABELS[me.role]}</span>
          <div className="ml-auto flex items-center gap-1">
            <Link to="/inicio" className={clsx('inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-zinc-400 hover:text-zinc-100', FOCUS)}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Voltar ao app</span>
              <span className="sm:hidden">App</span>
            </Link>
            <button
              type="button"
              onClick={() => void signOut()}
              className={clsx('inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-zinc-400 hover:text-zinc-100', FOCUS)}
            >
              <LogOut className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Sair</span>
              <span className="sr-only sm:hidden">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-[15rem_1fr]">
        <aside
          id="admin-menu"
          className={clsx(
            'border-b border-white/[0.05] px-3 py-4 lg:sticky lg:top-14 lg:block lg:h-[calc(100dvh-3.5rem)] lg:overflow-y-auto lg:border-b-0 lg:border-r',
            menuOpen ? 'block' : 'hidden',
          )}
        >
          <AdminNav />
        </aside>
        <main id="conteudo" className="min-w-0 px-4 pb-16 pt-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  )
}
