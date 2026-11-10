import clsx from 'clsx'
import { ArrowLeft, ChevronRight, Menu, X } from 'lucide-react'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAdminAccess } from '@/hooks/useAdminAccess'
import { CommandProvider } from '@/hooks/useCommandPalette'
import { useSidebarCollapsed } from '@/hooks/useSidebarCollapsed'
import { supabase } from '@/lib/supabase'
import { ADMIN_GO_SHORTCUTS, adminCommands, searchAdminUsers } from '../command/commandSets'
import { SearchTrigger } from '../command/SearchTrigger'
import { Logo, LogoMark } from '../Logo'
import { SidebarToggle } from '../layout/SidebarToggle'
import { Spinner } from '../ui/Spinner'
import { ADMIN_NAV, adminNavFor, type AdminNavItem } from './adminNav'
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
      className={clsx(layout, 'group relative transition-colors', FOCUS, active ? 'nav-active text-zinc-50' : 'text-zinc-400 hover:bg-white/[0.045] hover:text-zinc-100')}
    >
      {active && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-accent-strong shadow-[0_0_12px_2px_rgb(139_92_246/0.7)]" />}
      <Icon className={clsx('size-[18px] shrink-0 transition-colors', active ? 'text-accent-soft' : 'group-hover:text-zinc-200')} aria-hidden="true" />
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
            <p className="mb-1.5 px-3 text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500">{group.label}</p>
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

/** Onde a pessoa está ("Comercial › Financeiro"), lido do menu. */
function Breadcrumb() {
  const { pathname, search } = useLocation()
  const tab = new URLSearchParams(search).get('aba')
  const match = ADMIN_NAV.flatMap((group) => group.items.map((item) => ({ group: group.label, item }))).find(({ item }) => {
    if (!item.to) return false
    const [path, query] = item.to.split('?')
    if (path === '/admin') return pathname === '/admin'
    if (!pathname.startsWith(path ?? '')) return false
    return !query || new URLSearchParams(query).get('aba') === (tab ?? 'retencao')
  })
  if (!match) return null
  return (
    <nav aria-label="Você está em" className="hidden min-w-0 items-center gap-1.5 text-[13px] xl:flex">
      <span className="text-zinc-500">{match.group}</span>
      <ChevronRight className="size-3.5 shrink-0 text-zinc-600" aria-hidden="true" />
      <span aria-current="page" className="truncate font-semibold text-zinc-200">
        {match.item.label}
      </span>
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
  const { can } = useAdminAccess()

  useEffect(() => setMenuOpen(false), [pathname])

  const signOut = useCallback(async () => {
    // Mesmo se o servidor não responder, a sessão local sai e a tela vai para o login.
    const { error } = await supabase.auth.signOut()
    if (error) console.error('sign out', error)
    navigate('/entrar', { replace: true })
  }, [navigate])
  const commands = useMemo(() => adminCommands(can, { toggleSidebar: toggleCollapsed, signOut: () => void signOut() }), [can, toggleCollapsed, signOut])

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
    <CommandProvider scope="admin" commands={commands} goShortcuts={ADMIN_GO_SHORTCUTS} search={can('users.view') ? searchAdminUsers : undefined}>
      <div className={clsx('relative min-h-dvh bg-canvas [--admin-w:0px]', collapsed ? 'lg:[--admin-w:72px]' : 'lg:[--admin-w:15rem]')}>
        <div aria-hidden="true" className="ambient-bg print:hidden" />
        <a href="#conteudo" className={clsx('sr-only rounded-lg bg-surface px-3 py-2 text-sm focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50', FOCUS)}>
          Pular para o conteúdo
        </a>

        {/* Desktop: barra fixa com a marca, o selo Admin e o botão de recolher no rodapé. */}
        <aside
          aria-label="Menu do admin"
          className="sidebar-surface fixed inset-y-0 left-0 z-40 hidden w-[var(--admin-w)] flex-col border-r border-white/[0.06] transition-[width] duration-200 ease-out lg:flex print:!hidden"
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

        <header className="glass-bar sticky top-0 z-30 border-b border-white/[0.05] print:hidden">
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
              <span className="hidden min-[420px]:inline-flex">
                <AdminBadge />
              </span>
            </span>
            <Breadcrumb />
            <SearchTrigger className="hidden md:flex xl:ml-4" />
            <SearchTrigger compact className="md:hidden" />
            {actions}
          </div>
        </header>

        {/* Celular e tablet: o menu abre abaixo do topo. */}
        <div id="admin-menu" className={clsx('border-b border-white/[0.05] px-3 py-4 lg:hidden', menuOpen ? 'block' : 'hidden')}>
          <AdminNav collapsed={false} />
        </div>

        <main id="conteudo" className="relative z-10 min-w-0 px-4 pb-16 pt-6 transition-[padding] duration-200 lg:pl-[calc(var(--admin-w)+2rem)] lg:pr-8 print:!p-0">
          <div className="mx-auto max-w-6xl">
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </CommandProvider>
  )
}
