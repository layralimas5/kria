// Conteúdo fixo da landing. Planos, preços e custos por geração ficam em `pricing/`
// e são conferidos contra as migrations nos testes de lá.
import { formatBRL } from '../domain/format'
import avatarSpecs from './avatars.json'
import generatedMedia from './avatars.generated.json'
import { PLAN_CATALOG } from './pricing/catalog'

export const SIGNUP_PATH = '/entrar'
export const WELCOME_CREDITS = 20

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

export interface UseCase {
  readonly audience: string
  readonly example: string
}

export const USE_CASES: readonly UseCase[] = [
  { audience: 'Criadores de TikTok e Reels', example: 'Roteiro com gancho nos 3 primeiros segundos e as cenas geradas em vídeo vertical.' },
  { audience: 'Canais de YouTube', example: 'Pautas para a semana, roteiro de Shorts e imagens para ilustrar o vídeo.' },
  { audience: 'Influenciadores digitais', example: 'Um personagem com rosto fixo para aparecer em cenários diferentes sem sessão de fotos.' },
  { audience: 'Afiliados', example: 'Vídeo estilo UGC apresentando o produto, com a legenda escrita junto.' },
  { audience: 'Infoprodutores', example: 'Copys de anúncio, legenda de lançamento e criativos para testar.' },
  { audience: 'Pequenos negócios', example: 'Post da semana com foto do cenário, legenda no tom da loja e ideia de story.' },
  { audience: 'Agências', example: 'Uma marca por cliente, com público e tom salvos. No Studio, até 10 marcas e as criações separadas por projeto.' },
]

/** Uma ideia, os entregáveis que saem dela no Vynkio. Cada etapa é uma ferramenta que existe hoje. */
export const PIPELINE = [
  { step: 'Ideia', tool: 'Vynkio AI · Ideias', text: '"Rotina de pele de 3 passos antes do café"' },
  { step: 'Roteiro', tool: 'Vynkio AI · Roteiro', text: 'Gancho, 4 cenas cronometradas e CTA' },
  { step: 'Legenda e copy', tool: 'Vynkio AI · Copy', text: 'Três versões de legenda com a mesma marca' },
  { step: 'Imagem', tool: 'Studio · Nano Banana 2', text: 'Cada cena do roteiro vira foto com um clique' },
  { step: 'Vídeo', tool: 'Studio · Kling ou Veo', text: 'A foto ganha movimento, áudio ou fala' },
] as const

export type AdvancedIcon = 'brands' | 'concurrent' | 'projects' | 'models'

/** Recursos avançados: nome e uma frase, sem print, sem repetir os blocos de cima. */
export const ADVANCED: readonly { readonly icon: AdvancedIcon; readonly title: string; readonly text: string }[] = [
  { icon: 'brands', title: 'Marcas com público e tom', text: 'Cadastre a marca uma vez e todo texto sai na voz dela. De 1 marca no Starter a 10 no Studio.' },
  { icon: 'concurrent', title: 'Várias gerações ao mesmo tempo', text: 'Enquanto um vídeo fica pronto, as próximas fotos já estão saindo. De 3 a 6 ao mesmo tempo, conforme o plano.' },
  { icon: 'projects', title: 'Meus projetos', text: 'Criações separadas por cliente ou campanha, para quem produz para mais de uma conta. No Studio.' },
  { icon: 'models', title: 'Modelos de ponta num lugar só', text: 'Nano Banana 2, Kling 3.0, Veo 3.1 e Claude com uma conta e um saldo, sem assinar cada um em dólar.' },
]

export type FaqIcon = 'beginner' | 'price' | 'time' | 'commercial' | 'cancel' | 'security' | 'notfor'

export interface FaqItem {
  readonly icon: FaqIcon
  readonly question: string
  readonly answer: string
}

function starterPlan() {
  const plan = PLAN_CATALOG.find((item) => item.slug === 'starter')
  if (!plan) throw new Error('O plano starter sumiu de pricing/catalog.ts')
  return plan
}
const STARTER = starterPlan()

// Objeções de compra, escritas como alguém perguntaria em voz alta. As respostas
// seguem as regras implementadas (migrations 0004 a 0010, functions de assinatura,
// webhook do Asaas e bucket privado). Mudou a regra, muda a resposta.
export const FAQ: readonly FaqItem[] = [
  {
    icon: 'beginner',
    question: 'Nunca usei IA. Vou conseguir?',
    answer:
      'Vai. Você descreve o que quer em português, do jeito que falaria com alguém. Não precisa escrever prompt em inglês nem escolher configuração técnica: cada ferramenta já vem com o modelo e o formato certos.',
  },
  {
    icon: 'price',
    question: 'Quanto vou gastar de verdade?',
    answer: `O ${STARTER.name} custa ${formatBRL(STARTER.price_cents)} por mês com ${STARTER.monthly_credits} créditos, o bastante para até 60 fotos ou 7 vídeos com Kling. O custo de cada geração aparece no botão antes de gerar, e não há cobrança por tempo de uso. Para testar, a conta nova ganha ${WELCOME_CREDITS} créditos, sem cartão.`,
  },
  {
    icon: 'time',
    question: 'Quanto tempo leva para sair um vídeo?',
    answer:
      'A foto sai em menos de um minuto e o vídeo leva alguns minutos. Você não fica esperando: dá para seguir criando enquanto isso, com 3 a 6 gerações ao mesmo tempo conforme o plano. Se a geração falhar, os créditos voltam sozinhos.',
  },
  {
    icon: 'commercial',
    question: 'Posso usar no meu perfil e com clientes?',
    answer:
      'Pode, em perfis, anúncios e projetos de clientes, respeitando os termos de uso do Vynkio e dos provedores dos modelos de IA. Você responde pelo uso e deve marcar o conteúdo como gerado por IA quando a rede social pedir.',
  },
  {
    icon: 'cancel',
    question: 'E se eu quiser cancelar?',
    answer:
      'Cancela quando quiser, na página Assinatura, sem multa. Não há nova cobrança e o plano continua até o fim do período pago. Os créditos do plano renovam a cada mês e não acumulam; os de pacote avulso e os de boas-vindas nunca vencem.',
  },
  {
    icon: 'security',
    question: 'Minhas criações e meus dados ficam seguros?',
    answer:
      'Suas criações ficam num armazenamento privado que só a sua conta acessa. O pagamento é feito na página do Asaas, então o Vynkio não recebe os dados do seu cartão. Em Configurações você exporta seus dados ou exclui a conta.',
  },
  {
    icon: 'notfor',
    question: 'Para quem o Vynkio não serve?',
    answer:
      'Para quem precisa editar vídeo longo numa linha do tempo: os vídeos têm 5 a 8 segundos, pensados para Reels, TikTok e anúncios. E para quem quer recriar uma pessoa real: personagem só nasce de imagem gerada no Vynkio, sem upload de foto de rosto.',
  },
]
