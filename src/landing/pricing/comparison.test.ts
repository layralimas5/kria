import { describe, expect, it } from 'vitest'
import type { Model, Plan } from '@/domain/types'
import { buildComparison, resolveFeatures } from './comparison'
import type { StorefrontPlan } from './storefront'

function storefrontPlan(slug: string, name: string, features: string[], price_cents: number): StorefrontPlan {
  return {
    slug,
    line: 'creator',
    name,
    tagline: null,
    price_cents,
    monthly_credits: 100,
    exports_month: 3,
    seats: 1,
    highlight: false,
    features,
    soon_features: [],
    limits: [],
    usage_hint: null,
    cta: price_cents === 0 ? 'signup' : 'subscribe',
  }
}

const FREE = storefrontPlan('gratis', 'Free', ['Créditos de boas-vindas'], 0)
const STARTER = storefrontPlan('creator-start', 'Starter', ['Formatos prontos por nicho', 'Suporte por e-mail'], 7990)
const PRO = storefrontPlan('creator-pro', 'Pro', ['Tudo do Starter', 'Comunidade Vynkio', 'Suporte por WhatsApp'], 16990)
const ALL = [FREE, STARTER, PRO]

const limits = (slug: string, tools: string[]): Plan => ({
  slug,
  name: slug,
  description: '',
  price_cents: 0,
  monthly_credits: 0,
  max_concurrent: 2,
  max_personas: 1,
  max_brands: 1,
  max_variations: 3,
  tools,
  features: [],
  public: true,
  highlight: false,
  position: 0,
})

const kling = { slug: 'video-kling', name: 'Kling 3.0', kind: 'video', allowed_plans: ['creator-pro'] } as unknown as Model

describe('comparação dos planos', () => {
  it('"Tudo do Starter" herda os itens do Starter', () => {
    expect(resolveFeatures(PRO, ALL)).toEqual(['Formatos prontos por nicho', 'Suporte por e-mail', 'Comunidade Vynkio', 'Suporte por WhatsApp'])
  })

  it('vídeo só aparece como incluído nos planos que o modelo libera', () => {
    const access = { plans: [limits('gratis', []), limits('creator-start', []), limits('creator-pro', ['ugc_studio'])], models: [kling] }
    const groups = buildComparison(ALL, access, ALL)
    const video = groups.flatMap((group) => group.rows).find((row) => row.label === 'Vídeo: Kling 3.0')
    expect(video?.cells.map((cell) => cell.kind)).toEqual(['no', 'no', 'yes'])
  })

  it('o suporte mostrado é o do próprio plano, não o herdado', () => {
    const access = { plans: [], models: [] }
    const support = buildComparison(ALL, access, ALL)
      .flatMap((group) => group.rows)
      .find((row) => row.label === 'Suporte')
    expect(support?.cells).toEqual([{ kind: 'no' }, { kind: 'text', value: 'Suporte por e-mail' }, { kind: 'text', value: 'Suporte por WhatsApp' }])
  })
})
