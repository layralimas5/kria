// Regras puras do webhook do Asaas: sem rede, sem banco. Testadas em billing.test.ts.
//
// O Asaas manda eventos de checkout (pacote avulso ou assinatura) e de
// cobrança. Cobrança com `subscription` é ciclo de plano; sem, é pacote.

import { z } from 'npm:zod@3'

export const asaasEventSchema = z.object({
  id: z.string().min(1),
  event: z.string().min(1),
  checkout: z.object({ id: z.string(), externalReference: z.string().nullish() }).passthrough().optional(),
  payment: z
    .object({
      id: z.string(),
      customer: z.string().nullish(),
      subscription: z.string().nullish(),
      checkoutSession: z.string().nullish(),
      externalReference: z.string().nullish(),
      value: z.number().nullish(),
      dueDate: z.string().nullish(),
      invoiceUrl: z.string().nullish(),
    })
    .passthrough()
    .optional(),
  subscription: z.object({ id: z.string(), externalReference: z.string().nullish() }).passthrough().optional(),
})

export type AsaasEvent = z.infer<typeof asaasEventSchema>

/** Como achar a nossa linha (compra ou assinatura) a partir do evento. */
export interface Lookup {
  readonly checkoutId: string | null
  readonly externalReference: string | null
}

export type BillingAction =
  | { readonly kind: 'checkout_paid'; readonly lookup: Lookup }
  | { readonly kind: 'checkout_closed'; readonly lookup: Lookup }
  | { readonly kind: 'pack_paid'; readonly lookup: Lookup; readonly paymentId: string }
  | { readonly kind: 'pack_refunded'; readonly lookup: Lookup }
  | {
      readonly kind: 'subscription_paid'
      readonly lookup: Lookup
      readonly providerSubscriptionId: string
      readonly customerId: string | null
      readonly paymentId: string
      readonly amountCents: number
      readonly dueDate: string | null
      readonly invoiceUrl: string | null
    }
  | { readonly kind: 'subscription_overdue'; readonly providerSubscriptionId: string }
  | { readonly kind: 'subscription_refunded'; readonly providerSubscriptionId: string; readonly paymentId: string }
  | { readonly kind: 'subscription_ended'; readonly providerSubscriptionId: string; readonly externalReference: string | null }
  | { readonly kind: 'ignore'; readonly reason: string }

const PAID = new Set(['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'])
const REFUNDED = new Set(['PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK_REQUESTED'])
const CHECKOUT_CLOSED = new Set(['CHECKOUT_EXPIRED', 'CHECKOUT_CANCELED'])
const SUBSCRIPTION_ENDED = new Set(['SUBSCRIPTION_DELETED', 'SUBSCRIPTION_INACTIVATED'])

const DATE = /^\d{4}-\d{2}-\d{2}$/

export function toCents(value: number): number {
  return Math.round(value * 100)
}

function paymentLookup(payment: NonNullable<AsaasEvent['payment']>): Lookup {
  return { checkoutId: payment.checkoutSession ?? null, externalReference: payment.externalReference ?? null }
}

export function decideBillingEvent(event: AsaasEvent): BillingAction {
  if (event.event === 'CHECKOUT_PAID' && event.checkout) {
    return { kind: 'checkout_paid', lookup: { checkoutId: event.checkout.id, externalReference: event.checkout.externalReference ?? null } }
  }
  if (CHECKOUT_CLOSED.has(event.event) && event.checkout) {
    return { kind: 'checkout_closed', lookup: { checkoutId: event.checkout.id, externalReference: event.checkout.externalReference ?? null } }
  }
  if (SUBSCRIPTION_ENDED.has(event.event) && event.subscription) {
    return {
      kind: 'subscription_ended',
      providerSubscriptionId: event.subscription.id,
      externalReference: event.subscription.externalReference ?? null,
    }
  }

  const payment = event.payment
  if (!payment) return { kind: 'ignore', reason: `sem cobrança: ${event.event}` }
  const subscriptionId = payment.subscription ?? null

  if (PAID.has(event.event)) {
    if (!subscriptionId) return { kind: 'pack_paid', lookup: paymentLookup(payment), paymentId: payment.id }
    if (typeof payment.value !== 'number') return { kind: 'ignore', reason: 'cobrança de assinatura sem valor' }
    return {
      kind: 'subscription_paid',
      lookup: paymentLookup(payment),
      providerSubscriptionId: subscriptionId,
      customerId: payment.customer ?? null,
      paymentId: payment.id,
      amountCents: toCents(payment.value),
      dueDate: payment.dueDate && DATE.test(payment.dueDate) ? payment.dueDate : null,
      invoiceUrl: payment.invoiceUrl && payment.invoiceUrl.startsWith('https://') ? payment.invoiceUrl : null,
    }
  }
  if (event.event === 'PAYMENT_OVERDUE' && subscriptionId) {
    return { kind: 'subscription_overdue', providerSubscriptionId: subscriptionId }
  }
  if (REFUNDED.has(event.event)) {
    return subscriptionId
      ? { kind: 'subscription_refunded', providerSubscriptionId: subscriptionId, paymentId: payment.id }
      : { kind: 'pack_refunded', lookup: paymentLookup(payment) }
  }
  return { kind: 'ignore', reason: `ignorado: ${event.event}` }
}
