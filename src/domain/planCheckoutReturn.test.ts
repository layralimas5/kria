import { describe, expect, it } from 'vitest'
import { checkoutReturnPath, readCheckoutChoices } from './planCheckoutReturn'

describe('volta do checkout depois de confirmar o e-mail', () => {
  it('leva a forma de pagamento e os extras na URL e lê de volta', () => {
    const path = checkoutReturnPath('starter', { method: 'pix', bumps: ['kria-personagens'] })
    expect(path).toBe('/assinar/starter?metodo=pix&extras=kria-personagens')
    expect(readCheckoutChoices(path.split('?')[1] ?? '')).toEqual({ method: 'pix', bumps: ['kria-personagens'] })
  })

  it('sem extras, só a forma de pagamento', () => {
    expect(checkoutReturnPath('pro', { method: 'card', bumps: [] })).toBe('/assinar/pro?metodo=card')
  })

  it('ignora forma de pagamento desconhecida e extras inválidos', () => {
    expect(readCheckoutChoices('?metodo=boleto')).toBeNull()
    expect(readCheckoutChoices('?metodo=card&extras=ok-slug,<script>,a')).toEqual({ method: 'card', bumps: ['ok-slug'] })
  })
})
