import { Clapperboard, Coins, ImageIcon, Images, UserRound, type LucideIcon } from 'lucide-react'

export interface NavItem {
  readonly label: string
  readonly to: string
  readonly icon: LucideIcon
  readonly badge?: 'NOVO' | 'TOP'
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

export const IMAGE_TAB: NavItem = { label: 'Imagem', to: '/estudio?modo=imagem', icon: ImageIcon, isActive: isStudioMode('image') }
export const VIDEO_TAB: NavItem = { label: 'Vídeo', to: '/estudio?modo=video', icon: Clapperboard, badge: 'NOVO', isActive: isStudioMode('video') }
export const PERSONAS_TAB: NavItem = { label: 'Personas', to: '/personas', icon: UserRound, badge: 'TOP', isActive: isPath('/personas') }
export const GALLERY_TAB: NavItem = { label: 'Galeria', to: '/galeria', icon: Images, isActive: isPath('/galeria') }
export const CREDITS_TAB: NavItem = { label: 'Créditos', to: '/creditos', icon: Coins, isActive: isPath('/creditos') }

export const NAV_GROUPS: readonly NavGroup[] = [
  { title: 'Criar', items: [IMAGE_TAB, VIDEO_TAB, PERSONAS_TAB] },
  { title: 'Biblioteca', items: [GALLERY_TAB] },
  { title: 'Conta', items: [CREDITS_TAB] },
]

/** A barra de baixo do celular: o que se usa todo dia. Créditos fica no topo. */
export const MOBILE_TABS: readonly NavItem[] = [IMAGE_TAB, VIDEO_TAB, PERSONAS_TAB, GALLERY_TAB]
