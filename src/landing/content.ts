// Conteúdo da landing. Preços e custos espelham os seeds de `credit_packs` e
// `models` (supabase/migrations/0001_init.sql): se mudar lá, mudar aqui.

export const SIGNUP_PATH = '/entrar'
export const WELCOME_CREDITS = 20

/** Enquanto os vídeos dos celulares forem os ilustrativos de `npm run landing:assets`. */
export const ILLUSTRATIVE_MEDIA = true

export const TIKTOK_URL: string | undefined = import.meta.env.VITE_TIKTOK_URL || undefined

export interface ShowcaseVideo {
  readonly id: string
  readonly src: string
  readonly poster: string
  readonly prompt: string
  readonly model: string
  readonly credits: number
}

export const SHOWCASE: readonly ShowcaseVideo[] = [
  {
    id: 'product',
    src: '/landing/product.webm',
    poster: '/landing/product.jpg',
    prompt: 'Frasco de sérum lilás girando devagar, luz de estúdio, fundo com brilho neon',
    model: 'Kling',
    credits: 40,
  },
  {
    id: 'influencer',
    src: '/landing/influencer.webm',
    poster: '/landing/influencer.jpg',
    prompt: 'Minha persona de costas olhando o pôr do sol, vento no cabelo, luz dourada',
    model: 'Veo 3.1',
    credits: 200,
  },
  {
    id: 'city',
    src: '/landing/city.webm',
    poster: '/landing/city.jpg',
    prompt: 'Cidade à noite com chuva fina, câmera andando de lado, janelas acesas',
    model: 'Kling',
    credits: 40,
  },
]

export type CapabilityId = 'video' | 'image' | 'persona' | 'copy'

export interface Capability {
  readonly id: CapabilityId
  readonly title: string
  readonly description: string
  readonly detail: string
  readonly soon?: boolean
}

export const CAPABILITIES: readonly Capability[] = [
  {
    id: 'video',
    title: 'Vídeo com IA',
    description: 'Pega uma imagem e transforma em vídeo com movimento, som e até fala.',
    detail: '5 ou 8 segundos, no formato do Reels e do TikTok',
  },
  {
    id: 'image',
    title: 'Imagem com IA',
    description: 'Escreve o que você quer ver e recebe uma foto realista em segundos.',
    detail: 'Produto, cenário, post, anúncio',
  },
  {
    id: 'persona',
    title: 'Influenciador com IA',
    description: 'Cria uma pessoa que não existe e usa o mesmo rosto em todo post e vídeo.',
    detail: 'Perfil de IA sem precisar aparecer',
  },
  {
    id: 'copy',
    title: 'Copy com IA',
    description: 'Legenda, roteiro e gancho escritos pro conteúdo que você acabou de gerar.',
    detail: 'Em português, no tom do seu perfil',
    soon: true,
  },
]

export const STEPS = [
  { title: 'Descreva', text: 'Escreve em português o que você quer. Sem termo técnico, sem prompt em inglês.' },
  { title: 'Escolha foto ou vídeo', text: 'O Kria escolhe o modelo de IA certo por trás. Você só vê o resultado.' },
  { title: 'Baixe e poste', text: 'Arquivo pronto no formato vertical, direto pro Reels, TikTok ou anúncio.' },
] as const

export const AUDIENCES = [
  { title: 'Afiliado', text: 'Vídeo do produto sem comprar o produto, sem gravar e sem aparecer.' },
  { title: 'Comércio local', text: 'Post e anúncio com cara de estúdio, gastando centavos em vez de um ensaio.' },
  { title: 'Perfil de IA', text: 'Uma influenciadora que posta todo dia, com o mesmo rosto, sem existir.' },
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
