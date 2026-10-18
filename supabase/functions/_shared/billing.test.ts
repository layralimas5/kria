import { describe, expect, it } from 'vitest'
import { asaasEventSchema, decideBillingEvent, toCents } from './billing.ts'

const parse = (payload: unknown) => asaasEventSchema.parse(payload)

describe('decideBillingEvent', () => {
  it('cobrança paga sem assinatura é pacote avulso', () => {
    const action = decideBillingEvent(
      parse({ id: 'evt_1', event: 'PAYMENT_CONFIRMED', payment: { id: 'pay_1', checkoutSession: 'chk_1', value: 49.9 } }),
    )
    expect(action).toEqual({ kind: 'pack_paid', lookup: { checkoutId: 'chk_1', externalReference: null }, paymentId: 'pay_1' })
  })

  it('cobrança paga de assinatura vira ciclo do plano, com valor em centavos', () => {
    const action = decideBillingEvent(
      parse({
        id: 'evt_2',
        event: 'PAYMENT_RECEIVED',
        payment: {
          id: 'pay_2',
          customer: 'cus_1',
          subscription: 'sub_1',
          externalReference: 'ref',
          value: 79.9,
          dueDate: '2026-10-18',
          invoiceUrl: 'https://asaas.com/i/abc',
        },
      }),
    )
    expect(action).toEqual({
      kind: 'subscription_paid',
      lookup: { checkoutId: null, externalReference: 'ref' },
      providerSubscriptionId: 'sub_1',
      customerId: 'cus_1',
      paymentId: 'pay_2',
      amountCents: 7990,
      dueDate: '2026-10-18',
      invoiceUrl: 'https://asaas.com/i/abc',
    })
  })

  it('descarta data e link de fatura fora do formato', () => {
    const action = decideBillingEvent(
      parse({
        id: 'e',
        event: 'PAYMENT_CONFIRMED',
        payment: { id: 'p', subscription: 's', value: 10, dueDate: 'amanhã', invoiceUrl: 'javascript:alert(1)' },
      }),
    )
    expect(action).toMatchObject({ kind: 'subscription_paid', dueDate: null, invoiceUrl: null })
  })

  it('atraso só importa em assinatura', () => {
    expect(decideBillingEvent(parse({ id: 'e', event: 'PAYMENT_OVERDUE', payment: { id: 'p', subscription: 's' } }))).toEqual({
      kind: 'subscription_overdue',
      providerSubscriptionId: 's',
    })
    expect(decideBillingEvent(parse({ id: 'e', event: 'PAYMENT_OVERDUE', payment: { id: 'p' } })).kind).toBe('ignore')
  })

  it('estorno separa pacote de assinatura', () => {
    expect(decideBillingEvent(parse({ id: 'e', event: 'PAYMENT_REFUNDED', payment: { id: 'p', subscription: 's' } })).kind).toBe(
      'subscription_refunded',
    )
    expect(decideBillingEvent(parse({ id: 'e', event: 'PAYMENT_REFUNDED', payment: { id: 'p' } })).kind).toBe('pack_refunded')
  })

  it('eventos de checkout e de fim de assinatura', () => {
    expect(decideBillingEvent(parse({ id: 'e', event: 'CHECKOUT_PAID', checkout: { id: 'chk' } })).kind).toBe('checkout_paid')
    expect(decideBillingEvent(parse({ id: 'e', event: 'CHECKOUT_EXPIRED', checkout: { id: 'chk' } })).kind).toBe('checkout_closed')
    expect(decideBillingEvent(parse({ id: 'e', event: 'SUBSCRIPTION_DELETED', subscription: { id: 's' } }))).toEqual({
      kind: 'subscription_ended',
      providerSubscriptionId: 's',
      externalReference: null,
    })
  })

  it('ignora o que não conhece', () => {
    expect(decideBillingEvent(parse({ id: 'e', event: 'PAYMENT_CREATED', payment: { id: 'p' } })).kind).toBe('ignore')
  })
})

describe('toCents', () => {
  it('arredonda sem erro de ponto flutuante', () => {
    expect(toCents(59.9)).toBe(5990)
    expect(toCents(149.9)).toBe(14990)
  })
})
