import clsx from 'clsx'
import { ArrowLeft, Menu, X } from 'lucide-react'
import { Suspense, useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAdminAccess } from '@/hooks/useAdminAccess'
import { useSidebarCollapsed } from '@/hooks/useSidebarCollapsed'
import { supabase } from '@/lib/supabase'
import { Logo, LogoMark } from '../Logo'
import { SidebarToggle } from '../layout/SidebarToggle'
import { Spinner } from '../ui/Spinner'
import { adminNavFor, type AdminNavItem } from './adminNav'
import { ProfileMenu } from './ProfileMenu'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
const COLLAPSE_KEY = 'vynkio-admin-sidebar-collapsed'

function AdminBadge() {
  return <span className="inline-flex rounded-md bg-accent/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-accent-soft ring-1 ring-accent/25">Admin</span>
}

function NavLink({ item, active, collapsed }: { readonly item: AdminNavItem; readonly active: boolean; readonly collapsed: boolean }) {
  const Icon = item.icon
  const layout = clsx('flex min-h-9 items-center gap-3 whitespace-nowrap rounded-xl text-[14px] font-semibold', collapsed ? 'justify-center px-0' : 'px-3')
  if (!item.to) {
    return (
      <span aria-disabled="true" title={`${item.label}: em breve`} className={clsx(layout, 'cursor-default text-zinc-600')}>
        <Icon className="size-[18px] shrink-0" aria-hidden="true" />
        {collapsed ? (
          <span className="sr-only">{item.label}, em breve</span>
        ) : (
          <>
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            <span className="rounded-md bg-white/[0.05] px-1 py-px text-[9px] font-bold uppercase tracking-wide text-zinc-500">Breve</span>
          </>
        )}
      </span>
    )
  }
  return (
    <Link
      to={item.to}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      className={clsx(layout, 'relative transition-colors', FOCUS, active ? 'bg-white/[0.07] text-zinc-50' : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100')}
    >
      {active && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-accent" />}
      <Icon className={clsx('size-[18px] shrink-0', active && 'text-accent-soft')} aria-hidden="true" />
      {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
    </Link>
  )
}

function AdminNav({ collapsed }: { readonly collapsed: boolean }) {
  const { can } = useAdminAccess()
  const { pathname, search } = useLocation()
  // Item com ?aba= (Retenção, Ferramentas...) só fica ativo na própria aba; sem aba, vale a primeira.
  const isActive = (to: string) => {
    const [path, query] = to.split('?')
    if (path === '/admin') return pathname === '/admin'
    if (!pathname.startsWith(path ?? to)) return false
    if (!query) return true
    const wanted = new URLSearchParams(query).get('aba')
    const current = new URLSearchParams(search).get('aba') ?? 'retencao'
    return wanted === current
  }

  return (
    <nav aria-label="Admin" className="space-y-4">
      {adminNavFor(can).map((group) => (
        <div key={group.label}>
          {collapsed ? (
            <div aria-hidden="true" className="mx-auto mb-2 h-px w-6 bg-white/10" />
          ) : (
            <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-zinc-500">{group.label}</p>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.label}>
                <NavLink item={item} collapsed={collapsed} active={item.to !== undefined && isActive(item.to)} />
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

/** Moldura do admin: separada do app, com menu próprio por permissão e recolhível no desktop. */
export function AdminLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [collapsed, toggleCollapsed] = useSidebarCollapsed(COLLAPSE_KEY)
  const { pathname } = useLocation()
  const navigate = useNavigate()

  useEffect(() => setMenuOpen(false), [pathname])

  async function signOut() {
    // Mesmo se o servidor não responder, a sessão local sai e a tela vai para o login.
    const { error } = await supabase.auth.signOut()
    if (error) console.error('sign out', error)
    navigate('/entrar', { replace: true })
  }

  const actions = (
    <div className="ml-auto flex items-center gap-2">
      <Link to="/inicio" className={clsx('inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-zinc-400 hover:text-zinc-100', FOCUS)}>
        <ArrowLeft className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline">Voltar ao app</span>
        <span className="sm:hidden">App</span>
      </Link>
      <ProfileMenu onSignOut={() => void signOut()} />
    </div>
  )

  return (
    <div className={clsx('min-h-dvh bg-canvas [--admin-w:0px]', collapsed ? 'lg:[--admin-w:72px]' : 'lg:[--admin-w:15rem]')}>
      <a href="#conteudo" className={clsx('sr-only rounded-lg bg-surface px-3 py-2 text-sm focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50', FOCUS)}>
        Pular para o conteúdo
      </a>

      {/* Desktop: barra fixa com a marca, o selo Admin e o botão de recolher no rodapé. */}
      <aside
        aria-label="Menu do admin"
        className="fixed inset-y-0 left-0 z-40 hidden w-[var(--admin-w)] flex-col border-r border-white/[0.05] bg-canvas transition-[width] duration-200 ease-out lg:flex"
      >
        <div className={clsx('flex shrink-0 flex-col gap-2 pb-3 pt-4', collapsed ? 'items-center px-2' : 'items-start px-4')}>
          <Link to="/admin" aria-label="Vynkio Admin, dashboard" className={clsx('rounded-lg', FOCUS)}>
            {collapsed ? <LogoMark /> : <Logo />}
          </Link>
          {collapsed ? <span className="text-[9px] font-bold uppercase tracking-wider text-accent-soft">Admin</span> : <AdminBadge />}
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <AdminNav collapsed={collapsed} />
        </div>
        <div className="p-3">
          <SidebarToggle collapsed={collapsed} onToggle={toggleCollapsed} />
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b border-white/[0.05] bg-canvas/90 backdrop-blur-xl lg:border-b-0">
        <div className="flex h-14 items-center gap-3 px-4 transition-[padding] duration-200 lg:pl-[calc(var(--admin-w)+2rem)] lg:pr-8">
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
          <span className="flex items-center gap-2 lg:hidden">
            <Logo />
            <AdminBadge />
          </span>
          {actions}
        </div>
      </header>

      {/* Celular e tablet: o menu abre abaixo do topo. */}
      <div id="admin-menu" className={clsx('border-b border-white/[0.05] px-3 py-4 lg:hidden', menuOpen ? 'block' : 'hidden')}>
        <AdminNav collapsed={false} />
      </div>

      <main id="conteudo" className="min-w-0 px-4 pb-16 pt-6 transition-[padding] duration-200 lg:pl-[calc(var(--admin-w)+2rem)] lg:pr-8">
        <div className="mx-auto max-w-6xl">
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
