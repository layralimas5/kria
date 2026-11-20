// Conteúdo fixo da landing. Planos, preços e custos por geração ficam em `pricing/`
// e são conferidos contra as migrations nos testes de lá.
import avatarSpecs from './avatars.json'
import generatedMedia from './avatars.generated.json'
import { PRICING_V2 } from './pricing/flags'
import { WELCOME_CREDITS_V3 } from './pricing/storefront'

export const SIGNUP_PATH = '/criar-conta'
export const LOGIN_PATH = '/entrar'
/** Boas-vindas da conta nova: 20 na escala atual; com a vitrine nova, o da proposta v3 (conferido contra a 0019). */
export const WELCOME_CREDITS = PRICING_V2 ? WELCOME_CREDITS_V3 : 20

/** Seção "Seus dados" dos termos, linkada como Privacidade no rodapé. */
export const PRIVACY_ANCHOR = 'seus-dados'

/** Seção "Planos, créditos e pagamento" dos termos: cancelamento e reembolso, linkada no rodapé. */
export const BILLING_ANCHOR = 'pagamento'

/** O modelo de LP pede a mesma ação, com o mesmo texto, em todos os botões da página. */
export const CTA_LABEL = 'Começar grátis'

/** Linha de segurança que acompanha os botões de decisão (planos e chamada final). */
export const SAFETY_LINE = `${WELCOME_CREDITS} créditos grátis, sem cartão · Cancele quando quiser, sem multa · Falhou, o crédito volta`

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

/**
 * A galeria "Feito no Vynkio" só entra na página quando todos os vídeos forem
 * gerados de verdade: shader abstrato não demonstra o produto.
 */
export const REAL_GALLERY = AVATARS.every((clip) => clip.generated)

/** Prints do app em modo demo (`npm run landing:screens`), em `public/landing/app`. */
export type Screen =
  | 'dashboard'
  | 'dashboard-mobile'
  | 'imagem'
  | 'video'
  | 'personagem'
  | 'personagem-movimento'
  | 'estudio-imagem'
  | 'estudio-video'
  | 'ideias'
  | 'roteiro'
  | 'copy'
  | 'ugc'

export function screenSrc(screen: Screen): string {
  return `/landing/app/${screen}.jpg`
}

/**
 * Vídeo "Veja o Vynkio em ação". Enquanto for null, a seção mostra a tela real com o aviso de que o vídeo
 * está em produção. Arquivo próprio: `public/landing/tour.mp4` (e `.webm`, se tiver) com pôster tirado do
 * próprio vídeo. Hospedado fora (YouTube, Vimeo): `kind: 'embed'` com a URL de incorporação.
 */
export type TourVideo =
  | { readonly kind: 'file'; readonly mp4: string; readonly webm?: string; readonly poster: string; readonly duration: string }
  | { readonly kind: 'embed'; readonly url: string; readonly poster: string; readonly duration: string }

export const TOUR_VIDEO: TourVideo | null = null

/**
 * Vídeo de "Conheça o poder da Vynkio" (`#como-funciona`). Enquanto for null, a seção mostra o quadro vazio
 * no tamanho do vídeo. Arquivo em `public/landing/`, com pôster tirado do próprio vídeo.
 */
export interface PlatformVideo {
  readonly src: string
  readonly poster: string
  /** Descreve o vídeo para quem não vê. */
  readonly label: string
}

export const PLATFORM_VIDEO: PlatformVideo | null = null

export type ModelKind = 'Imagem' | 'Vídeo' | 'Texto' | 'Edição' | 'Voz'

export interface AiModel {
  readonly name: string
  readonly kind: ModelKind
  /** Logo em `public/ai-logos`. Sem logo, a faixa usa o ícone do tipo. */
  readonly logo?: string
}

// Catálogo de IAs liberadas no Vynkio. Só entra o que está ativo na tabela `models` do app:
// a página nunca promete o que o app não gera (nada de "em breve").
export const AI_MODELS: readonly AiModel[] = [
  { name: 'Nano Banana 2', kind: 'Imagem', logo: 'nanobanana-color' },
  { name: 'Nano Banana 2 Edit', kind: 'Edição', logo: 'nanobanana-color' },
  { name: 'FLUX.2 Pro', kind: 'Imagem', logo: 'flux' },
  { name: 'Ideogram 3.0', kind: 'Imagem', logo: 'ideogram' },
  { name: 'Kling 3.0', kind: 'Vídeo', logo: 'kling-color' },
  { name: 'Seedance 2.0', kind: 'Vídeo', logo: 'bytedance-color' },
  { name: 'Hailuo 2.3', kind: 'Vídeo', logo: 'hailuo-color' },
  { name: 'Wan 2.6', kind: 'Vídeo', logo: 'alibaba-color' },
  { name: 'Claude', kind: 'Texto', logo: 'claude-color' },
]

export const FAQ_TOPICS = ['Plataforma', 'Créditos', 'Assinatura e pagamento'] as const
export type FaqTopic = (typeof FAQ_TOPICS)[number]

export interface FaqItem {
  readonly topic: FaqTopic
  readonly question: string
  readonly answer: string
}

/** E-mail de suporte publicado nos termos; o rodapé usa o mesmo. */
export const SUPPORT_EMAIL = 'vynkio.suporte@gmail.com'

