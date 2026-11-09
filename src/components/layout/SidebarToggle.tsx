import clsx from 'clsx'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'

interface SidebarToggleProps {
  readonly collapsed: boolean
  readonly onToggle: () => void
}

/** Rodapé da barra lateral: recolhe para só os ícones e volta. Vale no app e no admin. */
export function SidebarToggle({ collapsed, onToggle }: SidebarToggleProps) {
  const label = collapsed ? 'Expandir menu' : 'Recolher menu'
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      aria-label={label}
      title={label}
      className={clsx(
        'flex min-h-9 w-full items-center gap-3 rounded-xl text-[13px] font-semibold text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        collapsed ? 'justify-center px-0' : 'px-3',
      )}
    >
      <Icon className="size-[18px] shrink-0" aria-hidden="true" />
      {!collapsed && <span>{label}</span>}
    </button>
  )
}
