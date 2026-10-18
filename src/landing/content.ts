// Conteúdo da landing. Preços e custos espelham os seeds de `credit_packs` e
// `models` (supabase/migrations/0001_init.sql): se mudar lá, mudar aqui.

export const SIGNUP_PATH = '/entrar'
export const WELCOME_CREDITS = 20

/** Enquanto os vídeos forem os ilustrativos de `npm run landing:assets`. */
export const ILLUSTRATIVE_MEDIA = true

export const TIKTOK_URL: string | undefined = import.meta.env.VITE_TIKTOK_URL || undefined

export type ClipId = 'chrome' | 'aurora' | 'dunes' | 'tunnel' | 'silk' | 'planet'

export interface Clip {
  readonly id: ClipId
  readonly src: string
  readonly poster: string
  readonly prompt: string
  readonly model: string
  readonly credits: number
}

const clip = (id: ClipId, prompt: string, model: string, credits: number): Clip => ({
  id,
  src: `/landing/${id}.webm`,
  poster: `/landing/${id}.jpg`,
  prompt,
  model,
  credits,
})

export const CLIPS: Readonly<Record<ClipId, Clip>> = {
  dunes: clip('dunes', 'Dunas no fim da tarde, câmera deslizando de lado, sol baixo e névoa dourada', 'Veo 3.1', 200),
  chrome: clip('chrome', 'Gotas de metal líquido se fundindo no ar, luz de estúdio verde e roxa', 'Kling', 40),
  aurora: clip('aurora', 'Aurora boreal sobre as montanhas, céu estrelado, movimento lento', 'Kling', 40),
  planet: clip('planet', 'Planeta lilás com anéis girando devagar no espaço, estrelas ao fundo', 'Veo 3.1', 200),
  silk: clip('silk', 'Seda lilás ondulando em câmera lenta, brilho suave, fundo escuro', 'Kling', 40),
  tunnel: clip('tunnel', 'Voo por um túnel de neon verde, velocidade constante, clima de clipe', 'Kling', 40),
}

/** Ordem da grade "Feito no Kria". */
export const GALLERY: readonly ClipId[] = ['dunes', 'chrome', 'aurora', 'planet', 'silk', 'tunnel']

export type ToolIcon = 'video' | 'image' | 'persona' | 'copy'
export type ToolBadge = 'top' | 'novo' | 'breve'

export interface Tool {
  readonly title: string
  readonly description: string
  readonly icon: ToolIcon
  readonly badge?: ToolBadge
}

export const TOOLS: readonly Tool[] = [
  { title: 'Vídeo Veo 3.1', description: '8 segundos com fala e som', icon: 'video', badge: 'top' },
  { title: 'Vídeo Kling', description: 'Anima qualquer imagem em 5s', icon: 'video' },
  { title: 'Influenciador com IA', description: 'O mesmo rosto em todo post', icon: 'persona', badge: 'novo' },
  { title: 'Foto realista', description: 'Do texto à foto em segundos', icon: 'image' },
  { title: 'Foto com persona', description: 'Sua persona em qualquer cenário', icon: 'image' },
  { title: 'Copy com IA', description: 'Legenda, roteiro e gancho', icon: 'copy', badge: 'breve' },
]

export const STEPS = [
  { title: 'Descreva', text: 'Escreve em português o que você quer ver. Sem termo técnico, sem prompt em inglês.' },
  { title: 'Escolha', text: 'Foto ou vídeo. O Kria usa o modelo de IA certo por trás e você só vê o resultado.' },
  { title: 'Poste', text: 'Arquivo vertical pronto pro Reels, TikTok ou anúncio. Baixa e publica.' },
] as const

export const AUDIENCES = [
  { title: 'Afiliado', text: 'Vídeo do produto sem comprar, sem gravar e sem aparecer.' },
  { title: 'Comércio local', text: 'Post e anúncio com cara de estúdio, por centavos.' },
  { title: 'Perfil de IA', text: 'Uma influenciadora que posta todo dia e não existe.' },
] as const

export interface CreditPack {
  readonly id: string
  readonly name: string
  readonly credits: number
  readonly priceCents: number
  readonly highlight: boolean
}

export const CREDIT_PACKS: readonly CreditPack[] = [
  { id: 'inicial', name: 'Inicial', credits: 100, priceCents: 1990, highlight: false },
  { id: 'criador', name: 'Criador', credits: 300, priceCents: 4990, highlight: true },
  { id: 'estudio', name: 'Estúdio', credits: 800, priceCents: 11990, highlight: false },
]

export const COSTS = {
  photo: 5,
  videoShort: 40,
  videoTalking: 200,
} as const

export const FAQ = [
  {
    question: 'Preciso saber usar IA?',
    answer:
      'Não. Você escreve em português o que quer ver e escolhe entre foto e vídeo. Qual modelo usar, tamanho e formato o Kria resolve.',
  },
  {
    question: 'Tem mensalidade?',
    answer: `Não. Você compra créditos quando precisar, por Pix ou cartão, e gasta só no que gerar. Quem cria a conta ganha ${WELCOME_CREDITS} créditos pra testar.`,
  },
  {
    question: 'E se a geração der erro?',
    answer: 'Os créditos voltam pra sua conta automaticamente. Você só paga pelo que ficou pronto.',
  },
  {
    question: 'Posso subir a foto de uma pessoa real?',
    answer:
      'Não. Os influenciadores nascem de imagens geradas dentro do Kria. É assim que a gente evita deepfake de gente de verdade.',
  },
  {
    question: 'Quais IAs estão por trás?',
    answer:
      'Hoje: Veo 3.1 (Google) e Kling pra vídeo, Nano Banana pra imagem. Quando sai um modelo melhor, ele entra no Kria sem você precisar assinar mais nada.',
  },
] as const
