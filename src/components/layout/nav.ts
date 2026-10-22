import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Clapperboard,
  Coins,
  Compass,
  CreditCard,
  FileText,
  FolderKanban,
  House,
  ImageIcon,
  Images,
  KanbanSquare,
  Lightbulb,
  Megaphone,
  PenLine,
  ScrollText,
  Settings,
  Sparkles,
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
  /** Recurso de etapa futura: aparece no menu sem link nem ação. */
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
const isAssistant = (...paths: string[]) => (pathname: string) => paths.some((path) => pathname === `/assistente/${path}`)
const never = () => false

export const HOME_TAB: NavItem = { label: 'Dashboard', to: '/inicio', icon: House, isActive: isPath('/inicio') }
export const IMAGE_TAB: NavItem = { label: 'Imagens', to: '/estudio?modo=imagem', icon: ImageIcon, isActive: isStudioMode('image') }
export const VIDEO_TAB: NavItem = { label: 'Vídeos', to: '/estudio?modo=video', icon: Clapperboard, badge: 'NOVO', isActive: isStudioMode('video') }
export const PERSONAS_TAB: NavItem = { label: 'Personagens', to: '/personas', icon: UserRound, badge: 'TOP', isActive: isPath('/personas') }
export const UGC_TAB: NavItem = { label: 'UGC', to: '/assistente/ugc', icon: Megaphone, tool: 'ugc_studio', isActive: isAssistant('ugc') }
export const IDEAS_TAB: NavItem = { label: 'Ideias', to: '/assistente/ideias', icon: Lightbulb, tool: 'copy', isActive: isAssistant('ideias') }
export const SCRIPT_TAB: NavItem = { label: 'Roteiros', to: '/assistente/roteiro', icon: ScrollText, tool: 'copy', isActive: isAssistant('roteiro') }
export const COPY_TAB: NavItem = { label: 'Copys', to: '/assistente/copy', icon: PenLine, tool: 'copy', isActive: isAssistant('copy') }
export const PLANNING_TAB: NavItem = { label: 'Planejamento', to: '/assistente/planejamento', icon: CalendarDays, badge: 'NOVO', tool: 'copy', isActive: isAssistant('planejamento') }
const isContentView = (view: 'quadro' | 'calendario') => (pathname: string, params: URLSearchParams) =>
  pathname === '/conteudo' && (params.get('visao') === 'calendario' ? 'calendario' : 'quadro') === view

export const CONTENT_TAB: NavItem = { label: 'Conteúdos', to: '/conteudo', icon: KanbanSquare, badge: 'NOVO', isActive: isContentView('quadro') }
export const CALENDAR_TAB: NavItem = { label: 'Calendário', to: '/conteudo?visao=calendario', icon: CalendarDays, isActive: isContentView('calendario') }
export const GALLERY_TAB: NavItem = { label: 'Biblioteca', to: '/galeria', icon: Images, isActive: isPath('/galeria') }
export const BRANDS_TAB: NavItem = { label: 'Marcas', to: '/marcas', icon: Store, isActive: isPath('/marcas') }
export const PROJECTS_TAB: NavItem = { label: 'Projetos', to: '/projetos', icon: FolderKanban, tool: 'projects', isActive: isPath('/projetos') }
export const CREDITS_TAB: NavItem = { label: 'Créditos e consumo', to: '/creditos', icon: Coins, isActive: isPath('/creditos') }
export const SUBSCRIPTION_TAB: NavItem = { label: 'Assinatura', to: '/assinatura', icon: CreditCard, isActive: isPath('/assinatura') }
export const SETTINGS_TAB: NavItem = { label: 'Configurações', to: '/conta/configuracoes', icon: Settings, isActive: isPath('/conta/configuracoes') }

/** Recurso de etapa futura que depende de plano. */
const toolSoon = (tool: PlanTool, icon: LucideIcon): NavItem => ({ label: PLAN_TOOL_INFO[tool].label, to: '', icon, soon: true, tool, isActive: never })
/** Recurso de etapa futura aberto a todos (docs/vynkio-evolucao.md, seção 7). */
const soon = (label: string, icon: LucideIcon): NavItem => ({ label, to: '', icon, soon: true, isActive: never })

// As seis áreas do Vynkio. Só entra com link o que funciona; o resto é "Breve".
const NAV_GROUPS: readonly NavGroup[] = [
  { title: 'Início', items: [HOME_TAB] },
  { title: 'Criar', items: [IMAGE_TAB, VIDEO_TAB, PERSONAS_TAB, UGC_TAB, toolSoon('motion_control', Waves)] },
  { title: 'Inteligência', items: [IDEAS_TAB, SCRIPT_TAB, COPY_TAB, PLANNING_TAB, soon('Assistente de estratégia', Compass)] },
  { title: 'Conteúdo', items: [CONTENT_TAB, CALENDAR_TAB, GALLERY_TAB, toolSoon('prompt_library', BookOpen)] },
  { title: 'Resultados', items: [soon('Analytics', BarChart3), soon('Relatórios', FileText), soon('Recomendações', Sparkles)] },
  { title: 'Gerenciamento', items: [BRANDS_TAB, PROJECTS_TAB, CREDITS_TAB, SUBSCRIPTION_TAB, SETTINGS_TAB] },
]

/** O menu do plano em vigor: o que o plano não inclui não aparece. */
export function navGroupsFor(plan: Plan | null): readonly NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.tool === undefined || planIncludes(plan, item.tool)),
  })).filter((group) => group.items.length > 0)
}

/** A barra de baixo do celular: o que se usa todo dia. O resto fica no botão Menu. */
const isAnyAssistant = (pathname: string) => pathname.startsWith('/assistente/')
export const MOBILE_TABS: readonly NavItem[] = [
  { ...HOME_TAB, label: 'Início' },
  { ...IMAGE_TAB, label: 'Studio', isActive: isPath('/estudio') },
  { ...PERSONAS_TAB, label: 'Personas' },
  { ...IDEAS_TAB, label: 'IA', isActive: isAnyAssistant },
]
