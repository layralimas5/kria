// Vitrine dos planos na landing: textos, selos, "em breve" e tabela comparativa.
// Quem cobra e libera é o app (`subscription_plans`, `models`); preço e créditos
// daqui precisam bater com as migrations, e `catalog.test.ts` falha se separarem.

export interface PlanFeature {
  readonly label: string
  readonly soon: boolean
}

/** Valor de uma célula da comparação: texto livre ou um dos marcadores. */
export type ComparisonValue = 'yes' | 'no' | 'soon' | (string & {})

export interface MarketingPlan {
  readonly slug: string
  readonly name: string
  readonly tagline: string
  readonly price_cents: number
  readonly monthly_credits: number
  readonly max_personas: number
  readonly cta_label: string
  readonly badge: string | null
  readonly highlight: boolean
  readonly position: number
  readonly features: readonly PlanFeature[]
  readonly comparison: Readonly<Record<string, ComparisonValue>>
}

/** Linhas da tabela comparativa, na ordem em que aparecem. A chave casa com `comparison` do banco. */
export const COMPARISON_ROWS: readonly { readonly key: string; readonly label: string }[] = [
  { key: 'credits', label: 'Créditos' },
  { key: 'personas', label: 'Personagens salvos' },
  { key: 'concurrent', label: 'Gerações ao mesmo tempo' },
  { key: 'images', label: 'Fotos com IA e com personagens' },
  { key: 'kling', label: 'Vídeo com Kling 3.0' },
  { key: 'veo', label: 'Vídeo com fala e som (Veo 3.1)' },
  { key: 'history', label: 'Histórico e download' },
  { key: 'copy', label: 'Copys e roteiros' },
  { key: 'prompts', label: 'Biblioteca de prompts' },
  { key: 'motion_control', label: 'Motion Control' },
  { key: 'ugc', label: 'Estúdio UGC' },
  { key: 'projects', label: 'Meus projetos' },
  { key: 'support', label: 'Suporte' },
  { key: 'community', label: 'Acesso à comunidade' },
]

const feature = (label: string, soon = false) => ({ label, soon })

export const PLAN_CATALOG: readonly MarketingPlan[] = [
  {
    slug: 'starter',
    name: 'Vynkio Starter',
    tagline: 'Seu primeiro passo na criação com IA.',
    price_cents: 5990,
    monthly_credits: 300,
    max_personas: 2,
    cta_label: 'Começar com Starter',
    badge: null,
    highlight: false,
    position: 10,
    features: [
      feature('300 créditos por mês'),
      feature('Até 60 fotos, 7 vídeos com Kling ou 1 com Veo por mês'),
      feature('Até 2 personagens salvos'),
      feature('Fotos com IA e com seus personagens'),
      feature('Vídeo com Kling 3.0'),
      feature('Vídeo com fala e som (Veo 3.1)'),
      feature('3 gerações ao mesmo tempo'),
      feature('Histórico e download das criações'),
      feature('Suporte por e-mail'),
      feature('Copys e roteiros', true),
      feature('Biblioteca de prompts', true),
    ],
    comparison: { credits: '300 por mês', personas: 'Até 2', concurrent: '3', images: 'yes', kling: 'yes', veo: 'yes', history: 'yes', copy: 'soon', prompts: 'soon', motion_control: 'no', ugc: 'no', projects: 'no', support: 'E-mail', community: 'no' },
  },
  {
    slug: 'pro',
    name: 'Vynkio Pro',
    tagline: 'Crie mais, experimente mais e produza conteúdos incríveis.',
    price_cents: 7990,
    monthly_credits: 450,
    max_personas: 5,
    cta_label: 'Quero ser Pro',
    badge: 'Mais popular',
    highlight: true,
    position: 20,
    features: [
      feature('450 créditos por mês'),
      feature('Até 90 fotos, 11 vídeos com Kling ou 2 com Veo por mês'),
      feature('Até 5 personagens salvos'),
      feature('Tudo do Starter'),
      feature('4 gerações ao mesmo tempo'),
      feature('Suporte pelo WhatsApp'),
      feature('Acesso à comunidade'),
      feature('Motion Control', true),
      feature('Estúdio UGC', true),
    ],
    comparison: { credits: '450 por mês', personas: 'Até 5', concurrent: '4', images: 'yes', kling: 'yes', veo: 'yes', history: 'yes', copy: 'soon', prompts: 'soon', motion_control: 'soon', ugc: 'soon', projects: 'no', support: 'WhatsApp', community: 'yes' },
  },
  {
    slug: 'studio',
    name: 'Vynkio Studio',
    tagline: 'Para creators, marcas e profissionais que querem produzir em escala.',
    price_cents: 14990,
    monthly_credits: 1000,
    max_personas: 15,
    cta_label: 'Escolher Studio',
    badge: null,
    highlight: false,
    position: 30,
    features: [
      feature('1.000 créditos por mês'),
      feature('Até 200 fotos, 25 vídeos com Kling ou 5 com Veo por mês'),
      feature('Até 15 personagens salvos'),
      feature('Tudo do Pro'),
      feature('6 gerações ao mesmo tempo'),
      feature('Suporte pelo WhatsApp'),
      feature('Acesso à comunidade'),
      feature('Meus projetos', true),
    ],
    comparison: { credits: '1.000 por mês', personas: 'Até 15', concurrent: '6', images: 'yes', kling: 'yes', veo: 'yes', history: 'yes', copy: 'soon', prompts: 'soon', motion_control: 'soon', ugc: 'soon', projects: 'soon', support: 'WhatsApp', community: 'yes' },
  },
]
