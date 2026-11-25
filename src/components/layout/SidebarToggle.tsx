import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { SideNavItem } from './SideNav'

interface SidebarToggleProps {
  readonly collapsed: boolean
  readonly onToggle: () => void
}

/** Rodapé da barra lateral: recolhe para só os ícones e volta. Vale no app e no admin. */
export function SidebarToggle({ collapsed, onToggle }: SidebarToggleProps) {
  return (
    <SideNavItem
      label={collapsed ? 'Expandir menu' : 'Recolher menu'}
      icon={collapsed ? PanelLeftOpen : PanelLeftClose}
      collapsed={collapsed}
      onClick={onToggle}
      ariaExpanded={!collapsed}
      iconClassName="text-zinc-500"
    />
  )
}
