// Vitrine dos preços v2 (Creator e Business). Preço, créditos, exportações e usuários precisam
// bater com a 0018 (`catalogV2.test.ts` falha se separarem). Só aparece com `VITE_PRICING_V2=true`,
// depois da virada (`admin_activate_pricing_v2`). Ver docs/precos-v2.md.

export type PlanCta = 'signup' | 'subscribe' | 'contact'

export interface V2Feature {
  readonly label: string
  /** Ainda não existe no produto: aparece como "Em breve", sem data. */
  readonly soon?: true
}

export interface V2Plan {
  readonly slug: string
  readonly line: 'creator' | 'business'
  readonly name: string
  readonly tagline: string
  /** Nulo = sob consulta. */
  readonly price_cents: number | null
  /** Créditos IA por mês; nulo = personalizado. No Free são os de boas-vindas. */
  readonly monthly_credits: number | null
  /** Exportações editadas por mês; nulo = personalizado. */
  readonly exports_month: number | null
  readonly seats: number | null
  readonly highlight: boolean
  readonly features: readonly V2Feature[]
  /** O que o plano não tem, dito com clareza. */
  readonly limits: readonly string[]
  readonly cta: PlanCta
}

/** Boas-vindas da escala v2. Precisa ser o valor usado na virada; o painel mostra o que ele compra. */
export const WELCOME_CREDITS_V2 = 10

export const CREATOR_PLANS: readonly V2Plan[] = [
  {
    slug: 'gratis',
    line: 'creator',
    name: 'Free',
    tagline: 'Para conhecer a plataforma sem cartão.',
    price_cents: 0,
    monthly_credits: WELCOME_CREDITS_V2,
    exports_month: 3,
    seats: 1,
    highlight: false,
    features: [{ label: `${WELCOME_CREDITS_V2} créditos de boas-vindas, uma vez só` }, { label: '3 exportações editadas por mês' }, { label: 'Créditos avulsos por Pix quando quiser' }],
    limits: ['Sem modelos de vídeo premium', '1 personagem salvo'],
    cta: 'signup',
  },
  {
    slug: 'creator-start',
    line: 'creator',
    name: 'Creator Start',
    tagline: 'Para começar a criar com IA toda semana.',
    price_cents: 6990,
    monthly_credits: 1000,
    exports_month: 40,
    seats: 1,
    highlight: false,
    features: [
      { label: 'Multiplicador de vídeos (até 5 variações por lote)' },
      { label: 'Gerador de imagens' },
      { label: 'Roteiros, ideias e copys' },
      { label: 'Formatos prontos por nicho' },
      { label: 'Biblioteca de projetos' },
    ],
    limits: ['Sem geração de vídeo por IA', 'Até 2 personagens'],
    cta: 'subscribe',
  },
  {
    slug: 'creator-pro',
    line: 'creator',
    name: 'Creator Pro',
    tagline: 'Para quem publica todo dia e precisa de volume.',
    price_cents: 14990,
    monthly_credits: 2500,
    exports_month: 150,
    seats: 1,
    highlight: true,
    features: [
      { label: 'Multiplicador em lote (até 10 variações)' },
      { label: 'Imagens e vídeos com IA (Kling 3.0)' },
      { label: 'UGC com roteiro e cenas' },
      { label: 'Personagens com o mesmo rosto' },
      { label: 'Até 3 marcas com público e tom' },
      { label: 'Legendas automáticas', soon: true },
    ],
    limits: ['Veo 3.1 só no Creator Max', 'Até 5 personagens'],
    cta: 'subscribe',
  },
  {
    slug: 'creator-max',
    line: 'creator',
    name: 'Creator Max',
    tagline: 'Para produção em escala com modelos premium.',
    price_cents: 29990,
    monthly_credits: 6000,
    exports_month: 400,
    seats: 1,
    highlight: false,
    features: [
      { label: 'Tudo do Creator Pro' },
      { label: 'Vídeo com fala e som (Veo 3.1)' },
      { label: 'Lotes de até 15 variações' },
      { label: '6 gerações ao mesmo tempo' },
      { label: 'Até 15 personagens e 10 marcas' },
      { label: 'Motion Control', soon: true },
    ],
    limits: ['Modelos premium consomem mais créditos por geração'],
    cta: 'subscribe',
  },
]

const BUSINESS_SOON: readonly V2Feature[] = [{ label: 'CRM e pipeline comercial', soon: true }, { label: 'Propostas comerciais', soon: true }]

export const BUSINESS_PLANS: readonly V2Plan[] = [
  {
    slug: 'business-start',
    line: 'business',
    name: 'Business Start',
    tagline: 'Marketing e vendas com IA para pequenas equipes.',
    price_cents: 39900,
    monthly_credits: 4000,
    exports_month: 400,
    seats: 2,
    highlight: false,
    features: [{ label: 'Conteúdo e planejamento com IA' }, { label: 'Multiplicador de vídeos' }, ...BUSINESS_SOON, { label: 'Landing pages básicas', soon: true }],
    limits: ['2 usuários'],
    cta: 'contact',
  },
  {
    slug: 'business-pro',
    line: 'business',
    name: 'Business Pro',
    tagline: 'Operação comercial e de marketing com equipe.',
    price_cents: 89900,
    monthly_credits: 10000,
    exports_month: 1000,
    seats: 5,
    highlight: true,
    features: [
      { label: 'Tudo do Business Start' },
      { label: 'Vídeo com fala e som (Veo 3.1)' },
      { label: 'Prospecção e automações', soon: true },
      { label: 'Gestão de equipe e relatórios', soon: true },
      { label: 'Landing pages avançadas', soon: true },
    ],
    limits: ['5 usuários'],
    cta: 'contact',
  },
  {
    slug: 'business-scale',
    line: 'business',
    name: 'Business Scale',
    tagline: 'Para agências e operações com muitos clientes.',
    price_cents: 199900,
    monthly_credits: 25000,
    exports_month: 2500,
    seats: 15,
    highlight: false,
    features: [
      { label: 'Tudo do Business Pro' },
      { label: 'Múltiplos projetos e clientes' },
      { label: 'Permissões avançadas', soon: true },
      { label: 'Relatórios gerenciais', soon: true },
    ],
    limits: ['15 usuários'],
    cta: 'contact',
  },
  {
    slug: 'enterprise',
    line: 'business',
    name: 'Enterprise',
    tagline: 'Volume, usuários e limites sob medida.',
    price_cents: null,
    monthly_credits: null,
    exports_month: null,
    seats: null,
    highlight: false,
    features: [{ label: 'Créditos e usuários sob medida' }, { label: 'Condições comerciais próprias' }],
    limits: [],
    cta: 'contact',
  },
]

export const CREDIT_NOTICE =
  'Os créditos são utilizados em ferramentas de inteligência artificial. O consumo varia conforme o modelo e as configurações escolhidas. Ferramentas de edição podem possuir limites próprios de utilização.'
