import { describe, expect, it } from 'vitest'
import { asaasEventSchema, decideBillingEvent, isValidCpf, toCents } from './billing.ts'

const parse = (payload: unknown) => asaasEventSchema.parse(payload)

describe('decideBillingEvent', () => {
  it('cobrança paga sem assinatura é pacote avulso', () => {
    const action = decideBillingEvent(
      parse({ id: 'evt_1', event: 'PAYMENT_CONFIRMED', payment: { id: 'pay_1', checkoutSession: 'chk_1', value: 49.9 } }),
    )
    expect(action).toEqual({ kind: 'pack_paid', lookup: { checkoutId: 'chk_1', externalReference: null, paymentId: 'pay_1', installmentId: null }, paymentId: 'pay_1', customerId: null })
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
      lookup: { checkoutId: null, externalReference: 'ref', paymentId: 'pay_2', installmentId: null },
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

  it('Pix vencido e cartão recusado sem assinatura encerram o pedido da loja', () => {
    expect(decideBillingEvent(parse({ id: 'e', event: 'PAYMENT_OVERDUE', payment: { id: 'p' } }))).toMatchObject({
      kind: 'pack_failed',
      reason: 'pix vencido',
    })
    const refused = decideBillingEvent(
      parse({ id: 'e', event: 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED', payment: { id: 'p', installment: 'ins_1', externalReference: 'ord' } }),
    )
    expect(refused).toEqual({
      kind: 'pack_failed',
      lookup: { checkoutId: null, externalReference: 'ord', paymentId: 'p', installmentId: 'ins_1' },
      reason: 'cartão recusado',
    })
  })

  it('atraso de assinatura vira atraso do plano', () => {
    expect(decideBillingEvent(parse({ id: 'e', event: 'PAYMENT_OVERDUE', payment: { id: 'p', subscription: 's' } }))).toEqual({
      kind: 'subscription_overdue',
      providerSubscriptionId: 's',
    })
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

describe('isValidCpf', () => {
  it('aceita CPF com dígitos verificadores certos', () => {
    expect(isValidCpf('52998224725')).toBe(true)
    expect(isValidCpf('11144477735')).toBe(true)
  })

  it('recusa dígito errado, repetição e formato fora de 11 números', () => {
    expect(isValidCpf('52998224724')).toBe(false)
    expect(isValidCpf('11111111111')).toBe(false)
    expect(isValidCpf('529.982.247-25')).toBe(false)
    expect(isValidCpf('5299822472')).toBe(false)
  })
})
