import {
  BookOpen,
  Clapperboard,
  Coins,
  CreditCard,
  FolderKanban,
  House,
  ImageIcon,
  Images,
  Megaphone,
  PenLine,
  Settings,
  UserRound,
  Waves,
  type LucideIcon,
} from 'lucide-react'
import { PLAN_TOOL_INFO, planIncludes, type PlanTool } from '@/domain/plans'
import type { Plan } from '@/domain/types'

export interface NavItem {
  readonly label: string
  readonly to: string
  readonly icon: LucideIcon
  readonly badge?: 'NOVO' | 'TOP'
  /** Ferramenta de fase futura: aparece no menu sem link nem ação. */
  readonly soon?: true
  /** Só aparece para o plano que inclui essa ferramenta. Sem `tool`, é de todos. */
  readonly tool?: PlanTool
  /** Imagem e Vídeo apontam para a mesma rota; quem decide o ativo é o `?modo`. */
  readonly isActive: (pathname: string, params: URLSearchParams) => boolean
}

export interface NavGroup {
  readonly title: string
  readonly items: readonly NavItem[]
}

const isStudioMode = (mode: 'image' | 'video') => (pathname: string, params: URLSearchParams) =>
  pathname === '/estudio' && (params.get('modo') === 'video' ? 'video' : 'image') === mode

const isPath = (path: string) => (pathname: string) => pathname === path
const never = () => false

export const HOME_TAB: NavItem = { label: 'Início', to: '/inicio', icon: House, isActive: isPath('/inicio') }
export const PERSONAS_TAB: NavItem = { label: 'Criar personagem', to: '/personas', icon: UserRound, badge: 'TOP', isActive: isPath('/personas') }
export const IMAGE_TAB: NavItem = { label: 'Gerar imagem', to: '/estudio?modo=imagem', icon: ImageIcon, isActive: isStudioMode('image') }
export const VIDEO_TAB: NavItem = { label: 'Gerar vídeo', to: '/estudio?modo=video', icon: Clapperboard, badge: 'NOVO', isActive: isStudioMode('video') }
export const GALLERY_TAB: NavItem = { label: 'Minhas criações', to: '/galeria', icon: Images, isActive: isPath('/galeria') }
export const CREDITS_TAB: NavItem = { label: 'Créditos', to: '/creditos', icon: Coins, isActive: isPath('/creditos') }
export const SUBSCRIPTION_TAB: NavItem = { label: 'Assinatura', to: '/assinatura', icon: CreditCard, isActive: isPath('/assinatura') }
export const SETTINGS_TAB: NavItem = { label: 'Configurações', to: '/conta/configuracoes', icon: Settings, isActive: isPath('/conta/configuracoes') }

/** Ferramenta de fase futura, liberada por plano. Quando existir, ganha rota própria aqui. */
const toolTab = (tool: PlanTool, icon: LucideIcon): NavItem => ({ label: PLAN_TOOL_INFO[tool].label, to: '', icon, soon: true, tool, isActive: never })

const NAV_GROUPS: readonly NavGroup[] = [
  { title: 'krIA', items: [HOME_TAB] },
  {
    title: 'Criar',
    items: [
      PERSONAS_TAB,
      IMAGE_TAB,
      VIDEO_TAB,
      toolTab('motion_control', Waves),
      toolTab('ugc_studio', Megaphone),
      toolTab('copy', PenLine),
    ],
  },
  { title: 'Biblioteca', items: [toolTab('prompt_library', BookOpen), toolTab('projects', FolderKanban), GALLERY_TAB] },
  { title: 'Conta', items: [CREDITS_TAB, SUBSCRIPTION_TAB, SETTINGS_TAB] },
]

/** O menu do plano em vigor: o que o plano não inclui não aparece. */
export function navGroupsFor(plan: Plan | null): readonly NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.tool === undefined || planIncludes(plan, item.tool)),
  })).filter((group) => group.items.length > 0)
}

/** A barra de baixo do celular: o que se usa todo dia. Créditos fica no topo. */
export const MOBILE_TABS: readonly NavItem[] = [
  HOME_TAB,
  { ...IMAGE_TAB, label: 'Imagem' },
  { ...VIDEO_TAB, label: 'Vídeo' },
  { ...PERSONAS_TAB, label: 'Personas' },
  { ...GALLERY_TAB, label: 'Criações' },
]
