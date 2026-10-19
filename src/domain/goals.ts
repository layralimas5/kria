import type { Goal } from './types'

export interface QuickAction {
  readonly title: string
  readonly description: string
  readonly to: string
}

export interface GoalOption {
  readonly value: Goal
  readonly label: string
  readonly description: string
}

/** As respostas de "Qual é seu principal objetivo com o Kria IA?". */
export const GOALS: readonly GoalOption[] = [
  { value: 'influencers', label: 'Criar influenciadores de IA', description: 'Uma persona com o mesmo rosto em tudo que você postar.' },
  { value: 'viral_videos', label: 'Criar vídeos virais', description: 'Fotos que viram vídeo com movimento e som.' },
  { value: 'ugc_ads', label: 'Criar anúncios UGC', description: 'Cenas de produto com cara de conteúdo de criador.' },
  { value: 'images', label: 'Produzir imagens', description: 'Fotos realistas a partir de uma descrição.' },
  { value: 'social_content', label: 'Criar conteúdos para redes sociais', description: 'Posts e vídeos verticais para Reels e TikTok.' },
  { value: 'all_tools', label: 'Utilizar várias ferramentas', description: 'Um pouco de tudo, conforme a necessidade.' },
]

const PERSONA: QuickAction = { title: 'Criar personagem', description: 'Monte o rosto e o estilo do seu influenciador.', to: '/personas' }
const PHOTO: QuickAction = { title: 'Gerar imagem', description: 'Descreva a cena e receba uma foto realista.', to: '/estudio?modo=imagem' }
const VIDEO: QuickAction = { title: 'Gerar vídeo', description: 'Anime uma foto ou persona com movimento e áudio.', to: '/estudio?modo=video' }
const MOTION: QuickAction = { title: 'Animar personagem', description: 'Escolha a persona e o movimento.', to: '/personas?aba=movimento' }
const PRODUCT: QuickAction = {
  title: 'Persona com produto',
  description: 'Gere a persona segurando ou usando o seu produto.',
  to: `/estudio?modo=imagem&prompt=${encodeURIComponent(
    'Minha persona segurando [descreva o produto] e mostrando para a câmera, como num vídeo de criadora, luz natural, foto de celular',
  )}`,
}
const GALLERY: QuickAction = { title: 'Minhas criações', description: 'Tudo o que você já gerou, pronto para baixar.', to: '/galeria' }

/** Atalhos do início, na ordem que faz sentido para cada objetivo. Só ferramentas que já funcionam. */
export const QUICK_ACTIONS: Record<Goal, readonly QuickAction[]> = {
  influencers: [PERSONA, MOTION, PHOTO, GALLERY],
  viral_videos: [VIDEO, MOTION, PHOTO, GALLERY],
  ugc_ads: [PRODUCT, PERSONA, VIDEO, GALLERY],
  images: [PHOTO, PERSONA, VIDEO, GALLERY],
  social_content: [PHOTO, VIDEO, PERSONA, GALLERY],
  all_tools: [PHOTO, VIDEO, PERSONA, GALLERY],
}
