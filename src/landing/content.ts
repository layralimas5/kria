// Conteúdo fixo da landing. Preços, créditos e planos não ficam aqui: vêm do
// banco (`subscription_plans`, migration 0003) pela seção de planos.
import avatarSpecs from './avatars.json'
import generatedMedia from './avatars.generated.json'

export const SIGNUP_PATH = '/entrar'
export const WELCOME_CREDITS = 20

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
  { title: 'Vídeo Kling', description: 'Anima qualquer imagem em 5s, com áudio', icon: 'video' },
  { title: 'Influenciador com IA', description: 'O mesmo rosto em todo post', icon: 'persona', badge: 'novo' },
  { title: 'Foto realista', description: 'Do texto à foto em segundos', icon: 'image' },
  { title: 'Foto com persona', description: 'Sua persona em qualquer cenário', icon: 'image' },
  { title: 'Copy e roteiro com IA', description: 'Ideia, legenda e roteiro no tom da sua marca', icon: 'copy', badge: 'novo' },
]

export type ModelKind = 'Imagem' | 'Vídeo' | 'Texto' | 'Edição'

export interface AiModel {
  readonly name: string
  readonly kind: ModelKind
  /** Logo em `public/ai-logos`. Sem logo, a faixa usa o ícone do tipo. */
  readonly logo?: string
}

// Catálogo de IAs liberadas no Vynkio. Antes de publicar, cada uma precisa estar
// ativa na tabela `models` do app; senão a página promete o que o app não gera.
export const AI_MODELS: readonly AiModel[] = [
  { name: 'Nano Banana 2', kind: 'Imagem', logo: 'nanobanana-color' },
  { name: 'Nano Banana 2 Edit', kind: 'Edição', logo: 'nanobanana-color' },
  { name: 'Kling 3.0', kind: 'Vídeo', logo: 'kling-color' },
  { name: 'Veo 3.1', kind: 'Vídeo', logo: 'deepmind-color' },
  { name: 'Claude', kind: 'Texto' },
]

export const STEPS = [
  { title: 'Descreva', text: 'Escreve em português o que você quer ver. Sem termo técnico, sem prompt em inglês.' },
  { title: 'Escolha', text: 'Foto ou vídeo. O Vynkio usa o modelo de IA certo por trás e você só vê o resultado.' },
  { title: 'Poste', text: 'Arquivo vertical pronto pro Reels, TikTok ou anúncio. Baixa e publica.' },
] as const

export type FaqIcon =
  | 'what'
  | 'credits'
  | 'persona'
  | 'video'
  | 'commercial'
  | 'rollover'
  | 'change'
  | 'cancel'
  | 'extra'
  | 'tools'

export interface FaqItem {
  readonly icon: FaqIcon
  readonly question: string
  readonly answer: string
}

// Respostas presas às regras implementadas (migration 0003, functions subscribe,
// cancel-subscription e asaas-webhook). Mudou a regra, muda a resposta.
export const FAQ: readonly FaqItem[] = [
  {
    icon: 'what',
    question: 'O que é o Vynkio?',
    answer:
      'Uma plataforma brasileira que junta ferramentas de IA num lugar só: você cria personagens virtuais e gera imagens e vídeos com eles, escrevendo em português.',
  },
  {
    icon: 'credits',
    question: 'Como funcionam os créditos?',
    answer:
      'Cada criação usa uma quantidade de créditos que depende da ferramenta e do modelo escolhido. O custo aparece antes de você gerar. Se a geração falhar, os créditos voltam sozinhos.',
  },
  {
    icon: 'persona',
    question: 'Posso criar influenciadores virtuais?',
    answer:
      'Sim. Você descreve a pessoa, gera retratos até gostar e salva como personagem, que mantém o mesmo rosto nas próximas criações. Por segurança, personagens nascem só de imagens geradas no Vynkio: não dá para usar foto de gente real.',
  },
  {
    icon: 'video',
    question: 'Posso transformar imagens em vídeos?',
    answer: 'Sim. Qualquer imagem gerada no Vynkio pode virar vídeo com Kling (5 segundos, com áudio) ou, em qualquer plano pago, Veo 3.1 (8 segundos, com fala e som).',
  },
  {
    icon: 'commercial',
    question: 'Posso utilizar minhas criações comercialmente?',
    answer:
      'Sim, em perfis, anúncios e projetos, respeitando os termos de uso do Vynkio e dos provedores dos modelos de IA. Você responde pelo uso e deve marcar o conteúdo como gerado por IA quando a rede social pedir.',
  },
  {
    icon: 'rollover',
    question: 'Os créditos acumulam para o mês seguinte?',
    answer:
      'Os créditos do plano renovam todo mês: a cada cobrança paga você recebe os créditos do plano de novo, e o que sobrou do mês anterior não passa para o seguinte. Os créditos de pacote avulso e os de boas-vindas nunca vencem.',
  },
  {
    icon: 'change',
    question: 'Posso mudar de plano?',
    answer:
      'Pode, na página Assinatura da sua conta. A troca vale quando o pagamento do novo plano é confirmado: o anterior é encerrado e os créditos do plano passam a ser os do novo.',
  },
  {
    icon: 'cancel',
    question: 'Como funciona o cancelamento?',
    answer:
      'Você cancela quando quiser na página Assinatura, sem multa. Não há nova cobrança e o plano continua até o fim do período já pago, com os créditos dele. Os créditos de pacote avulso ficam com você.',
  },
  {
    icon: 'extra',
    question: 'Posso comprar créditos adicionais?',
    answer: 'Sim. Além do plano, dá para comprar pacotes avulsos de créditos por Pix ou cartão, na página Créditos.',
  },
  {
    icon: 'tools',
    question: 'Quais ferramentas de IA estão disponíveis?',
    answer:
      'Para imagem: Nano Banana 2, para foto a partir do texto e foto com o seu personagem. Para vídeo: Kling 3.0 e Veo 3.1, com áudio. Para texto: Claude, que escreve ideias, legendas, copys e roteiros no tom da sua marca. Biblioteca de prompts e Motion Control aparecem como "Em breve" nos planos que vão ter acesso, até estarem prontos.',
  },
]
