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

/** O modelo de LP pede a mesma ação, com o mesmo texto, em todos os botões da página. */
export const CTA_LABEL = 'Começar a criar'

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
export type Screen = 'dashboard' | 'dashboard-mobile' | 'imagem' | 'video' | 'personagem' | 'ideias' | 'roteiro' | 'copy' | 'ugc'

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

export type FeatureIcon = 'image' | 'video' | 'persona' | 'ugc' | 'copy' | 'ideas'

export interface Feature {
  readonly id: string
  readonly icon: FeatureIcon
  readonly name: string
  readonly benefit: string
  /** Duas linhas: o problema que a ferramenta resolve e como. */
  readonly description: string
  readonly screen: Screen
  readonly screenAlt: string
  /** Restrição de plano, quando existe. */
  readonly plans?: string
}

// Ordem do modelo de LP: do que mais resolve a dor de quem cria para o complementar.
// Os três primeiros ganham bloco grande com print; os outros, card compacto.
export const FEATURES: readonly Feature[] = [
  {
    id: 'personagens',
    icon: 'persona',
    name: 'Personagens consistentes',
    benefit: 'O mesmo rosto em todo post',
    description:
      'Em gerador comum, cada imagem sai com uma pessoa diferente. Aqui você monta o personagem por cabelo, rosto, corpo e roupa, salva e ele aparece igual nas próximas fotos e vídeos.',
    screen: 'personagem',
    screenAlt: 'Construtor de personagem do Vynkio com opções de corte de cabelo e dois personagens salvos',
  },
  {
    id: 'imagens',
    icon: 'image',
    name: 'Imagens com IA',
    benefit: 'Da frase à foto realista, em português',
    description:
      'Sem prompt em inglês nem configuração técnica: descreva a cena como falaria com alguém e receba a foto pronta para o feed. O custo em créditos aparece no botão antes de gerar.',
    screen: 'imagem',
    screenAlt: 'Caixa de descrição da foto no Studio do Vynkio, com o modelo Nano Banana 2 e o botão Gerar mostrando 5 créditos',
  },
  {
    id: 'videos',
    icon: 'video',
    name: 'Vídeos com IA',
    benefit: 'Sua imagem ganha movimento e som',
    description:
      'Nada de baixar a foto e subir em outro site. Escolha a criação ou o personagem e diga o que acontece: Kling 3.0 faz 5 segundos com áudio, Veo 3.1 faz 8 segundos com fala.',
    screen: 'video',
    screenAlt: 'Tela de vídeo do Studio do Vynkio com a escolha entre Kling 3.0 e Veo 3.1 e as criações recentes',
  },
  {
    id: 'roteiros',
    icon: 'copy',
    name: 'Copys e roteiros',
    benefit: 'Texto no tom da sua marca',
    description: 'Legendas, anúncios e roteiros com gancho, cenas e CTA, sem explicar o tom de novo a cada pedido: a marca fica salva.',
    screen: 'roteiro',
    screenAlt: 'Roteiro de vídeo gerado no Vynkio, com cenas cronometradas, fala e descrição visual',
  },
  {
    id: 'ugc',
    icon: 'ugc',
    name: 'Conteúdos UGC',
    benefit: 'Vídeo com cara de cliente real',
    description: 'O roteiro UGC sai dividido em cenas, com fala e descrição visual. Cada cena vai para o Studio com um clique.',
    screen: 'ugc',
    screenAlt: 'Roteiro UGC gerado no Vynkio, dividido em cenas com fala, descrição da cena e o botão Criar a cena no Studio',
    plans: 'Planos Pro e Studio',
  },
  {
    id: 'ideias',
    icon: 'ideas',
    name: 'Ideias para redes sociais',
    benefit: 'Pauta pronta quando a ideia some',
    description: 'Peça ideias para o seu público e receba formato e gancho de cada uma. A escolhida segue para o roteiro com um clique.',
    screen: 'ideias',
    screenAlt: 'Lista de ideias de conteúdo gerada no Vynkio, cada uma com formato e gancho',
  },
]

export type ModelKind = 'Imagem' | 'Vídeo' | 'Texto' | 'Edição' | 'Voz'

export interface AiModel {
  readonly name: string
  readonly kind: ModelKind
  /** Logo em `public/ai-logos`. Sem logo, a faixa usa o ícone do tipo. */
  readonly logo?: string
  /** Ainda não integrado: aparece com o selo "Breve" (regra do projeto, nada de prometer o que não existe). */
  readonly soon?: true
}

// Catálogo de IAs liberadas no Vynkio. Antes de publicar, cada uma precisa estar
// ativa na tabela `models` do app; senão a página promete o que o app não gera.
export const AI_MODELS: readonly AiModel[] = [
  { name: 'Nano Banana 2', kind: 'Imagem', logo: 'nanobanana-color' },
  { name: 'Nano Banana 2 Edit', kind: 'Edição', logo: 'nanobanana-color' },
  { name: 'Kling 3.0', kind: 'Vídeo', logo: 'kling-color' },
  { name: 'Veo 3.1', kind: 'Vídeo', logo: 'deepmind-color' },
  { name: 'Claude', kind: 'Texto', logo: 'claude-color' },
  { name: 'ChatGPT', kind: 'Texto', logo: 'openai', soon: true },
  { name: 'Gemini', kind: 'Texto', logo: 'gemini-color', soon: true },
  { name: 'Sora 2', kind: 'Vídeo', logo: 'sora-color', soon: true },
  { name: 'Seedance', kind: 'Vídeo', logo: 'bytedance-color', soon: true },
  { name: 'Hailuo', kind: 'Vídeo', logo: 'hailuo-color', soon: true },
  { name: 'Wan', kind: 'Vídeo', logo: 'alibaba-color', soon: true },
  { name: 'FLUX', kind: 'Imagem', logo: 'flux', soon: true },
  { name: 'Ideogram', kind: 'Imagem', logo: 'ideogram', soon: true },
]

