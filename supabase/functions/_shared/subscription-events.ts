// O que um evento do Asaas significa para uma assinatura, sem banco e sem rede.
// O asaas-webhook decide aqui e só então grava; assim a parte que libera ou
// tira benefício fica coberta por teste.
//
// Contrato do Asaas usado:
//   PAYMENT_*        traz `payment` com `subscription` (cobrança de assinatura),
//                    `checkoutSession` (primeira cobrança, vinda do checkout) e `dueDate`
//   SUBSCRIPTION_*   traz `subscription` com `id`
// Entrega é "pelo menos uma vez": o id do evento segura repetição (billing_events)
// e o id da cobrança segura crédito duplicado (credit_ledger.payment_id).

export interface SubscriptionEventInput {
  readonly event: string
  readonly payment?: {
    readonly id: string
    readonly subscription?: string | null
    readonly checkoutSession?: string | null
    readonly customer?: string | null
    readonly dueDate?: string | null
  }
  readonly subscription?: { readonly id: string }
}

export type SubscriptionDecision =
  | { readonly kind: 'not_subscription' }
  | {
      readonly kind: 'paid'
      readonly paymentId: string
      readonly providerSubscriptionId: string
      readonly checkoutSessionId: string | null
      readonly customerId: string | null
      readonly periodEnd: Date
    }
  | { readonly kind: 'overdue'; readonly providerSubscriptionId: string }
  | { readonly kind: 'refunded'; readonly providerSubscriptionId: string }
  | { readonly kind: 'ended'; readonly providerSubscriptionId: string }
  | { readonly kind: 'ignored'; readonly reason: string }

const PAID = new Set(['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'])
const REFUNDED = new Set(['PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK_REQUESTED'])
const ENDED = new Set(['SUBSCRIPTION_DELETED', 'SUBSCRIPTION_INACTIVATED', 'SUBSCRIPTION_EXPIRED'])
const DUE_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Até quando a cobrança com vencimento `dueDate` sustenta o plano: um mês
 * a partir do vencimento (o Asaas cobra o próximo no vencimento seguinte),
 * com um dia de folga para o cartão processar a renovação.
 */
export function periodEndAfter(dueDate: string): Date {
  const match = DUE_DATE.exec(dueDate)
  if (!match) throw new Error(`dueDate inválido: ${dueDate}`)
  const [, year, month, day] = match.map(Number) as [number, number, number, number]
  return new Date(Date.UTC(year, month, day + 1, 23, 59, 59))
}

export function decideSubscriptionEvent(input: SubscriptionEventInput): SubscriptionDecision {
  if (ENDED.has(input.event)) {
    if (!input.subscription) return { kind: 'ignored', reason: 'assinatura sem corpo' }
    return { kind: 'ended', providerSubscriptionId: input.subscription.id }
  }

  const payment = input.payment
  if (!payment?.subscription) return { kind: 'not_subscription' }
  const providerSubscriptionId = payment.subscription

  if (PAID.has(input.event)) {
    if (!payment.dueDate || !DUE_DATE.test(payment.dueDate)) return { kind: 'ignored', reason: 'cobrança sem vencimento' }
    return {
      kind: 'paid',
      paymentId: payment.id,
      providerSubscriptionId,
      checkoutSessionId: payment.checkoutSession ?? null,
      customerId: payment.customer ?? null,
      periodEnd: periodEndAfter(payment.dueDate),
    }
  }
  if (input.event === 'PAYMENT_OVERDUE') return { kind: 'overdue', providerSubscriptionId }
  if (REFUNDED.has(input.event)) return { kind: 'refunded', providerSubscriptionId }
  return { kind: 'ignored', reason: `cobrança de assinatura sem efeito: ${input.event}` }
}
