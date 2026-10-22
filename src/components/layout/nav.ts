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
  Lightbulb,
  PenLine,
  Settings,
  Store,
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
const isAssistant = (...paths: string[]) => (pathname: string) => paths.some((path) => pathname === `/assistente/${path}`)

export const IDEAS_TAB: NavItem = { label: 'Ideias de conteúdo', to: '/assistente/ideias', icon: Lightbulb, tool: 'copy', isActive: isAssistant('ideias') }
export const COPY_TAB: NavItem = { label: 'Copys e roteiros', to: '/assistente/roteiro', icon: PenLine, tool: 'copy', isActive: isAssistant('roteiro', 'copy') }
export const UGC_TAB: NavItem = { label: 'Estúdio UGC', to: '/assistente/ugc', icon: Megaphone, badge: 'NOVO', tool: 'ugc_studio', isActive: isAssistant('ugc') }
export const BRANDS_TAB: NavItem = { label: 'Marcas', to: '/marcas', icon: Store, isActive: isPath('/marcas') }
export const PROJECTS_TAB: NavItem = { label: 'Meus projetos', to: '/projetos', icon: FolderKanban, tool: 'projects', isActive: isPath('/projetos') }
export const SETTINGS_TAB: NavItem = { label: 'Configurações', to: '/conta/configuracoes', icon: Settings, isActive: isPath('/conta/configuracoes') }

/** Ferramenta de fase futura, liberada por plano. Quando existir, ganha rota própria aqui. */
const toolTab = (tool: PlanTool, icon: LucideIcon): NavItem => ({ label: PLAN_TOOL_INFO[tool].label, to: '', icon, soon: true, tool, isActive: never })

// Um grupo por módulo do Vynkio. Content, Analytics e Growth entram quando existirem (docs/vynkio-ecossistema.md).
const NAV_GROUPS: readonly NavGroup[] = [
  { title: 'Vynkio', items: [HOME_TAB] },
  { title: 'Studio', items: [PERSONAS_TAB, IMAGE_TAB, VIDEO_TAB, UGC_TAB, toolTab('motion_control', Waves)] },
  { title: 'Vynkio AI', items: [IDEAS_TAB, COPY_TAB] },
  { title: 'Workspace', items: [BRANDS_TAB, PROJECTS_TAB, GALLERY_TAB, toolTab('prompt_library', BookOpen)] },
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
// Vídeo fica no seletor da caixa de prompt do Studio; o assistente ganha a vaga.
const isAnyAssistant = (pathname: string) => pathname.startsWith('/assistente/')
export const MOBILE_TABS: readonly NavItem[] = [
  HOME_TAB,
  { ...IMAGE_TAB, label: 'Studio', isActive: isPath('/estudio') },
  { ...PERSONAS_TAB, label: 'Personas' },
  { ...IDEAS_TAB, label: 'IA', isActive: isAnyAssistant },
  { ...GALLERY_TAB, label: 'Criações' },
]
