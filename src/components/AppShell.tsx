import clsx from 'clsx'
import { Outlet } from 'react-router-dom'
import { useSidebarCollapsed } from '@/hooks/useSidebarCollapsed'
import { MobileTabBar, MobileTopBar } from './layout/MobileNav'
import { Sidebar } from './layout/Sidebar'

/**
 * Moldura do app logado. `--sidebar-w` é a largura da barra lateral no desktop
 * (0 no celular); o conteúdo e a caixa de prompt fixa usam essa variável para
 * se alinharem à área útil.
 */
export function AppShell() {
  const [collapsed, toggleCollapsed] = useSidebarCollapsed()

  return (
    <div className={clsx('min-h-dvh pb-20 [--sidebar-w:0px] md:pb-0', collapsed ? 'md:[--sidebar-w:72px]' : 'md:[--sidebar-w:240px]')}>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-ink"
      >
        Pular para o conteúdo
      </a>
      <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} />
      <MobileTopBar />

      <main id="conteudo" className="px-4 pb-10 pt-4 transition-[padding] duration-200 sm:px-5 md:pl-[calc(var(--sidebar-w)+1.25rem)] md:pt-6">
        <Outlet />
      </main>

      <MobileTabBar />
    </div>
  )
}
