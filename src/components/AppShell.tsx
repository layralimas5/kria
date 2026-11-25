import clsx from 'clsx'
import { Suspense, useCallback, useMemo } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useAccount } from '@/hooks/useAccount'
import { PlanKindsContext } from '@/hooks/useCanCreate'
import { CommandProvider } from '@/hooks/useCommandPalette'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import { usePlanModels } from '@/hooks/usePlanModels'
import { useSidebarCollapsed } from '@/hooks/useSidebarCollapsed'
import { supabase } from '@/lib/supabase'
import { UserMenu } from './account/UserMenu'
import { appCommands, appGoShortcuts } from './command/commandSets'
import { SearchTrigger } from './command/SearchTrigger'
import { MobileTabBar, MobileTopBar } from './layout/MobileNav'
import { NotificationsMenu } from './layout/NotificationsMenu'
import { BrandSwitcher } from './workspace/BrandSwitcher'
import { Sidebar } from './layout/Sidebar'
import { Spinner } from './ui/Spinner'

/**
 * Moldura do app logado. `--sidebar-w` é a largura reservada para o painel flutuante no desktop
 * (margem + painel; 0 no celular); o conteúdo e a caixa de prompt fixa usam essa variável para
 * se alinharem à área útil. A busca global (Ctrl+K) e os atalhos valem em todas as telas.
 */
export function AppShell() {
  const [collapsed, toggleCollapsed] = useSidebarCollapsed()
  const { plan } = useAccount()
  const { kinds } = usePlanModels()
  const isAdmin = useIsAdmin()
  const navigate = useNavigate()

  const signOut = useCallback(() => {
    void supabase.auth.signOut().then(({ error }) => {
      if (error) console.error('sign out', error)
      navigate('/entrar', { replace: true })
    })
  }, [navigate])
  const commands = useMemo(() => appCommands(plan, kinds, { toggleSidebar: toggleCollapsed, signOut }, isAdmin), [plan, kinds, toggleCollapsed, signOut, isAdmin])
  const goShortcuts = useMemo(() => appGoShortcuts(kinds), [kinds])

  return (
    <PlanKindsContext.Provider value={kinds}>
      <CommandProvider scope="app" commands={commands} goShortcuts={goShortcuts}>
        <div className={clsx('relative min-h-dvh pb-20 [--sidebar-w:0px] md:pb-0', collapsed ? 'md:[--sidebar-w:5.25rem]' : 'md:[--sidebar-w:16.5rem]')}>
          <div aria-hidden="true" className="ambient-bg" />
          <a
            href="#conteudo"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-ink"
          >
            Pular para o conteúdo
          </a>
          <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} />
          <MobileTopBar />

          <header className="glass-bar sticky top-0 z-30 hidden h-14 items-center gap-3 border-b border-white/[0.04] px-5 transition-[margin] duration-200 md:ml-[var(--sidebar-w)] md:flex">
            <SearchTrigger className="xl:absolute xl:left-1/2 xl:w-[22rem] xl:-translate-x-1/2" />
            <div className="ml-auto flex items-center gap-3">
              <BrandSwitcher />
              <NotificationsMenu />
              <UserMenu />
            </div>
          </header>

          <main id="conteudo" className="relative z-10 px-4 pb-10 pt-4 transition-[padding] duration-200 sm:px-5 md:pl-[calc(var(--sidebar-w)+1.25rem)] md:pt-5">
            {/* A moldura fica montada enquanto a página carrega. */}
            <Suspense
              fallback={
                <div className="grid place-items-center py-24 text-zinc-500" role="status" aria-label="Carregando">
                  <Spinner className="size-6" />
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </main>

          <MobileTabBar />
        </div>
      </CommandProvider>
    </PlanKindsContext.Provider>
  )
}
