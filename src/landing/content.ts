// Conteúdo fixo da landing. Planos, preços e custos por geração ficam em `pricing/`
// e são conferidos contra as migrations nos testes de lá.
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
  readonly description: string
  readonly screen: Screen
  readonly screenAlt: string
  readonly cta: string
  /** Rota do app: quem não está logado passa pelo cadastro e volta para cá. */
  readonly to: string
  /** Restrição de plano, quando existe. */
  readonly plans?: string
}

export const FEATURES: readonly Feature[] = [
  {
    id: 'imagens',
    icon: 'image',
    name: 'Imagens com IA',
    benefit: 'Da frase à foto realista',
    description: 'Descreva a cena em português e receba uma foto pronta para o feed. O custo em créditos aparece no botão antes de gerar.',
    screen: 'imagem',
    screenAlt: 'Caixa de descrição da foto no Studio do Vynkio, com o modelo Nano Banana 2 e o botão Gerar mostrando 5 créditos',
    cta: 'Gerar uma imagem',
    to: '/estudio?modo=imagem',
  },
  {
    id: 'videos',
    icon: 'video',
    name: 'Vídeos com IA',
    benefit: 'Sua imagem ganha movimento e som',
    description: 'Escolha uma criação ou personagem e diga o que acontece. Kling 3.0 faz 5 segundos com áudio; Veo 3.1 faz 8 segundos com fala.',
    screen: 'video',
    screenAlt: 'Tela de vídeo do Studio do Vynkio com a escolha entre Kling 3.0 e Veo 3.1 e as criações recentes',
    cta: 'Criar um vídeo',
    to: '/estudio?modo=video',
  },
  {
    id: 'personagens',
    icon: 'persona',
    name: 'Personagens consistentes',
    benefit: 'O mesmo rosto em todo post',
    description: 'Monte o personagem por cabelo, rosto, corpo e roupa, salve e use de novo em fotos e vídeos sem perder a identidade.',
    screen: 'personagem',
    screenAlt: 'Construtor de personagem do Vynkio com opções de corte de cabelo e dois personagens salvos',
    cta: 'Montar um personagem',
    to: '/personas',
  },
  {
    id: 'ugc',
    icon: 'ugc',
    name: 'Conteúdos UGC',
    benefit: 'Vídeo com cara de cliente real',
    description: 'O roteiro UGC sai em cenas, com fala e descrição visual. Cada cena vai para o Studio com um clique.',
    screen: 'ugc',
    screenAlt: 'Roteiro UGC gerado no Vynkio, dividido em cenas com fala, descrição da cena e o botão Criar a cena no Studio',
    cta: 'Escrever um roteiro UGC',
    to: '/assistente/ugc',
    plans: 'Planos Pro e Studio',
  },
  {
    id: 'roteiros',
    icon: 'copy',
    name: 'Copys e roteiros',
    benefit: 'Texto no tom da sua marca',
    description: 'Legendas, anúncios e roteiros com gancho, cenas e CTA. Cadastre a marca uma vez e o Vynkio AI escreve com o público e o tom dela.',
    screen: 'roteiro',
    screenAlt: 'Roteiro de vídeo gerado no Vynkio, com cenas cronometradas, fala e descrição visual',
    cta: 'Escrever um roteiro',
    to: '/assistente/roteiro',
  },
  {
    id: 'ideias',
    icon: 'ideas',
    name: 'Ideias para redes sociais',
    benefit: 'Pauta pronta quando a ideia some',
    description: 'Peça ideias para o seu público e receba formato e gancho de cada uma. A que você escolher segue para o roteiro com um clique.',
    screen: 'ideias',
    screenAlt: 'Lista de ideias de conteúdo gerada no Vynkio, cada uma com formato e gancho',
    cta: 'Pedir ideias',
    to: '/assistente/ideias',
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

export const STEPS = [
  { title: 'Escolha o tipo de conteúdo', text: 'Imagem, vídeo, personagem, roteiro, copy ou ideias. Cada um tem a sua ferramenta, todas no mesmo painel.' },
  { title: 'Descreva ou peça ajuda', text: 'Escreva a ideia em português. Sem ideia? O Vynkio AI sugere pautas e escreve o roteiro com você.' },
  { title: 'Personalize e gere', text: 'Escolha modelo, personagem e marca. O custo em créditos aparece antes de você gerar, e volta se falhar.' },
  { title: 'Salve, adapte e use', text: 'Imagens e vídeos ficam em Minhas criações para baixar. Uma cena do roteiro vira imagem, e a imagem vira vídeo.' },
] as const

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

export type FaqIcon = 'what' | 'beginner' | 'credits' | 'commercial' | 'formats' | 'persona' | 'plans' | 'rollover' | 'cancel' | 'extra'

export interface FaqItem {
  readonly icon: FaqIcon
  readonly question: string
  readonly answer: string
}

// Respostas presas às regras implementadas (migrations 0004 a 0010, functions de
// assinatura e o webhook do Asaas). Mudou a regra, muda a resposta.
export const FAQ: readonly FaqItem[] = [
  {
    icon: 'what',
    question: 'O que é o Vynkio?',
    answer:
      'Uma plataforma brasileira de criação com IA. No mesmo painel você cria personagens, imagens e vídeos e escreve ideias, roteiros e copys, tudo em português e pago com os mesmos créditos.',
  },
  {
    icon: 'beginner',
    question: 'Preciso ter experiência com IA?',
    answer:
      'Não. Você descreve o que quer em português, do jeito que falaria com alguém. Não precisa escrever prompt em inglês nem escolher configuração técnica: cada ferramenta já vem com o modelo e o formato certos.',
  },
  {
    icon: 'credits',
    question: 'Como funcionam os créditos?',
    answer:
      'Cada criação gasta uma quantidade fixa de créditos: 5 por foto, 6 por foto com personagem, 40 por vídeo Kling, 200 por vídeo Veo 3.1 e 3 por pedido de texto. O custo aparece no botão antes de gerar. Se a geração falhar ou for bloqueada pelo filtro do provedor, os créditos voltam sozinhos.',
  },
  {
    icon: 'commercial',
    question: 'Posso produzir conteúdo comercial?',
    answer:
      'Sim, em perfis, anúncios e projetos de clientes, respeitando os termos de uso do Vynkio e dos provedores dos modelos de IA. Você responde pelo uso e deve marcar o conteúdo como gerado por IA quando a rede social pedir.',
  },
  {
    icon: 'formats',
    question: 'Quais formatos são disponibilizados?',
    answer:
      'Imagens na proporção 4:5, a do feed. Vídeos com Kling 3.0 têm 5 segundos com áudio e seguem a proporção da imagem de origem; com Veo 3.1 têm 8 segundos, 720p, vertical 9:16, com fala e som. Imagens e vídeos ficam em Minhas criações para baixar; os textos ficam no histórico do Vynkio AI, prontos para copiar.',
  },
  {
    icon: 'persona',
    question: 'Posso criar personagens recorrentes?',
    answer:
      'Sim. Você monta o personagem, gera retratos até gostar e salva. Ele mantém o mesmo rosto nas próximas fotos e vídeos. O limite é de 1 no Grátis, 2 no Starter, 5 no Pro e 15 no Studio. Por segurança, personagens nascem só de imagens geradas no Vynkio: não dá para usar foto de pessoa real.',
  },
  {
    icon: 'plans',
    question: 'Como funcionam os planos?',
    answer:
      'São assinaturas mensais no cartão. Cada plano traz um saldo de créditos por mês e libera ferramentas e limites diferentes (personagens, marcas, gerações ao mesmo tempo, suporte). Para trocar, vá em Assinatura na sua conta: o novo plano vale quando o pagamento dele é confirmado.',
  },
  {
    icon: 'rollover',
    question: 'Os créditos acumulam para o mês seguinte?',
    answer:
      'Os créditos do plano renovam a cada cobrança paga, e o que sobrou do mês anterior não passa para o seguinte. Os créditos de pacote avulso e os de boas-vindas nunca vencem.',
  },
  {
    icon: 'cancel',
    question: 'Posso cancelar minha assinatura?',
    answer:
      'Pode, quando quiser, na página Assinatura, sem multa. Não há nova cobrança e o plano continua até o fim do período já pago, com os créditos dele. Os créditos de pacote avulso ficam com você.',
  },
  {
    icon: 'extra',
    question: 'Posso comprar créditos adicionais?',
    answer: 'Sim. Além do plano, dá para comprar pacotes avulsos por Pix ou cartão na página Créditos, inclusive sem assinar.',
  },
]
