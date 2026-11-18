// Abas da seção "Como funciona". Cada aba é uma ferramenta que funciona hoje no app, e cada benefício
// é algo que a tela mostra. A observação de plano segue a 0034: o grátis cria imagem e texto, sem vídeo,
// e salva 1 personagem. Mudou o produto ou o plano, muda aqui.
import { Clapperboard, ImageIcon, PenLine, UserRound, type LucideIcon } from 'lucide-react'
import type { Screen } from './content'

export type ToolTabId = 'imagens' | 'videos' | 'personagens' | 'conteudo'

export interface ToolScreen {
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
  readonly visual: ToolScreen
}

const MAIN_SCREEN = { width: 1764, height: 1230 } as const

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
    visual: { screen: 'estudio-imagem', label: 'Studio · Imagem', alt: 'Studio de imagem do Vynkio com os modelos, o custo em créditos e as criações recentes', ...MAIN_SCREEN },
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
    visual: { screen: 'estudio-video', label: 'Studio · Vídeo', alt: 'Studio de vídeo do Vynkio com Kling 3.0 e Seedance 2.0, o custo de cada um e as criações recentes', ...MAIN_SCREEN },
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
    visual: { screen: 'personagem-movimento', label: 'Personagens', alt: 'Tela de personagens do Vynkio no modo Movimento, com as personas Luna e Rafa e os movimentos prontos', ...MAIN_SCREEN },
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
    visual: { screen: 'roteiro', label: 'Vynkio AI · Roteiro', alt: 'Roteiro gerado pelo Vynkio AI com cenas cronometradas, fala e descrição de cada cena', width: 1302, height: 840 },
  },
]
