import clsx from 'clsx'
import { Coins, Plus } from 'lucide-react'
import { Fragment } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { formatCredits } from '@/domain/format'
import { useAccount } from '@/hooks/useAccount'
import { usePlanModels } from '@/hooks/usePlanModels'
import { useBalance } from '@/hooks/useBalance'
import { Logo, LogoMark } from '../Logo'
import { Badge } from '../ui/Badge'
import { navGroupsFor } from './nav'
import { AdminShortcut } from './AdminShortcut'
import { SideNavDivider, SideNavItem, SidePanel } from './SideNav'
import { SidebarToggle } from './SidebarToggle'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft/70'

interface SidebarProps {
  readonly collapsed: boolean
  readonly onToggle: () => void
}

function CreditsCard({ collapsed }: { readonly collapsed: boolean }) {
  const { balance } = useBalance()
  const { plan } = useAccount()

  if (collapsed) {
    return (
      <SideNavItem
        label={balance === null ? 'Créditos' : `${formatCredits(balance)} créditos`}
        accessibleLabel={balance === null ? 'Créditos' : `${balance} créditos. Comprar mais`}
        icon={Coins}
        to="/creditos"
        collapsed
        iconClassName="text-accent-soft"
      />
    )
  }

  return (
    <div className="rounded-[18px] bg-white/[0.025] p-3 ring-1 ring-inset ring-white/[0.06]">
      <div className="flex items-center justify-between text-[12px] text-zinc-500">
        <span>Saldo</span>
        {plan && (
          <Link to="/assinatura" className={clsx('rounded text-zinc-400 transition-colors hover:text-zinc-100', FOCUS)}>
            Plano {plan.name}
          </Link>
        )}
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[17px] font-semibold tabular-nums tracking-tight text-zinc-50">
          <Coins className="size-4 text-accent-soft" strokeWidth={1.75} aria-hidden="true" />
          {balance === null ? '...' : formatCredits(balance)}
        </p>
        <Link
          to="/creditos"
          aria-label="Comprar créditos"
          title="Comprar créditos"
          className={clsx('btn-accent grid size-8 place-items-center rounded-full', FOCUS)}
        >
          <Plus className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const { plan } = useAccount()
  const { kinds } = usePlanModels()

  return (
    <SidePanel label="Menu" id="app-sidebar" widthVar="--sidebar-w" className="md:flex">
      <div className={clsx('flex h-[60px] shrink-0 items-center', collapsed ? 'justify-center' : 'px-5')}>
        <Link to="/inicio" aria-label="Vynkio, início" className={clsx('rounded-lg', FOCUS)}>
          {collapsed ? <LogoMark /> : <Logo />}
        </Link>
      </div>
      <SideNavDivider collapsed={collapsed} />

      <nav aria-label="Principal" className="scrollbar-none flex-1 overflow-y-auto px-3 pb-4 [mask-image:linear-gradient(to_bottom,black_calc(100%-2rem),transparent)]">
        {navGroupsFor(plan, kinds).map((group, index) => (
          <Fragment key={group.title}>
            {index > 0 && <SideNavDivider collapsed={collapsed} />}
            <ul aria-label={group.title} className="space-y-1">
              {group.items.map((item) => (
                <li key={item.label}>
                  <SideNavItem
                    label={item.label}
                    icon={item.icon}
                    to={item.soon ? undefined : item.to}
                    collapsed={collapsed}
                    active={item.isActive(pathname, params)}
                    trailing={item.badge && <Badge>{item.badge}</Badge>}
                  />
                </li>
              ))}
            </ul>
          </Fragment>
        ))}
      </nav>

      <div className="space-y-1.5 p-3 pt-1">
        <SideNavDivider collapsed={collapsed} />
        <AdminShortcut collapsed={collapsed} />
        <CreditsCard collapsed={collapsed} />
        <SidebarToggle collapsed={collapsed} onToggle={onToggle} />
      </div>
    </SidePanel>
  )
}
