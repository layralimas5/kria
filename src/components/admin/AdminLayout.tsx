import clsx from 'clsx'
import { LayoutGroup } from 'framer-motion'
import { ArrowLeft, ChevronRight, Menu, X } from 'lucide-react'
import { Fragment, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAdminAccess } from '@/hooks/useAdminAccess'
import { CommandProvider } from '@/hooks/useCommandPalette'
import { useSidebarCollapsed } from '@/hooks/useSidebarCollapsed'
import { useSupportAttention } from '@/hooks/useSupportAttention'
import { supabase } from '@/lib/supabase'
import { ADMIN_GO_SHORTCUTS, adminCommands, searchAdminUsers } from '../command/commandSets'
import { SearchTrigger } from '../command/SearchTrigger'
import { Logo, LogoMark } from '../Logo'
import { SideNavCount, SideNavDivider, SideNavItem, SidePanel } from '../layout/SideNav'
import { SidebarToggle } from '../layout/SidebarToggle'
import { Spinner } from '../ui/Spinner'
import { ADMIN_NAV, adminNavFor } from './adminNav'
import { ProfileMenu } from './ProfileMenu'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft/70'
const COLLAPSE_KEY = 'vynkio-admin-sidebar-collapsed'

function AdminBadge() {
  return <span className="inline-flex rounded-md px-1.5 text-[10.5px] font-medium uppercase leading-5 tracking-wider text-zinc-300 ring-1 ring-inset ring-white/[0.14]">Admin</span>
}

/** Item com ?aba= (Retenção, Ferramentas...) só fica ativo na própria aba; sem aba, vale a primeira. */
function useIsActive() {
  const { pathname, search } = useLocation()
  return (to: string) => {
    const [path, query] = to.split('?')
    if (path === '/admin') return pathname === '/admin'
    if (!pathname.startsWith(path ?? to)) return false
    if (!query) return true
    const wanted = new URLSearchParams(query).get('aba')
    const current = new URLSearchParams(search).get('aba') ?? 'retencao'
    return wanted === current
  }
}

function AdminNav({ collapsed }: { readonly collapsed: boolean }) {
  const { can } = useAdminAccess()
  const isActive = useIsActive()
  const supportCount = useSupportAttention(can('support.view'))

  return (
    <nav aria-label="Admin">
      {adminNavFor(can).map((group, index) => (
        <Fragment key={group.label}>
          {index > 0 && <SideNavDivider collapsed={collapsed} />}
          <ul aria-label={group.label} className="space-y-1">
            {group.items.map((item) => {
              const count = item.counter === 'support' ? supportCount : 0
              return (
                <li key={item.label}>
                  <SideNavItem
                    label={item.label}
                    icon={item.icon}
                    to={item.to}
                    collapsed={collapsed}
                    active={item.to !== undefined && isActive(item.to)}
                    accessibleLabel={count > 0 ? `${item.label}, ${count} pedindo atenção` : undefined}
                    trailing={count > 0 && <SideNavCount value={count} collapsed={false} />}
                    corner={count > 0 && <SideNavCount value={count} collapsed />}
                  />
                </li>
              )
            })}
          </ul>
        </Fragment>
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
      <div className={clsx('relative min-h-dvh bg-canvas [--admin-w:0px]', collapsed ? 'lg:[--admin-w:5.25rem]' : 'lg:[--admin-w:16.5rem]')}>
        <div aria-hidden="true" className="ambient-bg print:hidden" />
        <a href="#conteudo" className={clsx('sr-only rounded-lg bg-surface px-3 py-2 text-sm focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50', FOCUS)}>
          Pular para o conteúdo
        </a>

        {/* Desktop: painel flutuante com a marca, o selo Admin e o botão de recolher no rodapé. */}
        <SidePanel label="Menu do admin" id="admin-sidebar" widthVar="--admin-w" className="lg:flex print:!hidden">
          <div className={clsx('flex h-[60px] shrink-0 items-center gap-2', collapsed ? 'justify-center' : 'px-5')}>
            <Link to="/admin" aria-label="Vynkio Admin, dashboard" className={clsx('rounded-lg', FOCUS)}>
              {collapsed ? <LogoMark /> : <Logo />}
            </Link>
            {!collapsed && <AdminBadge />}
          </div>
          <SideNavDivider collapsed={collapsed} />
          <div className="scrollbar-none flex-1 overflow-y-auto px-3 pb-4 [mask-image:linear-gradient(to_bottom,black_calc(100%-2rem),transparent)]">
            <AdminNav collapsed={collapsed} />
          </div>
          <div className="p-3 pt-1">
            <SideNavDivider collapsed={collapsed} />
            <SidebarToggle collapsed={collapsed} onToggle={toggleCollapsed} />
          </div>
        </SidePanel>

        <header className="glass-bar sticky top-0 z-30 border-b border-white/[0.05] transition-[margin] duration-200 lg:ml-[var(--admin-w)] print:hidden">
          <div className="relative flex h-14 items-center gap-3 px-4 lg:px-8">
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
            <SearchTrigger className="hidden md:flex xl:absolute xl:left-1/2 xl:w-[22rem] xl:-translate-x-1/2" />
            <SearchTrigger compact className="md:hidden" />
            {actions}
          </div>
        </header>

        {/* Celular e tablet: o menu abre abaixo do topo. */}
        <div id="admin-menu" className={clsx('border-b border-white/[0.05] px-3 py-4 lg:hidden', menuOpen ? 'block' : 'hidden')}>
          <LayoutGroup id="admin-mobile">
            <AdminNav collapsed={false} />
          </LayoutGroup>
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