/** Uma ideia, os entregáveis que saem dela no Vynkio. Cada etapa é uma ferramenta que existe hoje. */
export const PIPELINE = [
  { step: 'Ideia', tool: 'Vynkio AI · Ideias', text: '"Rotina de pele de 3 passos antes do café"' },
  { step: 'Roteiro', tool: 'Vynkio AI · Roteiro', text: 'Gancho, 4 cenas cronometradas e CTA' },
  { step: 'Legenda e copy', tool: 'Vynkio AI · Copy', text: 'Três versões de legenda com a mesma marca' },
  { step: 'Imagem', tool: 'Studio · Nano Banana 2', text: 'Cada cena do roteiro vira foto com um clique' },
  { step: 'Vídeo', tool: 'Studio · Kling ou Veo', text: 'A foto ganha movimento, áudio ou fala' },
] as const

export type FaqIcon = 'beginner' | 'price' | 'time' | 'commercial' | 'cancel' | 'security' | 'notfor' | 'renew' | 'video' | 'extra' | 'empty' | 'switch' | 'tools' | 'business'

export interface FaqItem {
  readonly icon: FaqIcon
  readonly question: string
  readonly answer: string
}


// Objeções de compra, escritas como alguém perguntaria em voz alta. As respostas
// seguem as regras implementadas (migrations 0004 a 0018, functions de assinatura,
// webhook do Asaas e bucket privado). Mudou a regra, muda a resposta.
export const FAQ: readonly FaqItem[] = [
  {
    icon: 'beginner',
    question: 'Preciso entender de IA ou saber escrever prompt?',
    answer:
      'Não. Você descreve o que quer em português, do jeito que falaria com alguém, e escolhe o modelo numa lista. O custo em créditos aparece no botão antes de gerar, então dá para testar sem susto.',
  },
  {
    icon: 'price',
    question: 'Como funcionam os créditos?',
    answer:
      'Cada ferramenta de IA usa créditos conforme o modelo e as configurações escolhidas: uma foto custa menos que um vídeo, e um vídeo com fala custa mais que um sem. O custo aparece no botão antes de gerar. Se a geração falhar, os créditos voltam sozinhos.',
  },
  {
    icon: 'renew',
    question: 'Os créditos renovam mensalmente?',
    answer:
      'Os créditos do plano renovam a cada cobrança paga e não acumulam de um mês para o outro. Os de pacote avulso e os de boas-vindas nunca vencem, e o plano usa primeiro os créditos do mês.',
  },
  {
    icon: 'video',
    question: 'Qual a diferença entre geração e edição de vídeos?',
    answer:
      'Geração é quando um modelo de IA cria o vídeo, como Kling ou Veo: usa créditos. Edição é o Multiplicador montando os seus próprios vídeos, com cortes, textos e trilha: roda no seu navegador, não usa créditos e conta nas exportações do mês do seu plano. Só os roteiros do Multiplicador, escritos pela IA, usam créditos.',
  },
  {
    icon: 'extra',
    question: 'Posso comprar créditos extras?',
    answer: 'Pode. Na página Créditos há pacotes avulsos no Pix ou no cartão, que entram assim que o pagamento confirma e não vencem.',
  },
  {
    icon: 'empty',
    question: 'O que acontece se meus créditos acabarem?',
    answer:
      'As ferramentas de IA param até os créditos do plano renovarem ou até você comprar um pacote. Nada é cobrado sozinho. Para proteger a conta de gasto fora do normal, cada plano também tem um limite de consumo por dia e por mês.',
  },
  {
    icon: 'switch',
    question: 'Posso trocar de plano?',
    answer:
      'Pode, na página Assinatura. O plano novo começa quando o pagamento dele confirma, com os créditos dele, e o anterior encerra nesse momento. Os créditos de pacote avulso continuam com você.',
  },
  {
    icon: 'tools',
    question: 'Quais ferramentas estão disponíveis?',
    answer:
      'Hoje: Multiplicador de vídeos, imagens e vídeos com IA, personagens com o mesmo rosto, UGC, roteiros, ideias, copys, planejamento editorial, formatos prontos por nicho, marcas e projetos. O que aparece como em breve ainda não existe e não tem data prometida.',
  },
  {
    icon: 'business',
    question: 'Qual a diferença entre Creator e Business?',
    answer:
      'O Creator é para quem cria conteúdo sozinho: uma conta, créditos e exportações. O Business é para empresas e equipes, com mais usuários e recursos comerciais como CRM e propostas. O Business está em preparação e a contratação é por conversa.',
  },
  {
    icon: 'cancel',
    question: 'Posso cancelar minha assinatura?',
    answer:
      'Cancela quando quiser, na página Assinatura, sem multa. Não há nova cobrança e o plano continua até o fim do período pago. Depois disso a conta volta ao plano grátis, com os créditos de pacote que sobraram.',
  },
  {
    icon: 'security',
    question: 'Minhas criações e meus dados ficam seguros?',
    answer:
      'Suas criações ficam num armazenamento privado que só a sua conta acessa, e os vídeos do Multiplicador nem saem do seu computador. O pagamento é feito na página do Asaas, então o Vynkio não recebe os dados do seu cartão. Em Configurações você exporta seus dados ou exclui a conta.',
  },
]
