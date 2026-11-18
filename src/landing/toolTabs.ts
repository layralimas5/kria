// Abas da seção "Como funciona". Cada aba é uma ferramenta que funciona hoje no app, e cada benefício
// é algo que a tela mostra. A observação de plano segue a 0034: o grátis cria imagem e texto, sem vídeo,
// e salva 1 personagem. Mudou o produto ou o plano, muda aqui.
import { Clapperboard, ImageIcon, PenLine, UserRound, type LucideIcon } from 'lucide-react'
import type { Creation } from './components/CreationTile'
import type { Screen } from './content'
import { TAB_CREATIONS } from './creations'

export type ToolTabId = 'imagens' | 'videos' | 'personagens' | 'conteudo'

/** Resultados da ferramenta (fotos ou vídeos da vitrine). */
export interface ToolCreations {
  readonly kind: 'creations'
  readonly items: readonly Creation[]
}

/** Resultado de texto do Vynkio AI, recortado do modo demonstração. */
export interface ToolScreen {
  readonly kind: 'screen'
  readonly screen: Screen
  readonly label: string
  readonly alt: string
  readonly width: number
  readonly height: number
}

export interface ToolTab {
  readonly id: ToolTabId
  readonly label: string
  readonly icon: LucideIcon
  readonly name: string
  readonly headline: string
  readonly description: string
  readonly benefits: readonly string[]
  readonly availability: string
  readonly visual: ToolCreations | ToolScreen
}

export const TOOL_TABS: readonly ToolTab[] = [
  {
    id: 'imagens',
    label: 'Imagens IA',
    icon: ImageIcon,
    name: 'Studio de imagem',
    headline: 'Transforme palavras em imagens incríveis.',
    description: 'Crie imagens com inteligência artificial, explore estilos e dê vida às suas ideias em poucos passos.',
    benefits: ['Nano Banana 2, FLUX.2 Pro e Ideogram 3.0', 'Descreva em português, sem prompt em inglês', 'O custo em créditos aparece antes de gerar'],
    availability: 'Disponível no plano grátis.',
    visual: { kind: 'creations', items: TAB_CREATIONS.imagens },
  },
  {
    id: 'videos',
    label: 'Vídeos IA',
    icon: Clapperboard,
    name: 'Studio de vídeo',
    headline: 'Suas ideias merecem ganhar movimento.',
    description: 'Transforme conceitos em vídeos criativos com o poder da inteligência artificial.',
    benefits: ['Kling 3.0, Seedance 2.0, Hailuo 2.3 e Wan 2.6', 'Parte de uma imagem sua ou de um personagem', 'Seedance com fala, efeitos e som ambiente'],
    availability: 'Vídeo por IA não entra no plano grátis. Veja em Planos quais incluem.',
    visual: { kind: 'creations', items: TAB_CREATIONS.videos },
  },
  {
    id: 'personagens',
    label: 'Personagens IA',
    icon: UserRound,
    name: 'Personagens',
    headline: 'Crie personagens com identidade própria.',
    description: 'Desenvolva personagens digitais e explore novas possibilidades para seus conteúdos.',
    benefits: ['O mesmo rosto em todas as fotos e vídeos', 'Cabelo, rosto, corpo e roupa escolhidos sem prompt', 'Movimentos prontos: acenar, falar para a câmera, mostrar um produto'],
    availability: 'No plano grátis, 1 personagem salvo. O movimento usa vídeo por IA.',
    visual: { kind: 'creations', items: TAB_CREATIONS.personagens },
  },
  {
    id: 'conteudo',
    label: 'Criação de conteúdo',
    icon: PenLine,
    name: 'Vynkio AI',
    headline: 'Menos tempo criando. Mais tempo evoluindo.',
    description: 'Explore ferramentas que ajudam a transformar ideias em conteúdos para suas redes sociais.',
    benefits: ['Ideias de pauta para o público da sua marca', 'Roteiro com gancho, cenas cronometradas e CTA', 'Cada cena vira imagem no Studio com um clique'],
    availability: 'Disponível no plano grátis.',
    visual: { kind: 'screen', screen: 'roteiro', label: 'Vynkio AI · Roteiro', alt: 'Roteiro gerado pelo Vynkio AI com cenas cronometradas, fala e descrição de cada cena', width: 1302, height: 840 },
  },
]
