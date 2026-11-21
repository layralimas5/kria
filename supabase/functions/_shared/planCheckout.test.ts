import { describe, expect, it } from 'vitest'
import { planPayBodySchema } from './planCheckout.ts'
import { quotePlanOrder, splitFirstPayment } from './planQuote.ts'

const OFFERED = [
  { slug: 'kria-personagens', name: 'Personagens Insanos', price_cents: 1290, bump_price_cents: 990 },
  { slug: 'pack-prompts', name: 'Pack de prompts', price_cents: 3700, bump_price_cents: null },
]

const BUYER = { name: 'Maria Souza', cpf: '529.982.247-25', phone: '(11) 98765-4321' }
const CARD = {
  holderName: 'MARIA SOUZA',
  number: '4111 1111 1111 1111',
  expiryMonth: '07',
  expiryYear: '35',
  ccv: '123',
  postalCode: '01310-100',
  addressNumber: '100',
  installments: 1,
}

describe('checkout dos planos', () => {
  it('soma a mensalidade com os extras pelo preço de oferta', () => {
    const quote = quotePlanOrder(4990, OFFERED, ['kria-personagens', 'pack-prompts'])
    expect(quote.bumpsCents).toBe(990 + 3700)
    expect(quote.totalCents).toBe(4990 + 990 + 3700)
  })

  it('sem extras, paga só a mensalidade', () => {
    expect(quotePlanOrder(4990, OFFERED, []).totalCents).toBe(4990)
  })

  it('extra repetido conta uma vez; extra fora da oferta é recusado', () => {
    expect(quotePlanOrder(4990, OFFERED, ['pack-prompts', 'pack-prompts']).bumps).toHaveLength(1)
    expect(() => quotePlanOrder(4990, OFFERED, ['outro-produto'])).toThrow('bump_not_offered')
  })

  it('o Pix com extras separa a parte do plano e a do pedido', () => {
    expect(splitFirstPayment(5980, 990)).toEqual({ planCents: 4990, storeCents: 990 })
    expect(splitFirstPayment(4990, 0)).toEqual({ planCents: 4990, storeCents: 0 })
    expect(splitFirstPayment(500, 990)).toEqual({ planCents: 0, storeCents: 500 })
  })

  it('aceita cartão à vista e recusa parcelado', () => {
    const body = { action: 'pay', method: 'card', plan: 'pro', bumps: [], buyer: BUYER, card: CARD, expectedTotalCents: 4990 }
    expect(planPayBodySchema.safeParse(body).success).toBe(true)
    expect(planPayBodySchema.safeParse({ ...body, card: { ...CARD, installments: 3 } }).success).toBe(false)
  })

  it('não aceita e-mail do formulário: vale o da conta', () => {
    const parsed = planPayBodySchema.parse({ action: 'pay', method: 'pix', plan: 'pro', buyer: { ...BUYER, email: 'x@y.com' }, expectedTotalCents: 4990 })
    expect('email' in parsed.buyer).toBe(false)
    expect(parsed.buyer.cpf).toBe('52998224725')
  })
})
