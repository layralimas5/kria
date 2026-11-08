import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { CREDIT_NOTICE, storefrontSchema, WELCOME_CREDITS_V3, withWelcome } from './storefront'

const MIGRATION = fs.readFileSync(path.resolve(__dirname, '../../../supabase/migrations/0019_pricing_v3.sql'), 'utf8')

const plan = (slug: string, line: 'creator' | 'business', price: number | null, credits: number | null, cta: 'signup' | 'subscribe' | 'contact') => ({
  slug,
  line,
  name: slug,
  tagline: null,
  price_cents: price,
  monthly_credits: credits,
  exports_month: 40,
  seats: 1,
  highlight: false,
  features: ['Gerador de imagens'],
  soon_features: [],
  limits: [],
  cta,
})

describe('vitrine lida do banco', () => {
  it('aceita a resposta de storefront_plans e põe as boas-vindas no Free', () => {
    const storefront = storefrontSchema.parse({
      welcome_credits: 100,
      credit_scale: 2,
      plans: [plan('gratis', 'creator', 0, 0, 'signup'), plan('creator-pro', 'creator', 16990, 6000, 'subscribe'), plan('enterprise', 'business', null, null, 'contact')],
    })
    expect(withWelcome(storefront).map((item) => [item.slug, item.monthly_credits])).toEqual([
      ['gratis', 100],
      ['creator-pro', 6000],
      ['enterprise', null],
    ])
  })

  it('recusa custo ou orçamento só se vier no formato errado, e nunca precisa deles', () => {
    expect(() => storefrontSchema.parse({ welcome_credits: 100, credit_scale: 2, plans: [{ slug: 'x' }] })).toThrow()
    expect(Object.keys(storefrontSchema.shape.plans.element.shape)).not.toContain('ai_budget_cents')
  })

  it('o número dos textos fixos é o da proposta no banco', () => {
    expect(MIGRATION).toMatch(new RegExp(`next_welcome_credits integer not null default ${WELCOME_CREDITS_V3} `))
  })

  it('aviso de créditos é o texto aprovado, sem equivalência em reais nem quantidade fixa', () => {
    expect(CREDIT_NOTICE).toBe(
      'Cada ferramenta de IA consome uma quantidade de créditos conforme o modelo e as configurações escolhidas. O custo em créditos é informado antes de cada geração.',
    )
    expect(CREDIT_NOTICE).not.toMatch(/R\$|\d|ilimitad/i)
  })
})
