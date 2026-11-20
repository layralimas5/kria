import { describe, expect, it } from 'vitest'
import { isValidCardNumber, payBodySchema, quoteOrder, type StoreProduct } from './storeCheckout.ts'

const main: StoreProduct = {
  slug: 'kria-personagens',
  name: 'Kria Personagens',
  price_cents: 4700,
  max_installments: 12,
  interest_monthly: 0.0299,
  bump_slugs: ['pack-prompts', 'guia-reels'],
  bump_price_cents: null,
}
const prompts: StoreProduct = { ...main, slug: 'pack-prompts', name: 'Pack de prompts', price_cents: 3700, bump_slugs: [], bump_price_cents: 1990 }
const reels: StoreProduct = { ...main, slug: 'guia-reels', name: 'Guia de Reels', price_cents: 2700, bump_slugs: [] }
const other: StoreProduct = { ...main, slug: 'outro', name: 'Outro', bump_slugs: [] }

const buyer = { name: 'Ana Souza', email: 'Ana@X.com', cpf: '529.982.247-25', phone: '(11) 98765-4321' }
const card = {
  holderName: 'ANA SOUZA',
  number: '4111 1111 1111 1111',
  expiryMonth: '7',
  expiryYear: '35',
  ccv: '123',
  postalCode: '01310-100',
  addressNumber: '100',
  installments: 3,
}

describe('quoteOrder', () => {
  it('soma o principal e os "leve junto" escolhidos, com o preço de oferta', () => {
    const quote = quoteOrder(main, [prompts, reels], ['pack-prompts'], 1)
    expect(quote.lines.map((line) => [line.slug, line.priceCents, line.isBump])).toEqual([
      ['kria-personagens', 4700, false],
      ['pack-prompts', 1990, true],
    ])
    expect(quote.totalCents).toBe(6690)
  })

  it('parcelado cobra os juros sobre o pedido inteiro', () => {
    const quote = quoteOrder(main, [prompts, reels], ['pack-prompts', 'guia-reels'], 3)
    expect(quote.subtotalCents).toBe(4700 + 1990 + 2700)
    expect(quote.totalCents).toBe(quote.installmentCents * 3)
    expect(quote.totalCents).toBeGreaterThan(quote.subtotalCents)
  })

  it('recusa produto que o principal não oferece e parcela acima do permitido', () => {
    expect(() => quoteOrder(main, [other], ['outro'], 1)).toThrow('bump_not_offered')
    expect(() => quoteOrder({ ...main, max_installments: 2 }, [], [], 3)).toThrow('installments_not_allowed')
  })
})

describe('payBodySchema', () => {
  it('normaliza CPF, celular, e-mail e cartão', () => {
    const parsed = payBodySchema.parse({ action: 'pay', method: 'card', product: 'kria-personagens', buyer, card, expectedTotalCents: 4700 })
    expect(parsed.buyer).toEqual({ name: 'Ana Souza', email: 'ana@x.com', cpf: '52998224725', phone: '11987654321' })
    if (parsed.method !== 'card') throw new Error('método')
    expect(parsed.card).toMatchObject({ number: '4111111111111111', expiryMonth: '07', expiryYear: '2035', postalCode: '01310100' })
  })

  it('Pix não leva cartão e recusa CPF inválido', () => {
    expect(payBodySchema.safeParse({ action: 'pay', method: 'pix', product: 'kit', buyer, expectedTotalCents: 4700 }).success).toBe(true)
    expect(payBodySchema.safeParse({ action: 'pay', method: 'pix', product: 'kit', buyer: { ...buyer, cpf: '111.111.111-11' }, expectedTotalCents: 4700 }).success).toBe(false)
  })

  it('recusa cartão vencido e número que não passa no Luhn', () => {
    const base = { action: 'pay', method: 'card', product: 'kit', buyer, expectedTotalCents: 4700 }
    expect(payBodySchema.safeParse({ ...base, card: { ...card, expiryYear: '2020' } }).success).toBe(false)
    expect(payBodySchema.safeParse({ ...base, card: { ...card, number: '4111 1111 1111 1112' } }).success).toBe(false)
  })
})

describe('isValidCardNumber', () => {
  it('confere o dígito verificador', () => {
    expect(isValidCardNumber('5162306219378829')).toBe(true)
    expect(isValidCardNumber('5162306219378828')).toBe(false)
  })
})
