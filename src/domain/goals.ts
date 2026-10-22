import type { PlanTool } from './plans'
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

/** As respostas de "Qual é seu principal objetivo com o Vynkio?". */
export const GOALS: readonly GoalOption[] = [
  { value: 'influencers', label: 'Criar influenciadores de IA', description: 'Uma persona com o mesmo rosto em tudo que você postar.' },
  { value: 'viral_videos', label: 'Criar vídeos virais', description: 'Fotos que viram vídeo com movimento e som.' },
  { value: 'ugc_ads', label: 'Criar anúncios UGC', description: 'Cenas de produto com cara de conteúdo de criador.' },
  { value: 'images', label: 'Produzir imagens', description: 'Fotos realistas a partir de uma descrição.' },
  { value: 'social_content', label: 'Criar conteúdos para redes sociais', description: 'Posts e vídeos verticais para Reels e TikTok.' },
  { value: 'all_tools', label: 'Utilizar várias ferramentas', description: 'Um pouco de tudo, conforme a necessidade.' },
]

/** As oito portas do dashboard ("O que vamos criar hoje?"). */
export const HOME_ACTION_IDS = ['video', 'image', 'persona', 'ugc', 'copy', 'script', 'ideas', 'projects'] as const
export type HomeActionId = (typeof HOME_ACTION_IDS)[number]

export interface HomeAction extends QuickAction {
  readonly id: HomeActionId
  /** Ferramenta de plano que libera a ação; sem ela, a ação aparece com cadeado e leva aos planos. */
  readonly tool?: PlanTool
}

const ACTIONS: Record<HomeActionId, HomeAction> = {
  video: { id: 'video', title: 'Criar vídeo', description: 'Anime uma foto ou personagem com movimento e som.', to: '/estudio?modo=video' },
  image: { id: 'image', title: 'Criar imagem', description: 'Descreva a cena e receba uma foto realista.', to: '/estudio?modo=imagem' },
  persona: { id: 'persona', title: 'Criar personagem', description: 'O mesmo rosto em todas as fotos e vídeos.', to: '/personas' },
  ugc: { id: 'ugc', title: 'Criar UGC', description: 'Vídeo estilo criador apresentando o produto, com cenas para o Studio.', to: '/assistente/ugc', tool: 'ugc_studio' },
  copy: { id: 'copy', title: 'Escrever copy', description: 'Legenda, anúncio, título, gancho ou texto de venda.', to: '/assistente/copy', tool: 'copy' },
  script: { id: 'script', title: 'Criar roteiro', description: 'Gancho, cenas e CTA, prontos para virar vídeo.', to: '/assistente/roteiro', tool: 'copy' },
  ideas: { id: 'ideas', title: 'Gerar ideias', description: 'Pautas pensadas para o público da sua marca.', to: '/assistente/ideias', tool: 'copy' },
  projects: { id: 'projects', title: 'Projetos anteriores', description: 'Retome o que você já criou, organizado por projeto.', to: '/projetos', tool: 'projects' },
}

/** Sem a ferramenta de projetos, a oitava porta leva à biblioteca, que todo plano tem. */
const LIBRARY: HomeAction = { id: 'projects', title: 'Criações anteriores', description: 'Tudo o que você já gerou, pronto para baixar.', to: '/galeria' }

/** O que vem primeiro para cada objetivo do onboarding; o resto segue na ordem padrão. */
const GOAL_PRIORITY: Record<Goal, readonly HomeActionId[]> = {
  influencers: ['persona', 'image', 'video'],
  viral_videos: ['script', 'video', 'ideas'],
  ugc_ads: ['ugc', 'persona', 'copy'],
  images: ['image', 'persona'],
  social_content: ['ideas', 'script', 'copy'],
  all_tools: [],
}

export function homeActions(goal: Goal, hasTool: (tool: PlanTool) => boolean): readonly HomeAction[] {
  const order = [...new Set([...GOAL_PRIORITY[goal], ...HOME_ACTION_IDS])]
  return order.map((id) => (id === 'projects' && !hasTool('projects') ? LIBRARY : ACTIONS[id]))
}
