// Conteúdo da landing. Preços e custos espelham os seeds de `credit_packs` e
// `models` (supabase/migrations/0001_init.sql): se mudar lá, mudar aqui.
import avatarSpecs from './avatars.json'
import generatedMedia from './avatars.generated.json'

export const SIGNUP_PATH = '/entrar'
export const WELCOME_CREDITS = 20

export const COSTS = {
  photo: 5,
  videoShort: 40,
  videoTalking: 200,
} as const

export const TIKTOK_URL: string | undefined = import.meta.env.VITE_TIKTOK_URL || undefined

const PLACEHOLDERS = ['chrome', 'aurora', 'dunes', 'tunnel', 'silk', 'planet'] as const
type Placeholder = (typeof PLACEHOLDERS)[number]

interface AvatarSpec {
  readonly id: string
  readonly title: string
  readonly image: string
  readonly motion: string
  readonly placeholder: string
}

interface GeneratedMedia {
  readonly video: string
  readonly poster: string
}

export interface Clip {
  readonly id: string
  readonly title: string
  readonly src: string
  readonly poster: string
  readonly prompt: string
  readonly model: string
  readonly credits: number
  /** false enquanto o vídeo real não foi gerado (`npm run landing:avatars`). */
  readonly generated: boolean
}

function isPlaceholder(value: string): value is Placeholder {
  return (PLACEHOLDERS as readonly string[]).includes(value)
}

export function toClip(spec: AvatarSpec, media: GeneratedMedia | undefined): Clip {
  if (!isPlaceholder(spec.placeholder)) throw new Error(`Avatar ${spec.id}: placeholder "${spec.placeholder}" não existe`)
  return {
    id: spec.id,
    title: spec.title,
    src: media?.video ?? `/landing/${spec.placeholder}.webm`,
    poster: media?.poster ?? `/landing/${spec.placeholder}.jpg`,
    prompt: spec.image,
    model: 'Nano Banana + Kling',
    credits: COSTS.photo + COSTS.videoShort,
    generated: media !== undefined,
  }
}

const GENERATED: Readonly<Record<string, GeneratedMedia | undefined>> = generatedMedia

/** Avatares da landing, na ordem de `avatars.json`. */
export const AVATARS: readonly Clip[] = avatarSpecs.map((spec) => toClip(spec, GENERATED[spec.id]))

export function avatar(id: string): Clip {
  const found = AVATARS.find((clip) => clip.id === id)
  if (!found) throw new Error(`Avatar "${id}" não está em avatars.json`)
  return found
}

/** Mostra o aviso de "vídeos ilustrativos" enquanto algum avatar estiver no provisório. */
export const ILLUSTRATIVE_MEDIA = AVATARS.some((clip) => !clip.generated)

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

export type FaqIcon = 'skill' | 'billing' | 'time' | 'refund' | 'safety' | 'device' | 'models'

export interface FaqItem {
  readonly icon: FaqIcon
  readonly question: string
  readonly answer: string
}

export const FAQ: readonly FaqItem[] = [
  {
    icon: 'skill',
    question: 'Preciso saber usar IA?',
    answer:
      'Não. Você escreve em português o que quer ver e escolhe entre foto e vídeo. Qual modelo usar, tamanho e formato o Kria resolve.',
  },
  {
    icon: 'billing',
    question: 'Tem mensalidade?',
    answer: `Não. Você compra créditos quando precisar, por Pix ou cartão, e gasta só no que gerar. Quem cria a conta ganha ${WELCOME_CREDITS} créditos pra testar.`,
  },
  {
    icon: 'time',
    question: 'Quanto tempo demora pra ficar pronto?',
    answer: 'Foto sai em segundos. Vídeo leva alguns minutos e aparece sozinho na sua galeria quando termina, pode fechar a aba.',
  },
  {
    icon: 'refund',
    question: 'E se a geração der erro?',
    answer: 'Os créditos voltam pra sua conta automaticamente. Você só paga pelo que ficou pronto.',
  },
  {
    icon: 'safety',
    question: 'Posso subir a foto de uma pessoa real?',
    answer:
      'Não. Os influenciadores nascem de imagens geradas dentro do Kria. É assim que a gente evita deepfake de gente de verdade.',
  },
  {
    icon: 'device',
    question: 'Funciona no celular?',
    answer: 'Sim. O Kria roda no navegador, no celular ou no computador, sem instalar nada. O vídeo já sai no formato vertical.',
  },
  {
    icon: 'models',
    question: 'Quais IAs estão por trás?',
    answer:
      'Hoje: Veo 3.1 (Google) e Kling pra vídeo, Nano Banana pra imagem. Quando sai um modelo melhor, ele entra no Kria sem você precisar assinar mais nada.',
  },
]
