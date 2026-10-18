import { describe, expect, it } from 'vitest'
import { decideSubscriptionEvent, periodEndAfter } from './subscription-events'

const payment = { id: 'pay_1', subscription: 'sub_1', checkoutSession: 'chk_1', customer: 'cus_1', dueDate: '2026-10-18' }

describe('periodEndAfter', () => {
  it('vai até um mês depois do vencimento, com um dia de folga', () => {
    expect(periodEndAfter('2026-10-18').toISOString()).toBe('2026-11-19T23:59:59.000Z')
  })

  it('vira o ano sem erro', () => {
    expect(periodEndAfter('2026-12-31').toISOString()).toBe('2027-02-01T23:59:59.000Z')
  })

  it('recusa data fora do formato do Asaas', () => {
    expect(() => periodEndAfter('18/10/2026')).toThrow()
  })
})

describe('decideSubscriptionEvent', () => {
  it('cobrança paga de assinatura libera o período', () => {
    const decision = decideSubscriptionEvent({ event: 'PAYMENT_CONFIRMED', payment })
    expect(decision).toMatchObject({ kind: 'paid', paymentId: 'pay_1', providerSubscriptionId: 'sub_1', checkoutSessionId: 'chk_1' })
  })

  it('cobrança avulsa (sem assinatura) segue para o fluxo de créditos', () => {
    expect(decideSubscriptionEvent({ event: 'PAYMENT_CONFIRMED', payment: { id: 'pay_2' } })).toEqual({ kind: 'not_subscription' })
  })

  it('volta do navegador não é evento: só PAYMENT_CONFIRMED/RECEIVED liberam', () => {
    expect(decideSubscriptionEvent({ event: 'PAYMENT_CREATED', payment }).kind).toBe('ignored')
  })

  it('atraso, estorno e fim da assinatura viram mudança de status', () => {
    expect(decideSubscriptionEvent({ event: 'PAYMENT_OVERDUE', payment }).kind).toBe('overdue')
    expect(decideSubscriptionEvent({ event: 'PAYMENT_REFUNDED', payment }).kind).toBe('refunded')
    expect(decideSubscriptionEvent({ event: 'SUBSCRIPTION_DELETED', subscription: { id: 'sub_1' } }).kind).toBe('ended')
  })
})
