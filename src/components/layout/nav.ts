import {
  BarChart3,
  CalendarDays,
  Clapperboard,
  Coins,
  CopyPlus,
  CreditCard,
  FolderKanban,
  House,
  ImageIcon,
  Images,
  KanbanSquare,
  LifeBuoy,
  LayoutTemplate,
  Lightbulb,
  Megaphone,
  PenLine,
  ScrollText,
  Settings,
  Store,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { planIncludes, type PlanTool } from '@/domain/plans'
import type { MediaKind, Plan } from '@/domain/types'

export interface NavItem {
  readonly label: string
  readonly to: string
  readonly icon: LucideIcon
  readonly badge?: 'NOVO' | 'TOP'
  /** Recurso de etapa futura: aparece no menu sem link nem ação. */
  readonly soon?: true
  /** Só aparece para o plano que inclui essa ferramenta. Sem `tool`, é de todos. */
  readonly tool?: PlanTool
  /** Só aparece se o plano libera algum modelo desse tipo no Estúdio. */
  readonly mediaKind?: MediaKind
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

export const HOME_TAB: NavItem = { label: 'Dashboard', to: '/inicio', icon: House, isActive: isPath('/inicio') }
export const FORMATS_TAB: NavItem = {
  label: 'Formatos',
  to: '/formatos',
  icon: LayoutTemplate,
  badge: 'NOVO',
  isActive: (pathname) => pathname === '/formatos' || pathname.startsWith('/formatos/'),
}
export const MULTIPLIER_TAB: NavItem = {
  label: 'Multiplicador',
  to: '/multiplicador',
  icon: CopyPlus,
  badge: 'NOVO',
  isActive: (pathname) => pathname === '/multiplicador' || pathname.startsWith('/multiplicador/'),
}
export const IMAGE_TAB: NavItem = { label: 'Imagens', to: '/estudio?modo=imagem', icon: ImageIcon, isActive: isStudioMode('image') }
export const VIDEO_TAB: NavItem = { label: 'Vídeos', to: '/estudio?modo=video', icon: Clapperboard, badge: 'NOVO', mediaKind: 'video', isActive: isStudioMode('video') }
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
export const RESULTS_TAB: NavItem = { label: 'Analytics', to: '/resultados', icon: BarChart3, badge: 'NOVO', isActive: isPath('/resultados') }
export const GALLERY_TAB: NavItem = { label: 'Biblioteca', to: '/galeria', icon: Images, isActive: isPath('/galeria') }
export const BRANDS_TAB: NavItem = { label: 'Marcas', to: '/marcas', icon: Store, isActive: isPath('/marcas') }
export const PROJECTS_TAB: NavItem = { label: 'Projetos', to: '/projetos', icon: FolderKanban, tool: 'projects', isActive: isPath('/projetos') }
export const CREDITS_TAB: NavItem = { label: 'Créditos e consumo', to: '/creditos', icon: Coins, isActive: isPath('/creditos') }
export const SUBSCRIPTION_TAB: NavItem = { label: 'Assinatura', to: '/assinatura', icon: CreditCard, isActive: isPath('/assinatura') }
export const SUPPORT_TAB: NavItem = { label: 'Suporte', to: '/suporte', icon: LifeBuoy, isActive: isPath('/suporte') }
export const SETTINGS_TAB: NavItem = { label: 'Configurações', to: '/conta/configuracoes', icon: Settings, isActive: isPath('/conta/configuracoes') }


// As seis áreas do Vynkio. Só entra o que funciona hoje.
const NAV_GROUPS: readonly NavGroup[] = [
  { title: 'Início', items: [HOME_TAB] },
  { title: 'Criar', items: [MULTIPLIER_TAB, FORMATS_TAB, IMAGE_TAB, VIDEO_TAB, PERSONAS_TAB, UGC_TAB] },
  { title: 'Inteligência', items: [IDEAS_TAB, SCRIPT_TAB, COPY_TAB, PLANNING_TAB] },
  { title: 'Conteúdo', items: [CONTENT_TAB, CALENDAR_TAB, GALLERY_TAB] },
  { title: 'Resultados', items: [RESULTS_TAB] },
  { title: 'Gerenciamento', items: [BRANDS_TAB, PROJECTS_TAB, CREDITS_TAB, SUBSCRIPTION_TAB, SUPPORT_TAB, SETTINGS_TAB] },
]

/** O menu do plano em vigor: ferramenta ou tipo de criação que o plano não inclui não aparece. */
export function navGroupsFor(plan: Pick<Plan, 'tools'> | null, kinds: readonly MediaKind[] | null): readonly NavGroup[] {
  const allowed = (item: NavItem) =>
    (item.tool === undefined || planIncludes(plan, item.tool)) && (item.mediaKind === undefined || (kinds ?? []).includes(item.mediaKind))
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(allowed),
  })).filter((group) => group.items.length > 0)
}

/** Itens que existem no app mas ficam fora do menu desse plano (para o "Ver como" do admin). */
export function hiddenNavItems(plan: Pick<Plan, 'tools'> | null, kinds: readonly MediaKind[] | null): readonly NavItem[] {
  const visible = new Set(navGroupsFor(plan, kinds).flatMap((group) => group.items.map((item) => item.to)))
  return NAV_GROUPS.flatMap((group) => group.items).filter((item) => !item.soon && !visible.has(item.to))
}

/** A barra de baixo do celular: o que se usa todo dia. O resto fica no botão Menu. */
const isAnyAssistant = (pathname: string) => pathname.startsWith('/assistente/')
export const MOBILE_TABS: readonly NavItem[] = [
  { ...HOME_TAB, label: 'Dashboard' },
  { ...IMAGE_TAB, label: 'Studio', isActive: isPath('/estudio') },
  { ...PERSONAS_TAB, label: 'Personas' },
  { ...IDEAS_TAB, label: 'IA', isActive: isAnyAssistant },
]
