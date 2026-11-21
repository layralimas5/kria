import { describe, expect, it } from 'vitest'
import type { StoreOffer } from '@/lib/api'
import { longestInstallment, quoteCheckout, sameEmail } from './storeQuote'

const OFFER: StoreOffer = {
  product: { slug: 'kria-personagens', name: 'Personagens Insanos', tagline: null, coverUrl: null, priceCents: 1290 },
  bumps: [{ slug: 'pack', name: 'Pack', pitch: null, coverUrl: null, priceCents: 1990, fullPriceCents: 3700 }],
  maxInstallments: 12,
  interestMonthly: 0.0299,
  salesUrl: 'https://exemplo.com',
}

describe('cotação do checkout da loja', () => {
  it('R$ 12,90 só parcela em 2x (parcela mínima de R$ 5)', () => {
    const quote = quoteCheckout(OFFER, new Set(), 12)
    expect(quote.options.map((option) => option.count)).toEqual([1, 2])
    expect(quote.selected.count).toBe(2)
    expect(longestInstallment(quote.options)?.installmentCents).toBe(675)
  })

  it('o "leve junto" entra no subtotal e abre mais parcelas', () => {
    const quote = quoteCheckout(OFFER, new Set(['pack']), 1)
    expect(quote.subtotalCents).toBe(3280)
    expect(quote.selected.totalCents).toBe(3280)
    expect(quote.options.length).toBeGreaterThan(2)
  })

  it('sem parcelamento, não mostra o "ou Nx"', () => {
    expect(longestInstallment(quoteCheckout({ ...OFFER, maxInstallments: 1 }, new Set(), 1).options)).toBeNull()
  })

  it('confirmação do e-mail ignora maiúsculas e espaços', () => {
    expect(sameEmail('Maria@Email.com ', 'maria@email.com')).toBe(true)
    expect(sameEmail('maria@email.com', 'maria@emal.com')).toBe(false)
  })
})
