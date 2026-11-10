import clsx from 'clsx'
import { Suspense, useCallback, useMemo } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useAccount } from '@/hooks/useAccount'
import { CommandProvider } from '@/hooks/useCommandPalette'
import { usePlanModels } from '@/hooks/usePlanModels'
import { useSidebarCollapsed } from '@/hooks/useSidebarCollapsed'
import { supabase } from '@/lib/supabase'
import { UserMenu } from './account/UserMenu'
import { APP_GO_SHORTCUTS, appCommands } from './command/commandSets'
import { SearchTrigger } from './command/SearchTrigger'
import { MobileTabBar, MobileTopBar } from './layout/MobileNav'
import { NotificationsMenu } from './layout/NotificationsMenu'
import { BrandSwitcher } from './workspace/BrandSwitcher'
import { Sidebar } from './layout/Sidebar'
import { Spinner } from './ui/Spinner'

/**
 * Moldura do app logado. `--sidebar-w` é a largura da barra lateral no desktop
 * (0 no celular); o conteúdo e a caixa de prompt fixa usam essa variável para
 * se alinharem à área útil. A busca global (Ctrl+K) e os atalhos valem em todas as telas.
 */
export function AppShell() {
  const [collapsed, toggleCollapsed] = useSidebarCollapsed()
  const { plan } = useAccount()
  const { kinds } = usePlanModels()
  const navigate = useNavigate()

  const signOut = useCallback(() => {
    void supabase.auth.signOut().then(({ error }) => {
      if (error) console.error('sign out', error)
      navigate('/entrar', { replace: true })
    })
  }, [navigate])
  const commands = useMemo(() => appCommands(plan, kinds, { toggleSidebar: toggleCollapsed, signOut }), [plan, kinds, toggleCollapsed, signOut])

  return (
    <CommandProvider scope="app" commands={commands} goShortcuts={APP_GO_SHORTCUTS}>
      <div className={clsx('relative min-h-dvh pb-20 [--sidebar-w:0px] md:pb-0', collapsed ? 'md:[--sidebar-w:72px]' : 'md:[--sidebar-w:256px]')}>
        <div aria-hidden="true" className="ambient-bg" />
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-ink"
        >
          Pular para o conteúdo
        </a>
        <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} />
        <MobileTopBar />

        <header className="glass-bar sticky top-0 z-30 hidden h-14 items-center gap-3 border-b border-white/[0.04] pl-[calc(var(--sidebar-w)+1.25rem)] pr-5 transition-[padding] duration-200 md:flex">
          <SearchTrigger />
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
  )
}
