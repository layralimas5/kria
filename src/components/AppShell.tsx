import clsx from 'clsx'
import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { useSidebarCollapsed } from '@/hooks/useSidebarCollapsed'
import { UserMenu } from './account/UserMenu'
import { MobileTabBar, MobileTopBar } from './layout/MobileNav'
import { Sidebar } from './layout/Sidebar'
import { Spinner } from './ui/Spinner'

/**
 * Moldura do app logado. `--sidebar-w` é a largura da barra lateral no desktop
 * (0 no celular); o conteúdo e a caixa de prompt fixa usam essa variável para
 * se alinharem à área útil.
 */
export function AppShell() {
  const [collapsed, toggleCollapsed] = useSidebarCollapsed()

  return (
    <div className={clsx('min-h-dvh pb-20 [--sidebar-w:0px] md:pb-0', collapsed ? 'md:[--sidebar-w:72px]' : 'md:[--sidebar-w:256px]')}>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-ink"
      >
        Pular para o conteúdo
      </a>
      <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} />
      <MobileTopBar />

      <header className="sticky top-0 z-30 hidden h-14 items-center justify-end bg-canvas/85 pl-[calc(var(--sidebar-w)+1.25rem)] pr-5 backdrop-blur-xl transition-[padding] duration-200 md:flex">
        <UserMenu />
      </header>

      <main id="conteudo" className="px-4 pb-10 pt-4 transition-[padding] duration-200 sm:px-5 md:pl-[calc(var(--sidebar-w)+1.25rem)] md:pt-1">
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
  )
}