// Cada resposta segue uma regra implementada: estorno em `fail_generation` (0004), créditos e renovação
// em `wallet_move` e `activate_subscription_period`, cobrança pelo Asaas (`_shared/asaas.ts`: assinatura e
// avulso por Pix ou cartão) e os termos (/termos). Mudou a regra, muda a resposta.
export const FAQ: readonly FaqItem[] = [
  {
    topic: 'Plataforma',
    question: 'O que é a Vynkio?',
    answer:
      'Uma plataforma que reúne ferramentas de inteligência artificial para criar imagens, vídeos, personagens, roteiros, legendas e outros conteúdos digitais em um só lugar, com uma conta e um saldo de créditos.',
  },
  {
    topic: 'Plataforma',
    question: 'Preciso ter experiência com inteligência artificial para utilizar a Vynkio?',
    answer:
      'Não. Você descreve o que quer em português, do jeito que falaria com alguém, e escolhe a ferramenta e o modelo numa lista. O custo em créditos aparece antes de gerar, então dá para explorar no seu ritmo.',
  },
  {
    topic: 'Plataforma',
    question: 'Posso utilizar minhas criações comercialmente?',
    answer:
      'Pode. Os termos de uso permitem usar o que você gerou nos seus perfis, anúncios e projetos, inclusive com fins comerciais, respeitando os termos e as regras dos modelos de IA usados. Ao publicar, identifique que é conteúdo gerado por IA quando a rede social pedir, e não use o conteúdo para enganar pessoas, como um depoimento de cliente que não existe.',
  },
  {
    topic: 'Plataforma',
    question: 'Minhas criações e meus dados ficam seguros?',
    answer:
      'Suas criações ficam num armazenamento privado que só a sua conta acessa, e os vídeos do Multiplicador nem saem do seu computador. O pagamento é feito na página do Asaas, então a Vynkio não recebe os dados do seu cartão. Em Configurações você exporta seus dados ou exclui a conta.',
  },
  {
    topic: 'Créditos',
    question: 'Como funcionam os créditos de IA?',
    answer:
      'Os créditos são usados para gerar com inteligência artificial. Cada ferramenta ou modelo consome uma quantidade diferente, conforme o tipo de geração, e o valor é reservado quando a geração começa.',
  },
  {
    topic: 'Créditos',
    question: 'Todos os modelos de IA consomem a mesma quantidade de créditos?',
    answer:
      'Não. O consumo varia conforme a ferramenta, o modelo escolhido e as configurações: uma foto custa menos que um vídeo, e resolução maior ou vídeo mais longo custam mais. O custo aparece no botão antes de você confirmar a criação.',
  },
  {
    topic: 'Créditos',
    question: 'O que acontece se uma geração falhar?',
    answer:
      'Se a geração falhar, por erro do modelo, instabilidade do provedor ou bloqueio do filtro de segurança, os créditos reservados para ela voltam sozinhos para o seu saldo. A exceção, prevista nos termos, é o uso irregular da plataforma, que pode levar à suspensão da conta sem reembolso dos créditos usados.',
  },
  {
    topic: 'Créditos',
    question: 'Os créditos acumulam para o mês seguinte?',
    answer:
      'Os créditos do plano não acumulam: valem para o período pago e, a cada renovação, são substituídos pelos créditos do novo período. A geração usa primeiro os créditos do plano. Os créditos de boas-vindas e os de pacotes avulsos não vencem.',
  },
  {
    topic: 'Créditos',
    question: 'O que acontece se meus créditos acabarem?',
    answer:
      'As ferramentas de IA param até os créditos do plano renovarem ou até você comprar um pacote avulso. Nada é cobrado sozinho. Para proteger a conta de gasto fora do normal, cada plano também tem um limite de consumo por dia e por mês.',
  },
  {
    topic: 'Créditos',
    question: 'Qual a diferença entre geração e edição de vídeos?',
    answer:
      'Geração é quando um modelo de IA cria o vídeo, como Kling ou Seedance: usa créditos. Edição é o Multiplicador montando os seus próprios vídeos, com cortes, textos e trilha: roda no seu navegador, não usa créditos e conta nas exportações do mês do seu plano. Só os roteiros do Multiplicador, escritos pela IA, usam créditos.',
  },
  {
    topic: 'Assinatura e pagamento',
    question: 'Quais formas de pagamento são aceitas?',
    answer:
      'Pix e cartão de crédito, pelo Asaas, tanto nos planos quanto nos pacotes avulsos. Nos planos Starter, Pro e Max, o cartão é cobrado sozinho todo mês; no Pix, chega uma cobrança nova a cada mês para você pagar. O plano e os créditos são liberados quando o Asaas confirma o pagamento.',
  },
  {
    topic: 'Assinatura e pagamento',
    question: 'Posso cancelar minha assinatura?',
    answer:
      'Pode, quando quiser, na página Assinatura, sem multa. Depois do cancelamento não há nova cobrança e o plano continua até o fim do período já pago; depois disso a conta volta ao plano grátis, com os créditos de pacote que sobraram. Reembolsos seguem o Código de Defesa do Consumidor, incluindo o direito de arrependimento em até 7 dias da contratação.',
  },
  {
    topic: 'Assinatura e pagamento',
    question: 'Posso trocar de plano?',
    answer:
      'Pode, a qualquer momento, na página Assinatura, tanto para um plano maior quanto para um menor. A troca vale quando o pagamento do novo plano é confirmado: o plano anterior encerra nesse momento e os créditos do plano passam a ser os do novo. Os créditos de pacote avulso continuam com você.',
  },
  {
    topic: 'Assinatura e pagamento',
    question: 'Posso comprar créditos extras?',
    answer: 'Pode, com ou sem plano. Na página Créditos há pacotes avulsos no Pix ou no cartão, que entram assim que o pagamento confirma e não vencem.',
  },
]
