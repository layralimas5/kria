import clsx from 'clsx'
import { Coins, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { formatCredits } from '@/domain/format'
import { useAccount } from '@/hooks/useAccount'
import { useBalance } from '@/hooks/useBalance'
import { Logo, LogoMark } from '../Logo'
import { Badge } from '../ui/Badge'
import { navGroupsFor, type NavItem } from './nav'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

interface SidebarProps {
  readonly collapsed: boolean
  readonly onToggle: () => void
}

/** Ferramenta que ainda não existe: visível para a pessoa saber o que vem, mas sem ação. */
function SoonTab({ item, collapsed }: { readonly item: NavItem; readonly collapsed: boolean }) {
  const Icon = item.icon
  return (
    <span
      aria-disabled="true"
      title={`${item.label}: em breve`}
      className={clsx(
        'flex min-h-9 cursor-default items-center gap-3 whitespace-nowrap rounded-xl text-[14px] font-semibold text-zinc-600',
        collapsed ? 'justify-center px-0' : 'px-3',
      )}
    >
      <Icon className="size-[18px] shrink-0" aria-hidden="true" />
      {collapsed ? (
        <span className="sr-only">{item.label}, em breve</span>
      ) : (
        <>
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          <span className="shrink-0 rounded-md bg-white/[0.05] px-1 py-px text-[9px] font-bold uppercase tracking-wide text-zinc-500">Breve</span>
        </>
      )}
    </span>
  )
}

function Tab({ item, collapsed, active }: { readonly item: NavItem; readonly collapsed: boolean; readonly active: boolean }) {
  if (item.soon) return <SoonTab item={item} collapsed={collapsed} />
  const Icon = item.icon
  return (
    <Link
      to={item.to}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      className={clsx(
        'group relative flex min-h-9 items-center gap-3 whitespace-nowrap rounded-xl text-[14px] font-semibold transition-colors',
        FOCUS,
        collapsed ? 'justify-center px-0' : 'px-3',
        active ? 'bg-white/[0.07] text-zinc-50' : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100',
      )}
    >
      {active && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-accent" />}
      <Icon className={clsx('size-[18px] shrink-0', active && 'text-accent')} aria-hidden="true" />
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {item.badge && <Badge className="shrink-0">{item.badge}</Badge>}
        </>
      )}
    </Link>
  )
}

function CreditsCard({ collapsed }: { readonly collapsed: boolean }) {
  const { balance } = useBalance()
  const { plan } = useAccount()

  if (collapsed) {
    return (
      <Link
        to="/creditos"
        title="Comprar créditos"
        aria-label={balance === null ? 'Créditos' : `${balance} créditos. Comprar mais`}
        className={clsx('flex flex-col items-center gap-1 rounded-xl bg-surface-2 py-2.5 text-[11px] font-bold tabular-nums text-zinc-100', FOCUS)}
      >
        <Coins className="size-4 text-accent" aria-hidden="true" />
        {balance ?? '...'}
      </Link>
    )
  }

  return (
    <div className="rounded-2xl bg-surface-2 p-3 ring-1 ring-white/[0.05]">
      <p className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-zinc-500">
        Seu saldo
        {plan && (
          <Link to="/assinatura" className={clsx('rounded normal-case tracking-normal text-zinc-400 hover:text-zinc-100', FOCUS)}>
            Plano {plan.name}
          </Link>
        )}
      </p>
      <p className="mt-1 flex items-center gap-1.5 text-lg font-bold tabular-nums text-zinc-50">
        <Coins className="size-4 text-accent" aria-hidden="true" />
        {balance === null ? '...' : formatCredits(balance)}
      </p>
      <Link
        to="/creditos"
        className={clsx('btn-accent mt-3 flex min-h-9 items-center justify-center rounded-lg text-[13px] font-semibold', FOCUS)}
      >
        Comprar créditos
      </Link>
    </div>
  )
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const { plan } = useAccount()

  return (
    <aside
      aria-label="Menu"
      className="fixed inset-y-0 left-0 z-40 hidden w-[var(--sidebar-w)] flex-col border-r border-white/[0.05] bg-canvas transition-[width] duration-200 ease-out md:flex"
    >
      <div className={clsx('flex h-16 shrink-0 items-center', collapsed ? 'justify-center' : 'px-4')}>
        <Link to="/inicio" aria-label="Kria IA, início" className={clsx('rounded-lg', FOCUS)}>
          {collapsed ? <LogoMark /> : <Logo />}
        </Link>
      </div>

      <nav aria-label="Principal" className={clsx('flex-1 space-y-4 overflow-y-auto py-2', collapsed ? 'px-3' : 'px-3')}>
        {navGroupsFor(plan).map((group) => (
          <div key={group.title}>
            {collapsed ? (
              <div aria-hidden="true" className="mx-auto mb-2 h-px w-6 bg-white/10" />
            ) : (
              <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-zinc-500">{group.title}</p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.label}>
                  <Tab item={item} collapsed={collapsed} active={item.isActive(pathname, params)} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-2 p-3">
        <CreditsCard collapsed={collapsed} />
        <div className={clsx('flex', collapsed ? 'justify-center' : 'justify-end')}>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            className={clsx('grid size-9 place-items-center rounded-lg text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-zinc-100', FOCUS)}
          >
            {collapsed ? <PanelLeftOpen className="size-4" aria-hidden="true" /> : <PanelLeftClose className="size-4" aria-hidden="true" />}
          </button>
        </div>
      </div>
    </aside>
  )
}
