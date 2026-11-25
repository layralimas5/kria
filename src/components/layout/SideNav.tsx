import clsx from 'clsx'
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { useState, type FocusEvent, type MouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft/70'
const SPRING = { type: 'spring', stiffness: 520, damping: 42, mass: 0.8 } as const

interface SidePanelProps {
  readonly label: string
  /** Nome do grupo de animação: o destaque do item ativo desliza só dentro do próprio painel. */
  readonly id: string
  /** Largura total reservada (margem + painel), lida de uma variável CSS da moldura. */
  readonly widthVar: string
  readonly className?: string
  readonly children: ReactNode
}

/** Painel lateral flutuante, solto das bordas, com cantos bem arredondados. */
export function SidePanel({ label, id, widthVar, className, children }: SidePanelProps) {
  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup id={id}>
        <aside
          aria-label={label}
          style={{ width: `calc(var(${widthVar}) - 0.75rem)` }}
          className={clsx(
            'sidebar-surface fixed bottom-3 left-3 top-3 z-40 hidden flex-col overflow-hidden rounded-[26px] transition-[width] duration-200 ease-out',
            className,
          )}
        >
          {children}
        </aside>
      </LayoutGroup>
    </MotionConfig>
  )
}

/** Linha fina entre grupos, mais forte no meio e sumindo nas pontas. */
export function SideNavDivider({ collapsed }: { readonly collapsed: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={clsx('my-2.5 h-px bg-gradient-to-r from-transparent via-white/[0.09] to-transparent', collapsed ? 'mx-auto w-8' : 'mx-2')}
    />
  )
}

/** Número ao lado do item (chamados, mensagens), em pílula com contorno. */
export function SideNavCount({ value, collapsed }: { readonly value: number; readonly collapsed: boolean }) {
  const text = value > 99 ? '99+' : String(value)
  if (collapsed) {
    return (
      <span
        aria-hidden="true"
        className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[9px] font-semibold tabular-nums leading-4 text-white ring-2 ring-[#0d0d10]"
      >
        {text}
      </span>
    )
  }
  return (
    <span aria-hidden="true" className="rounded-md px-1.5 text-[11px] font-medium tabular-nums leading-5 text-zinc-300 ring-1 ring-inset ring-white/[0.14]">
      {text}
    </span>
  )
}

/** Nome do item ao lado do ícone quando o menu está recolhido. Vai para o body: o painel corta o que passa da borda. */
function CollapsedTooltip({ anchor, label }: { readonly anchor: DOMRect | null; readonly label: string }) {
  return createPortal(
    <AnimatePresence>
      {anchor && (
        <motion.div
          aria-hidden="true"
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -4 }}
          transition={{ duration: 0.12 }}
          style={{ left: anchor.right + 14, top: anchor.top + anchor.height / 2 }}
          className="pointer-events-none fixed z-[60] -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#17171b] px-2.5 py-1.5 text-[12.5px] font-medium text-zinc-100 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.09),0_8px_24px_-8px_rgb(0_0_0/0.9)]"
        >
          {label}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

interface SideNavItemProps {
  readonly label: string
  readonly icon: LucideIcon
  readonly collapsed: boolean
  readonly active?: boolean
  /** Com rota vira link; com `onClick` vira botão; sem os dois, é "Breve" (visível, sem ação). */
  readonly to?: string
  readonly onClick?: () => void
  /** Texto para leitor de tela quando difere do rótulo (contagem, estado). */
  readonly accessibleLabel?: string
  /** O que vai à direita no menu aberto (selo, contagem, seta). */
  readonly trailing?: ReactNode
  /** O que vai no canto do ícone no menu recolhido (contagem). */
  readonly corner?: ReactNode
  readonly iconClassName?: string
  readonly ariaExpanded?: boolean
}

export function SideNavItem({
  label,
  icon: Icon,
  collapsed,
  active = false,
  to,
  onClick,
  accessibleLabel,
  trailing,
  corner,
  iconClassName,
  ariaExpanded,
}: SideNavItemProps) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const soon = to === undefined && onClick === undefined
  const showTip = (target: HTMLElement) => collapsed && setAnchor(target.getBoundingClientRect())
  const hideTip = () => setAnchor(null)

  const className = clsx(
    'group relative flex h-10 items-center gap-3 whitespace-nowrap text-left text-[14px] font-medium transition-colors duration-150',
    collapsed ? 'mx-auto w-10 justify-center rounded-full' : 'w-full rounded-[14px] px-3',
    soon ? 'cursor-default text-zinc-600' : active ? 'text-white' : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100',
    !soon && FOCUS,
  )

  const body = (
    <>
      {active && (
        <motion.span
          layoutId="side-nav-active"
          transition={SPRING}
          aria-hidden="true"
          className={clsx('absolute inset-0', collapsed ? 'nav-active-dot rounded-full' : 'nav-active rounded-[14px]')}
        />
      )}
      <Icon
        strokeWidth={1.75}
        className={clsx(
          'relative size-[18px] shrink-0 transition-colors',
          active ? 'text-white' : !soon && 'group-hover:text-zinc-100',
          iconClassName,
        )}
        aria-hidden="true"
      />
      {collapsed ? (
        corner
      ) : (
        <>
          <span className="relative min-w-0 flex-1 truncate">{label}</span>
          {soon ? (
            <span className="relative rounded-md px-1.5 text-[10px] font-medium leading-5 text-zinc-500 ring-1 ring-inset ring-white/[0.08]">Breve</span>
          ) : (
            trailing && <span className="relative flex shrink-0 items-center">{trailing}</span>
          )}
        </>
      )}
    </>
  )

  const shared = {
    className,
    'aria-label': collapsed || accessibleLabel ? (accessibleLabel ?? label) : undefined,
    onMouseEnter: (event: MouseEvent<HTMLElement>) => showTip(event.currentTarget),
    onMouseLeave: hideTip,
    onFocus: (event: FocusEvent<HTMLElement>) => showTip(event.currentTarget),
    onBlur: hideTip,
  }

  return (
    <div className="relative">
      {/* Fio roxo colado na borda do painel, como marcador do item ativo. */}
      {active && (
        <motion.span
          layoutId="side-nav-bar"
          transition={SPRING}
          aria-hidden="true"
          className="absolute -left-[9px] top-1/2 h-[18px] w-[3px] -translate-y-1/2 rounded-full bg-accent-strong shadow-[0_0_10px_1px_rgb(139_92_246/0.8)]"
        />
      )}
      {soon ? (
        <span {...shared} aria-disabled="true" aria-label={`${label}, em breve`}>
          {body}
        </span>
      ) : to !== undefined ? (
        <Link to={to} aria-current={active ? 'page' : undefined} {...shared}>
          {body}
        </Link>
      ) : (
        <button type="button" onClick={onClick} aria-expanded={ariaExpanded} {...shared}>
          {body}
        </button>
      )}
      {collapsed && <CollapsedTooltip anchor={anchor} label={soon ? `${label} · em breve` : label} />}
    </div>
  )
}
