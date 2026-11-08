// Vitrine dos planos na landing: textos, selos e tabela comparativa. Só entra o que o plano
// libera hoje: nada de "em breve", de item não incluído nem de quantidade fixa de vídeos.
// Quem cobra e libera é o app (`subscription_plans`, `models`); preço e créditos
// daqui precisam bater com as migrations, e `catalog.test.ts` falha se separarem.

/** Valor de uma célula da comparação: texto livre ou um dos marcadores. */
export type ComparisonValue = 'yes' | 'no' | (string & {})

export interface MarketingPlan {
  readonly slug: string
  readonly name: string
  readonly tagline: string
  readonly price_cents: number
  readonly monthly_credits: number
  readonly max_personas: number
  /** Marcas com contexto no Workspace. Precisa bater com `max_brands` (0009). */
  readonly max_brands: number
  readonly badge: string | null
  readonly highlight: boolean
  /** Por que o plano em destaque é o recomendado. Sem motivo real, sem destaque. */
  readonly highlight_reason: string | null
  readonly position: number
  readonly features: readonly string[]
  readonly comparison: Readonly<Record<string, ComparisonValue>>
}

/** Linhas da tabela comparativa, na ordem em que aparecem. A chave casa com `comparison` do banco. */
export const COMPARISON_ROWS: readonly { readonly key: string; readonly label: string }[] = [
  { key: 'credits', label: 'Créditos' },
  { key: 'personas', label: 'Personagens salvos' },
  { key: 'brands', label: 'Marcas com público e tom' },
  { key: 'concurrent', label: 'Gerações ao mesmo tempo' },
  { key: 'images', label: 'Fotos com IA e com personagens' },
  { key: 'kling', label: 'Vídeo com Kling 3.0' },
  { key: 'veo', label: 'Vídeo com fala e som (Veo 3.1)' },
  { key: 'history', label: 'Histórico e download' },
  { key: 'copy', label: 'Ideias, copys e roteiros' },
  { key: 'ugc', label: 'Roteiro UGC com cenas' },
  { key: 'projects', label: 'Meus projetos' },
  { key: 'support', label: 'Suporte' },
]

export const PLAN_CATALOG: readonly MarketingPlan[] = [
  {
    slug: 'starter',
    name: 'Vynkio Starter',
    tagline: 'Seu primeiro passo na criação com IA.',
    price_cents: 5990,
    monthly_credits: 300,
    max_personas: 2,
    max_brands: 1,
    badge: null,
    highlight: false,
    highlight_reason: null,
    position: 10,
    features: [
      '300 créditos por mês',
      'Até 2 personagens salvos',
      'Fotos com IA e com seus personagens',
      'Vídeo com Kling 3.0',
      'Vídeo com fala e som (Veo 3.1)',
      '3 gerações ao mesmo tempo',
      'Histórico e download das criações',
      'Suporte por e-mail',
      'Ideias, copys e roteiros com IA',
    ],
    comparison: { credits: '300 por mês', personas: 'Até 2', brands: '1', concurrent: '3', images: 'yes', kling: 'yes', veo: 'yes', history: 'yes', copy: 'yes', ugc: 'no', projects: 'no', support: 'E-mail' },
  },
  {
    slug: 'pro',
    name: 'Vynkio Pro',
    tagline: 'Para quem publica toda semana e precisa de UGC e mais de uma marca.',
    price_cents: 7990,
    monthly_credits: 450,
    max_personas: 5,
    max_brands: 3,
    badge: 'Recomendado',
    highlight: true,
    highlight_reason: 'Por R$ 20 a mais que o Starter: 150 créditos a mais, Roteiro UGC, 3 marcas e suporte pelo WhatsApp.',
    position: 20,
    features: [
      '450 créditos por mês',
      'Até 5 personagens salvos',
      'Até 3 marcas com público e tom',
      'Tudo do Starter',
      '4 gerações ao mesmo tempo',
      'Suporte pelo WhatsApp',
      'Roteiro UGC com cenas para o Studio',
    ],
    comparison: { credits: '450 por mês', personas: 'Até 5', brands: 'Até 3', concurrent: '4', images: 'yes', kling: 'yes', veo: 'yes', history: 'yes', copy: 'yes', ugc: 'yes', projects: 'no', support: 'WhatsApp' },
  },
  {
    slug: 'studio',
    name: 'Vynkio Studio',
    tagline: 'Para creators, marcas e profissionais que querem produzir em escala.',
    price_cents: 14990,
    monthly_credits: 1000,
    max_personas: 15,
    max_brands: 10,
    badge: null,
    highlight: false,
    highlight_reason: null,
    position: 30,
    features: [
      '1.000 créditos por mês',
      'Até 15 personagens salvos',
      'Até 10 marcas com público e tom',
      'Tudo do Pro',
      '6 gerações ao mesmo tempo',
      'Suporte pelo WhatsApp',
      'Meus projetos',
    ],
    comparison: { credits: '1.000 por mês', personas: 'Até 15', brands: 'Até 10', concurrent: '6', images: 'yes', kling: 'yes', veo: 'yes', history: 'yes', copy: 'yes', ugc: 'yes', projects: 'yes', support: 'WhatsApp' },
  },
]
