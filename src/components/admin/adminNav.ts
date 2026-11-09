import {
  BarChart3,
  CreditCard,
  Cpu,
  LayoutDashboard,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Tags,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

export interface AdminNavItem {
  readonly label: string
  readonly icon: LucideIcon
  /** Rota pronta. Sem rota, o item aparece como "Breve", sem link (etapas 2 a 5). */
  readonly to?: string
  /** Permissão do banco que a tela usa; quem não tem não vê o item. */
  readonly permission?: string
}

export interface AdminNavGroup {
  readonly label: string
  readonly items: readonly AdminNavItem[]
}

export const ADMIN_NAV: readonly AdminNavGroup[] = [
  {
    label: 'Visão geral',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, to: '/admin', permission: 'dashboard.view' },
      { label: 'Analytics', icon: BarChart3, to: '/admin/analytics', permission: 'dashboard.view' },
    ],
  },
  {
    label: 'Operação',
    items: [
      { label: 'Usuários', icon: Users, to: '/admin/usuarios', permission: 'users.view' },
      { label: 'Gerações', icon: Sparkles, to: '/admin/geracoes', permission: 'users.view' },
      { label: 'Modelos e custos', icon: Cpu, to: '/admin/modelos', permission: 'models.view' },
    ],
  },
  {
    label: 'Comercial',
    items: [
      { label: 'Assinaturas', icon: CreditCard, to: '/admin/assinaturas', permission: 'users.view' },
      { label: 'Planos', icon: Tags, to: '/admin/planos', permission: 'plans.view' },
      { label: 'Financeiro', icon: Wallet, to: '/admin/financeiro', permission: 'finance.view' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { label: 'Auditoria', icon: ScrollText, to: '/admin/auditoria', permission: 'audit.view' },
      { label: 'Administradores', icon: UserCog, to: '/admin/administradores', permission: 'admins.manage' },
      { label: 'Segurança', icon: ShieldCheck, to: '/admin/seguranca' },
    ],
  },
]

/** Menu de quem está logado: some o que a permissão não libera; o "Breve" fica para todos. */
export function adminNavFor(can: (permission: string) => boolean): AdminNavGroup[] {
  return ADMIN_NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.permission === undefined || can(item.permission)),
  })).filter((group) => group.items.length > 0)
}
